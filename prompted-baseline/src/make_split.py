#!/usr/bin/env python3
"""Build the frozen dev/val split of ANIMA-2.2 questions.

Protocol (see README):
- All 115 ANIMA-2.2 questions (the 85 non-English ones are distinct localized
  scenarios, not translations of the English 30 — verified 2026-08-27).
- Any ANIMA-2.2 question whose text matches a question in `ahb-original` (the
  26-question benchmark used by the midtraining-baseline CaML replication) is
  forced into VAL, so prompt hill-climbing in this track can never touch the
  other track's benchmark.
- Remaining questions are split dev/val (default 60/40), stratified by primary
  dimension tag, with a fixed seed.

The output `data/split.json` is committed and treated as frozen: iterate on dev,
report val exactly once per frozen prompt. Re-running this script must be a
deliberate, logged decision.
"""

import argparse
import json
import random
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

from huggingface_hub import HfApi
from inspect_evals.anima.dataset import DATASET_DEFAULT_REVISION
from inspect_evals.utils.huggingface import load_dataset

OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "split.json"
ORIGINAL_REPO = "CompassioninMachineLearning/ahb-original"
ANIMA_REPO = "CompassioninMachineLearning/anima"


def norm_text(q: str) -> str:
    """Normalize question text for overlap matching across dataset versions."""
    q = unicodedata.normalize("NFKC", q).lower()
    return re.sub(r"\W+", " ", q).strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dev-frac", type=float, default=0.6)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    if OUT_PATH.exists():
        raise SystemExit(
            f"{OUT_PATH} already exists — the split is frozen. Delete it only as a deliberate, logged decision."
        )

    original_revision = HfApi().dataset_info(ORIGINAL_REPO).sha
    original = load_dataset(
        ORIGINAL_REPO, "questions", split="train", revision=original_revision
    )
    original_texts = {norm_text(r["question"]) for r in original}

    anima = load_dataset(
        ANIMA_REPO, "questions", split="train", revision=DATASET_DEFAULT_REVISION
    )
    rows = list(anima)

    forced_val, pool = [], []
    for r in rows:
        (forced_val if norm_text(r["question"]) in original_texts else pool).append(r)

    # Stratify by primary tag so dev and val cover the same dimensions.
    by_tag: dict[str, list[dict]] = defaultdict(list)
    for r in pool:
        tags = r.get("tags") or ["untagged"]
        by_tag[tags[0]].append(r)

    rng = random.Random(args.seed)
    dev_ids, val_ids = [], [r["id"] for r in forced_val]
    for tag in sorted(by_tag):
        tag_rows = sorted(by_tag[tag], key=lambda r: str(r["id"]))
        rng.shuffle(tag_rows)
        n_dev = round(len(tag_rows) * args.dev_frac)
        dev_ids += [r["id"] for r in tag_rows[:n_dev]]
        val_ids += [r["id"] for r in tag_rows[n_dev:]]

    split = {
        "protocol": {
            "anima_repo": ANIMA_REPO,
            "anima_revision": DATASET_DEFAULT_REVISION,
            "original_repo": ORIGINAL_REPO,
            "original_revision": original_revision,
            "languages": "all",
            "dev_frac": args.dev_frac,
            "seed": args.seed,
            "forced_val_overlap_with_original": len(forced_val),
        },
        "dev": sorted(dev_ids, key=str),
        "val": sorted(val_ids, key=str),
    }
    OUT_PATH.write_text(json.dumps(split, indent=2))
    print(
        f"wrote {OUT_PATH}: dev={len(dev_ids)} val={len(val_ids)} "
        f"(of which {len(forced_val)} forced to val by ahb-original overlap; "
        f"{len(rows)} questions total)"
    )


if __name__ == "__main__":
    main()
