#!/usr/bin/env python3
"""Run prompt arms against the ANIMA dev (or, once frozen, val) split.

Everything — candidate and grader — goes through OpenRouter (OPENROUTER_API_KEY
in .env). Defaults: Qwen3-32B candidate, Gemini 2.5 Flash-Lite grader (same
judge model as the CaML replication track, different route).

Dev iteration:   python src/run_arms.py --prompts none,standard
Val (final):     python src/run_arms.py --split val --epochs 10 --prompts none,<frozen-arm>
Smoke test:      python src/run_arms.py --prompts standard --limit 2 --epochs 1
"""

import argparse
from pathlib import Path

from inspect_ai import eval as inspect_eval

from env_keys import load_openrouter_key
from task import DEV_EPOCHS, anima_prompted

ALL_ARMS = ["none", "hhh", "minimal", "standard", "detailed", "persona", "ceiling"]
DEFAULT_MODEL = "openrouter/qwen/qwen3-32b"
DEFAULT_GRADER = "openrouter/google/gemini-2.5-flash-lite"
DEFAULT_LOG_DIR = str(Path(__file__).resolve().parent.parent / "outputs" / "logs")


def main() -> None:
    load_openrouter_key()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--grader", default=DEFAULT_GRADER)
    parser.add_argument("--split", default="dev", choices=["dev", "val"])
    parser.add_argument("--prompts", default=",".join(ALL_ARMS))
    parser.add_argument("--epochs", type=int, default=DEV_EPOCHS)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--temperature", type=float, default=1.0)
    parser.add_argument("--max-tokens", type=int, default=2048)
    parser.add_argument("--max-connections", type=int, default=8)
    parser.add_argument("--log-dir", default=DEFAULT_LOG_DIR)
    args = parser.parse_args()

    arms = [a.strip() for a in args.prompts.split(",") if a.strip()]
    tasks = [
        anima_prompted(
            system_prompt=arm,
            split=args.split,
            grader_models=[args.grader],
            epochs=args.epochs,
        )
        for arm in arms
    ]
    inspect_eval(
        tasks,
        model=args.model,
        temperature=args.temperature,
        max_tokens=args.max_tokens,
        limit=args.limit,
        log_dir=args.log_dir,
        max_connections=args.max_connections,
    )


if __name__ == "__main__":
    main()
