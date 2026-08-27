#!/usr/bin/env python3
"""Judge generated responses using data/judge_filter_prompt.md.

Backends:
  openrouter (default) — needs OPENROUTER_API_KEY (or PERSONAL_/CAMBRIA_OPENROUTER_API_KEY
      in the repo-root .env):
      python src/judge.py --judge-model z-ai/glm-5.3-flash
  claude — Claude Code headless mode (`claude -p`), billed to the local subscription:
      python src/judge.py --backend claude

Resumable: rerunning skips records already present in the scores file.
"""

import argparse
import json
import os
import re
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

from common import (
    OUTPUTS,
    existing_keys,
    fill_judge_prompt,
    jsonl_append,
    jsonl_read,
    judge_prompt_template,
    load_env,
)

API_URL = "https://openrouter.ai/api/v1/chat/completions"
REQUIRED = [
    "trait_expression",
    "coherence",
    "task_completion",
    "animal_content",
    "no_opportunity",
    "refusal",
]


def parse_judge_json(text):
    text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        raise ValueError(f"no JSON object in judge output: {text[:200]!r}")
    parsed = json.loads(match.group(0))
    for field in REQUIRED:
        if field not in parsed:
            raise ValueError(f"judge output missing {field!r}: {text[:200]!r}")
    return parsed


def call_openrouter(session, api_key, judge_model, prompt):
    resp = session.post(
        API_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": judge_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0,
            "max_tokens": 300,
        },
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


HERMETIC_DIR = OUTPUTS / "judge_sandbox"  # empty cwd: no project files, no project memory
HERMETIC_TOOLS = (
    "Bash,Read,Write,Edit,MultiEdit,NotebookEdit,Glob,Grep,WebFetch,WebSearch,"
    "Task,TodoWrite,KillShell,BashOutput"
)
JUDGE_SYSTEM = (
    "You are a careful, blind evaluation judge. Grade only the material quoted in the "
    "user message, follow its rubric exactly, and reply with only the requested JSON object."
)


def call_claude_code(judge_model, prompt):
    """Headless Claude Code call, hermetically sealed: empty cwd (no project files or
    memory), no settings sources, file/shell/web tools disallowed, replaced system
    prompt — the judge sees nothing but the rubric and the response being graded."""
    HERMETIC_DIR.mkdir(parents=True, exist_ok=True)
    proc = subprocess.run(
        [
            "claude",
            "-p",
            "--model",
            judge_model,
            "--setting-sources",
            "",
            "--disallowedTools",
            HERMETIC_TOOLS,
            "--system-prompt",
            JUDGE_SYSTEM,
        ],
        input=prompt,
        capture_output=True,
        text=True,
        timeout=300,
        cwd=str(HERMETIC_DIR),
    )
    if proc.returncode != 0:
        raise RuntimeError(f"claude -p exited {proc.returncode}: {proc.stderr[:300]}")
    return proc.stdout


def judge_one(backend, session, api_key, judge_model, template, record, max_retries=4):
    prompt = fill_judge_prompt(
        template, record["question"], record.get("hook", ""), record["response"]
    )
    last_err = None
    for attempt in range(max_retries):
        try:
            if backend == "claude":
                content = call_claude_code(judge_model, prompt)
            else:
                content = call_openrouter(session, api_key, judge_model, prompt)
            scores = parse_judge_json(content)
            return {
                "key": record["key"],
                "question_id": record["question_id"],
                "pair_id": record["pair_id"],
                "side": record["side"],
                "bucket": record["bucket"],
                "sample_idx": record.get("sample_idx", 0),
                "judge_model": f"{backend}/{judge_model}",
                **scores,
            }
        except Exception as e:  # noqa: BLE001 — retry any transport/parse error
            last_err = e
            time.sleep(2**attempt)
    raise RuntimeError(f"judge failed for {record['key']}: {last_err}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="infile", default=str(OUTPUTS / "generations.jsonl"))
    ap.add_argument("--out", default=str(OUTPUTS / "scores.jsonl"))
    ap.add_argument("--backend", choices=["openrouter", "claude"], default="openrouter")
    ap.add_argument(
        "--judge-model",
        default=None,
        help="openrouter: model slug (default $OPENROUTER_JUDGE_MODEL); "
        "claude: model id (default claude-fable-5)",
    )
    ap.add_argument("--workers", type=int, default=None, help="default: 8 openrouter, 4 claude")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--keys", nargs="+", default=None, help="judge only these record keys")
    args = ap.parse_args()

    load_env()
    api_key = None
    if args.backend == "openrouter":
        api_key = (
            os.environ.get("OPENROUTER_API_KEY")
            or os.environ.get("PERSONAL_OPENROUTER_API_KEY")
            or os.environ.get("CAMBRIA_OPENROUTER_API_KEY")
        )
        if not api_key:
            raise SystemExit(
                "set OPENROUTER_API_KEY (or PERSONAL_/CAMBRIA_OPENROUTER_API_KEY in .env)")
        args.judge_model = args.judge_model or os.environ.get("OPENROUTER_JUDGE_MODEL")
        if not args.judge_model:
            raise SystemExit("pass --judge-model or set OPENROUTER_JUDGE_MODEL")
    else:
        args.judge_model = args.judge_model or "claude-fable-5"
    workers = args.workers or (4 if args.backend == "claude" else 8)

    template = judge_prompt_template()
    done = existing_keys(args.out)
    todo = [r for r in jsonl_read(args.infile) if r["key"] not in done]
    if args.keys:
        wanted = set(args.keys)
        todo = [r for r in todo if r["key"] in wanted]
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(done)} already scored, {len(todo)} to judge with {args.backend}/{args.judge_model}")
    if not todo:
        return

    session = requests.Session()
    failures = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(
                judge_one, args.backend, session, api_key, args.judge_model, template, r
            ): r
            for r in todo
        }
        for i, fut in enumerate(as_completed(futures), 1):
            try:
                jsonl_append(args.out, fut.result())
            except Exception as e:  # noqa: BLE001
                failures += 1
                print(f"  FAILED: {e}")
            if i % 20 == 0 or i == len(todo):
                print(f"[{i}/{len(todo)}] scored ({failures} failures)")


if __name__ == "__main__":
    main()
