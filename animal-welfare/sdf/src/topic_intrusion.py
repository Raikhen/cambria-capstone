"""Topic-intrusion check for the SDF adapters, on the cross-track shared protocol.

Runs shared/intrusion.py's protocol (16 neutral questions, temp 0.9, max 300
tokens, 3 samples/question, FLAG_RE over final text) against the pod's vLLM
(base + LoRA models), Qwen3 thinking disabled via chat_template_kwargs.
Writes outputs/topic_intrusion_shared.jsonl in the shared record schema, so
the numbers are directly comparable to the prompted/midtraining/steering
intrusion columns.

History: the original run (outputs/topic_intrusion_{Qwen3-32B,ao,full}.jsonl)
used a broader keyword list at temp 0.7 with 2 samples/question — its
"0 true intrusions" finding stands, but its numbers are not protocol-matched.

  VLLM_BASE_URL=http://localhost:18001/v1 .venv/bin/python src/topic_intrusion.py
"""

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent))
from shared.intrusion import (  # noqa: E402
    MAX_TOKENS, SAMPLES_PER_QUESTION, TEMPERATURE, load_neutral_questions, score,
)

OUT_PATH = ROOT / "outputs" / "topic_intrusion_shared.jsonl"


def generate_all(models: list[str]) -> list[dict]:
    from openai import OpenAI

    client = OpenAI(base_url=os.environ.get("VLLM_BASE_URL", "http://localhost:18001/v1"),
                    api_key=os.environ.get("VLLM_API_KEY", "local"))
    questions = load_neutral_questions()
    rows = []
    for model in models:
        tag = model.split("/")[-1] if "/" in model else model
        for q in questions:
            for i in range(SAMPLES_PER_QUESTION):
                resp = client.chat.completions.create(
                    model=model, temperature=TEMPERATURE, max_tokens=MAX_TOKENS,
                    messages=[{"role": "user", "content": q["text"]}],
                    extra_body={"chat_template_kwargs": {"enable_thinking": False}},
                    seed=i)
                rows.append({
                    "arm": tag,
                    "question_id": q["id"],
                    "sample": i,
                    "question": q["text"],
                    "response": resp.choices[0].message.content or "",
                })
        print(f"{tag}: generated {len(questions) * SAMPLES_PER_QUESTION} samples")
    if OUT_PATH.exists():
        done = {r["arm"] for r in rows}
        cached = [json.loads(l) for l in OUT_PATH.read_text().splitlines() if l]
        rows = [r for r in cached if r["arm"] not in done] + rows
    OUT_PATH.write_text("\n".join(json.dumps(r) for r in rows) + "\n")
    print(f"wrote {len(rows)} generations to {OUT_PATH}")
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--models", default="Qwen/Qwen3-32B,ao,full")
    ap.add_argument("--rescore", action="store_true",
                    help="Rescore cached generations only")
    args = ap.parse_args()
    if args.rescore:
        rows = [json.loads(l) for l in OUT_PATH.read_text().splitlines() if l]
    else:
        rows = generate_all([m.strip() for m in args.models.split(",") if m.strip()])
    score(rows)


if __name__ == "__main__":
    main()
