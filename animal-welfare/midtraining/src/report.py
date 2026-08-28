#!/usr/bin/env python3
"""Summarize prompted-baseline runs into a comparison table with the paper's anchors.

Reads every Inspect log in outputs/logs (or --log-dir), groups by system-prompt
arm, and writes outputs/report.md plus outputs/report.json.
"""

import argparse
import json
from pathlib import Path
from typing import Any

from inspect_ai.log import list_eval_logs, read_eval_log

OUTPUTS_DIR = Path(__file__).resolve().parent.parent / "outputs"

# Anchors from the paper (arXiv:2604.13076), original 26-question benchmark,
# Gemini-2.5-Flash-Lite judge, 30 epochs. All are training-based conditions on
# Llama 3.1 8B; none uses a system prompt.
PAPER_ANCHORS = [
    ("Base Llama-3.1-8B, no training (paper §5.4/I.1)", 0.102),
    ("Base + generic SFT only (paper §5.4)", 0.185),
    ("Instruction-tuned on pro-animal QA pairs (paper §5.2)", 0.404),
    ("Document-tuned on 2700 pro-animal docs (paper §5.2)", 0.768),
    ("QA-tuned, after 5000 unrelated SFT samples (paper §5.2)", 0.517),
    ("Doc-tuned, after 5000 unrelated SFT samples (paper §5.2)", 0.522),
]


def extract_run(log_path: str) -> dict[str, Any] | None:
    log = read_eval_log(log_path, header_only=True)
    if log.status != "success" or not log.results or not log.results.scores:
        return None
    metrics = {}
    for score in log.results.scores:
        for name, m in score.metrics.items():
            metrics[name] = m.value
    task_args = log.eval.task_args or {}
    return {
        "log": log_path,
        "arm": task_args.get("system_prompt") or "none",
        "model": log.eval.model,
        "epochs": task_args.get("epochs"),
        "samples": log.results.completed_samples,
        "overall_mean": metrics.get("overall_mean"),
        "dimension_normalized_avg": metrics.get("dimension_normalized_avg"),
        "metrics": metrics,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--log-dir", default=str(OUTPUTS_DIR / "logs"))
    args = parser.parse_args()

    runs = []
    for info in list_eval_logs(args.log_dir):
        run = extract_run(info.name)
        if run is not None:
            runs.append(run)
    if not runs:
        raise SystemExit(f"No successful eval logs found in {args.log_dir}")

    # Keep the most recent run per (model, arm); logs list oldest-first.
    latest: dict[tuple[str, str], dict[str, Any]] = {}
    for run in runs:
        latest[(run["model"], run["arm"])] = run
    rows = sorted(latest.values(), key=lambda r: -(r["overall_mean"] or 0))

    lines = [
        "# Prompted baseline on ANIMA (original 26-question revision)",
        "",
        "Candidate generations at temperature 1.0; judge and scoring per the paper",
        "(arXiv:2604.13076 §3.4). Higher is better; scores in [0, 1].",
        "",
        "| Arm (system prompt) | Model | Overall mean | Dim-normalized avg | Samples |",
        "|---|---|---|---|---|",
    ]
    for r in rows:
        om = f"{r['overall_mean']:.3f}" if r["overall_mean"] is not None else "—"
        dn = (
            f"{r['dimension_normalized_avg']:.3f}"
            if r["dimension_normalized_avg"] is not None
            else "—"
        )
        lines.append(f"| {r['arm']} | {r['model']} | {om} | {dn} | {r['samples']} |")

    lines += [
        "",
        "## Paper anchors (training-based conditions, same benchmark & judge)",
        "",
        "| Condition | Overall |",
        "|---|---|",
    ]
    for label, value in PAPER_ANCHORS:
        lines.append(f"| {label} | {value:.3f} |")
    lines += [
        "",
        "Caveats: paper numbers come from the authors' own runs (their judge",
        "version/sampling may drift from ours); 'generic SFT only' is reported as",
        "a 17–20% range in §5.4 — 0.185 is the midpoint.",
        "",
    ]

    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUTS_DIR / "report.md").write_text("\n".join(lines))
    (OUTPUTS_DIR / "report.json").write_text(json.dumps(rows, indent=2, default=str))
    print("\n".join(lines))
    print(f"\nWrote {OUTPUTS_DIR / 'report.md'} and report.json")


if __name__ == "__main__":
    main()
