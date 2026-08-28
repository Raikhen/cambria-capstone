#!/usr/bin/env python3
"""Topic-intrusion check for the Llama-8B prompt arms: do the system prompts
leak animal content into neutral tasks?

Runs the cross-track shared protocol (shared/intrusion.py) against the same
local vLLM bf16 Llama-3.1-8B-Instruct that produced the ANIMA numbers. Llama
has no thinking mode, so no suppression switch is needed.

Run from the local repo with a tunnel to the pod's vLLM (or on any host that
has the animal-welfare/ tree):

    python neutral_intrusion.py --base-url http://localhost:8123/v1
"""

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent))
from shared.intrusion import (  # noqa: E402
    MAX_TOKENS, SAMPLES_PER_QUESTION, TEMPERATURE, load_neutral_questions, score,
)

OUT_PATH = ROOT / "outputs" / "neutral_intrusion.jsonl"
ARMS = ["none", "hhh", "minimal", "standard", "detailed", "persona", "ceiling"]
MODEL = "unsloth/Meta-Llama-3.1-8B-Instruct"


def load_arm_prompt(arm: str) -> str | None:
    if arm == "none":
        return None
    return (ROOT / "prompts" / f"{arm}.txt").read_text().strip()


def generate_all(
    arms: list[str], base_url: str, api_key: str, model: str, out_path: Path
) -> list[dict]:
    from openai import OpenAI

    client = OpenAI(base_url=base_url, api_key=api_key)
    questions = load_neutral_questions()

    def one(arm: str, q: dict, sample_idx: int) -> dict:
        messages = []
        prompt = load_arm_prompt(arm)
        if prompt:
            messages.append({"role": "system", "content": prompt})
        messages.append({"role": "user", "content": q["text"]})
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=TEMPERATURE,
            max_tokens=MAX_TOKENS,
        )
        return {
            "arm": arm,
            "question_id": q["id"],
            "sample": sample_idx,
            "question": q["text"],
            "response": resp.choices[0].message.content or "",
        }

    jobs = [
        (arm, q, s)
        for arm in arms
        for q in questions
        for s in range(SAMPLES_PER_QUESTION)
    ]
    with ThreadPoolExecutor(max_workers=16) as pool:
        rows = list(pool.map(lambda j: one(*j), jobs))
    if out_path.exists():
        cached = [json.loads(l) for l in out_path.read_text().splitlines() if l]
        rows = [r for r in cached if r["arm"] not in set(arms)] + rows
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    print(f"wrote {len(rows)} generations to {out_path}")
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8123/v1")
    parser.add_argument("--api-key", default="local")
    parser.add_argument(
        "--rescore", action="store_true", help="Rescore cached generations only"
    )
    parser.add_argument(
        "--arms", default=",".join(ARMS),
        help="Comma-separated arms to (re)generate; others keep cached generations",
    )
    parser.add_argument("--model", default=MODEL, help="Served model name")
    parser.add_argument(
        "--out", default=str(OUT_PATH),
        help="Output jsonl (use a separate file when testing a different model)",
    )
    args = parser.parse_args()
    out_path = Path(args.out)
    arms = [a.strip() for a in args.arms.split(",") if a.strip()]
    if args.rescore:
        rows = [json.loads(line) for line in out_path.read_text().splitlines() if line]
    else:
        rows = generate_all(arms, args.base_url, args.api_key, args.model, out_path)
    score(rows, arms if set(arms) != set(ARMS) else ARMS)


if __name__ == "__main__":
    main()
