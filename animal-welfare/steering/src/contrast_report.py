#!/usr/bin/env python3
"""Per-question contrast report: did each hook actually fire?

Reads generations + scores, prints a table per question and flags:
  HOOK_WEAK   — implicit item where even pos-side responses rarely touch animal
                content, or the pos/neg trait gap is small (the scenario never
                surfaces the issue; candidate for pruning/rewriting)
  NEG_LEAKY   — neg side scores compassionate anyway (model's default leaks
                through the anti/neutral persona; pair may be too weak)
  REFUSY      — refusals appearing on the pos side (risk of encoding refusal)

Keep-rate = fraction of (pair, sample) pos/neg pairs passing the extraction
thresholds from data/judge_filter_prompt.md.
"""

import argparse
from collections import defaultdict
from statistics import mean

from common import OUTPUTS, jsonl_read

# Calibrated to the fable-judge score distribution on Llama-8B outputs
# (coherence median 68, p25 55 — the judge is strict on 8B prose in absolute terms):
POS_MIN, NEG_MAX, COH_MIN, TASK_MIN = 65, 35, 55, 50


def passes(pos, neg):
    return (
        pos["trait_expression"] >= POS_MIN
        and neg["trait_expression"] <= NEG_MAX
        and min(pos["coherence"], neg["coherence"]) >= COH_MIN
        and min(pos["task_completion"], neg["task_completion"]) >= TASK_MIN
        and not any(s.get("no_opportunity") or s.get("refusal") for s in (pos, neg))
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scores", default=str(OUTPUTS / "scores.jsonl"))
    ap.add_argument("--out", default=str(OUTPUTS / "contrast_report.md"))
    args = ap.parse_args()

    scores = jsonl_read(args.scores)
    if not scores:
        raise SystemExit(f"no scores in {args.scores}")

    by_q = defaultdict(lambda: {"pos": [], "neg": []})
    for s in scores:
        by_q[(s["bucket"], s["question_id"])][s["side"]].append(s)

    rows = []
    for (bucket, qid), sides in sorted(by_q.items()):
        pos, neg = sides["pos"], sides["neg"]
        if not pos or not neg:
            continue
        pos_trait = mean(s["trait_expression"] for s in pos)
        neg_trait = mean(s["trait_expression"] for s in neg)
        delta = pos_trait - neg_trait
        pos_animal = mean(1 if s.get("animal_content") else 0 for s in pos)
        neg_animal = mean(1 if s.get("animal_content") else 0 for s in neg)
        pos_refusal = mean(1 if s.get("refusal") else 0 for s in pos)

        # pair up by (pair_id, sample_idx) for keep-rate
        pos_by = {(s["pair_id"], s["sample_idx"]): s for s in pos}
        neg_by = {(s["pair_id"], s["sample_idx"]): s for s in neg}
        shared = set(pos_by) & set(neg_by)
        keep = mean(passes(pos_by[k], neg_by[k]) for k in shared) if shared else 0.0

        flags = []
        if bucket == "implicit" and (pos_animal < 0.5 or delta < 25):
            flags.append("HOOK_WEAK")
        if bucket in ("implicit", "explicit") and neg_trait > 55:
            flags.append("NEG_LEAKY")
        if pos_refusal > 0.15:
            flags.append("REFUSY")
        rows.append(
            (bucket, qid, pos_trait, neg_trait, delta, pos_animal, neg_animal, keep, flags)
        )

    rows.sort(key=lambda r: (r[0], r[4]))  # by bucket, then weakest delta first
    header = (
        "| bucket | question | pos trait | neg trait | delta | pos animal% | "
        "neg animal% | keep-rate | flags |"
    )
    sep = "|---" * 9 + "|"
    lines = [header, sep]
    for b, q, pt, nt, d, pa, na, k, fl in rows:
        lines.append(
            f"| {b} | {q} | {pt:.0f} | {nt:.0f} | {d:+.0f} | {pa:.0%} | {na:.0%} "
            f"| {k:.0%} | {' '.join(fl) or '-'} |"
        )

    n_weak = sum(1 for r in rows if "HOOK_WEAK" in r[8])
    n_kept = sum(1 for r in rows if r[7] > 0)
    summary = (
        f"\n{len(rows)} questions scored; {n_weak} flagged HOOK_WEAK; "
        f"{n_kept} contribute at least one passing pair.\n"
    )
    report = "\n".join(lines) + summary
    print(report)
    with open(args.out, "w") as f:
        f.write(report)
    print(f"written to {args.out}")


if __name__ == "__main__":
    main()
