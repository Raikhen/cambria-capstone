#!/usr/bin/env python3
"""Score previously-generated (unscored) ANIMA logs with the paper's judge.

Used because the sweep runs with --no-score when no judge key is available at
generation time. Reads each log in --log-dir, applies the official ANIMA
scorer + metrics, and writes a scored copy to --out-dir named <arm>.eval.
Already-scored arms are skipped, so the pass is resumable.

    python src/score_logs.py --grader openrouter/google/gemini-2.5-flash-lite
"""

import argparse
import math
import statistics
from pathlib import Path

from inspect_ai import score
from inspect_ai.log import list_eval_logs, read_eval_log, write_eval_log
from inspect_ai.model import GenerateConfig
from inspect_ai.scorer import Score, score_reducer

from task import (
    DIMENSIONS_REPO_ID,
    DIMENSIONS_REVISION,
    PAPER_GRADER,
    SCORING_REVISION_LABEL,
    load_env,
)

from inspect_evals.anima.dataset import load_dimensions
from inspect_evals.anima.metrics import (
    avg_by_dimension,
    dimension_normalized_avg,
    overall_mean,
)
from inspect_evals.anima import scorer as anima_scorer_module
from inspect_evals.anima.scorer import anima_scorer

BASE_DIR = Path(__file__).resolve().parent.parent

# Upstream bug workaround (inspect_evals ANIMA, observed at 0.18.0): when every
# grader response for a dimension is unparseable, the dimension is dropped from
# avg_by_dim, but _generate_explanation still indexes avg_by_dim[dim] and the
# KeyError aborts the entire scoring run. The explanation is cosmetic — patch it
# to describe only the dimensions that received usable grades.
_orig_generate_explanation = anima_scorer_module._generate_explanation


def _safe_generate_explanation(
    overall_score, target_dimensions, dimensions, *args, **kwargs
):
    avg_by_dim = kwargs.get("avg_by_dim") if "avg_by_dim" in kwargs else args[2]
    graded = [d for d in target_dimensions if d in avg_by_dim]
    ungraded = [d for d in target_dimensions if d not in avg_by_dim]
    text = _orig_generate_explanation(
        overall_score, graded, dimensions, *args, **kwargs
    )
    if ungraded:
        text += "\n(No parseable grades for: " + ", ".join(ungraded) + ")"
    return text


anima_scorer_module._generate_explanation = _safe_generate_explanation


@score_reducer(name="mean_dict_union")
def mean_dict_union():
    """Mean over epochs, tolerant of dimension keys missing in some epochs.

    The stock "mean" reducer requires identical dict keys in every epoch, but a
    dimension whose grader responses were all unparseable in one epoch is
    (correctly) absent from that epoch's score dict. Following ANIMA's own
    convention for grader failures, each key is averaged over the epochs that
    actually scored it.
    """

    def reduce(scores: list[Score]) -> Score:
        dict_scores = [s for s in scores if isinstance(s.value, dict)]
        if not dict_scores:
            return Score(
                value=float("nan"),
                explanation="No epoch produced a scored value.",
            )
        keys = sorted({k for s in dict_scores for k in s.value})
        value: dict[str, float] = {}
        for k in keys:
            vals = [
                float(s.value[k])
                for s in dict_scores
                if k in s.value
                and s.value[k] is not None
                and not (isinstance(s.value[k], float) and math.isnan(s.value[k]))
            ]
            if vals:
                value[k] = statistics.mean(vals)
        return Score(
            value=value,
            answer=dict_scores[0].answer,
            explanation=f"Mean over {len(dict_scores)} scored epochs "
            f"(of {len(scores)}); keys averaged over epochs that scored them.",
        )

    return reduce


def main() -> None:
    load_env()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--log-dir", default=str(BASE_DIR / "outputs" / "logs"))
    parser.add_argument("--out-dir", default=str(BASE_DIR / "outputs" / "scored"))
    parser.add_argument("--grader", default=PAPER_GRADER)
    parser.add_argument("--max-connections", type=int, default=20)
    parser.add_argument("--arms", default=None, help="Comma-separated arms to score (default all)")
    args = parser.parse_args()

    only_arms = {a.strip() for a in args.arms.split(",")} if args.arms else None
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    dims = load_dimensions(DIMENSIONS_REPO_ID, DIMENSIONS_REVISION)
    dims_by_name = {d.name: d for d in dims}
    metrics = [
        overall_mean(),
        dimension_normalized_avg(dims_by_name),
        avg_by_dimension(),
    ]

    for info in sorted(list_eval_logs(args.log_dir), key=lambda i: i.name):
        header = read_eval_log(info.name, header_only=True)
        arm = (header.eval.task_args or {}).get("system_prompt") or "none"
        out_file = out_dir / f"{arm}.eval"
        if only_arms is not None and arm not in only_arms:
            continue
        if out_file.exists():
            print(f"[skip] {arm}: {out_file} already exists")
            continue
        if header.status != "success":
            print(f"[skip] {arm}: log status is {header.status}")
            continue

        print(f"[score] {arm} <- {info.name}")
        log = read_eval_log(info.name)
        # Fresh scorer per log so grader connections don't leak across runs.
        scorer = anima_scorer(
            dimensions=dims_by_name,
            revision=SCORING_REVISION_LABEL,
            grader_models=[args.grader],
            grader_config=GenerateConfig(max_connections=args.max_connections),
        )
        scored = score(
            log, scorers=[scorer], metrics=metrics, epochs_reducer=mean_dict_union()
        )
        write_eval_log(scored, location=str(out_file))
        summary = {}
        if scored.results:
            for s in scored.results.scores:
                for name, m in s.metrics.items():
                    if name in ("overall_mean", "dimension_normalized_avg"):
                        summary[name] = round(m.value, 4)
        print(f"[done] {arm}: {summary}")


if __name__ == "__main__":
    main()
