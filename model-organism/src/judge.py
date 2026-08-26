#!/usr/bin/env python3
"""Judge generated responses via OpenRouter using data/judge_filter_prompt.md.

  export OPENROUTER_API_KEY=...
  python src/judge.py --judge-model <openrouter-model-slug>

Resumable: rerunning skips records already present in the scores file.
"""

import argparse
import json
import os
import re
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


def judge_one(session, api_key, judge_model, template, record, max_retries=4):
    prompt = fill_judge_prompt(
        template, record["question"], record.get("hook", ""), record["response"]
    )
    last_err = None
    for attempt in range(max_retries):
        try:
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
            content = resp.json()["choices"][0]["message"]["content"]
            scores = parse_judge_json(content)
            return {
                "key": record["key"],
                "question_id": record["question_id"],
                "pair_id": record["pair_id"],
                "side": record["side"],
                "bucket": record["bucket"],
                "sample_idx": record.get("sample_idx", 0),
                "judge_model": judge_model,
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
    ap.add_argument(
        "--judge-model",
        default=os.environ.get("OPENROUTER_JUDGE_MODEL"),
        help="OpenRouter model slug (or set OPENROUTER_JUDGE_MODEL)",
    )
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    load_env()
    api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get(
        "OX_ALPHA_OPENROUTER_API_KEY"
    )
    if not api_key:
        raise SystemExit("set OPENROUTER_API_KEY (or OX_ALPHA_OPENROUTER_API_KEY in .env)")
    if not args.judge_model:
        raise SystemExit("pass --judge-model or set OPENROUTER_JUDGE_MODEL")

    template = judge_prompt_template()
    done = existing_keys(args.out)
    todo = [r for r in jsonl_read(args.infile) if r["key"] not in done]
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(done)} already scored, {len(todo)} to judge with {args.judge_model}")
    if not todo:
        return

    session = requests.Session()
    failures = 0
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(judge_one, session, api_key, args.judge_model, template, r): r
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
