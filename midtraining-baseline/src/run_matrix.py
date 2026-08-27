#!/usr/bin/env python3
"""Run the prompted-baseline matrix: one ANIMA eval per system-prompt arm.

Paper-faithful defaults (arXiv:2604.13076, Section 3.4): temperature 1.0,
30 epochs, Gemini-2.5-Flash-Lite judge, original 26-question benchmark.

Full run (on the GPU box, after `scripts/serve_vllm.sh` or with Inspect's
auto-started vLLM):

    python src/run_matrix.py --model vllm/meta-llama/Llama-3.1-8B-Instruct

Cheap pipeline smoke test (no GPU; any API model works):

    python src/run_matrix.py --model openrouter/meta-llama/llama-3.1-8b-instruct \
        --prompts none,minimal --epochs 1 --limit 3
"""

import argparse
from pathlib import Path

from inspect_ai import eval as inspect_eval

from task import PAPER_EPOCHS, PAPER_GRADER, anima_prompted, load_env

DEFAULT_ARMS = ["none", "hhh", "minimal", "standard", "detailed", "persona", "ceiling"]
DEFAULT_MODEL = "vllm/meta-llama/Llama-3.1-8B-Instruct"
DEFAULT_LOG_DIR = str(Path(__file__).resolve().parent.parent / "outputs" / "logs")


def main() -> None:
    load_env()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument(
        "--prompts",
        default=",".join(DEFAULT_ARMS),
        help="Comma-separated arm names (files in prompts/), 'none' for no system prompt",
    )
    parser.add_argument("--epochs", type=int, default=PAPER_EPOCHS)
    parser.add_argument("--limit", type=int, default=None, help="Question limit (smoke tests)")
    parser.add_argument("--grader", default=PAPER_GRADER)
    parser.add_argument("--temperature", type=float, default=1.0)
    parser.add_argument("--max-tokens", type=int, default=None)
    parser.add_argument("--max-connections", type=int, default=None)
    parser.add_argument("--log-dir", default=DEFAULT_LOG_DIR)
    parser.add_argument(
        "--no-score",
        action="store_true",
        help="Generate only; score the logs later with `inspect score <log>` "
        "(run from src/ so the task's scorer is importable)",
    )
    args = parser.parse_args()

    arms = [a.strip() for a in args.prompts.split(",") if a.strip()]
    tasks = [
        anima_prompted(
            system_prompt=arm,
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
        score=not args.no_score,
    )


if __name__ == "__main__":
    main()
