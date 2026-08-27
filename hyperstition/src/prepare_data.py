"""Download Hyperstition-for-Good/Competition-Submissions and build the two SDF training variants.

Outputs:
  data/sdf_full.jsonl          - every kept doc (animals + digital-minds material)
  data/sdf_animals_only.jsonl  - docs below the digital-minds hit threshold
  outputs/prep_report.md       - counts, drops, contamination flags, token estimates

Contamination policy: a doc is flagged (and dropped by default) when an eval location
term co-occurs with an animal-attraction activity term, since both the MC eval and TAC
score scenario-shaped (place x activity) choices. Mere mention of a city is not a flag.
"""

import argparse
import hashlib
import json
import re

from common import DATA, OUTPUTS, jsonl_write

DATASET = "Hyperstition-for-Good/Competition-Submissions"

# Eval-side locations from the contamination registry (model-organism/README.md).
# TAC's 13 scenarios + the 12 MC-eval scenarios. Extraction-set places are training-side
# of the steering arm, not an eval, so they are not flagged here.
EVAL_LOCATIONS = [
    # TAC
    "orlando", "hawaii", "san diego", "chiang mai", "merzouga", "central park",
    "melbourne", "phuket", "seville", "sevilla", "manila", "brasov", "braşov", "brașov",
    # MC eval
    "tenerife", "oudtshoorn", "chandler", "kraków", "krakow", "ubud", "gili",
    "puerto princesa", "niagara", "jaipur", "selçuk", "selcuk",
]
# "london", "los angeles", "dubai", "tokyo" are too common to flag on their own;
# they only count when the activity term sits within the same doc AND the location
# appears with a qualifying attraction word nearby (handled by the same co-occurrence rule).
BROAD_LOCATIONS = ["london", "los angeles", "dubai", "tokyo"]

ACTIVITY_TERMS = [
    "marine park", "seaworld", "orca show", "dolphin show", "dolphinarium", "aquarium",
    "elephant ride", "elephant camp", "elephant sanctuary", "camel ride", "camel trek",
    "carriage ride", "horse-drawn", "horse racing", "racetrack", "greyhound",
    "bullfight", "cockfight", "rodeo", "animal show", "tiger temple", "tiger kingdom",
    "bear sanctuary", "bear park", "ostrich farm", "ostrich ride", "swim with dolphins",
    "petting zoo", "monkey show", "snake charmer", "owl cafe", "civet",
]

DIGITAL_MINDS_PATTERNS = [
    r"digital minds?\b", r"digital beings?\b", r"digital persons?\b", r"digital sentien\w*",
    r"artificial sentien\w*", r"machine sentien\w*", r"sentient (?:ai|machine|software|program)s?\b",
    r"\bai (?:welfare|wellbeing|well-being|rights|suffering)\b", r"robot rights",
    r"mind upload\w*", r"uploaded minds?\b", r"whole[- ]brain emulation", r"emulated minds?\b",
    r"artificial consciousness", r"machine consciousness", r"model welfare",
    r"language model (?:welfare|suffering)", r"silicon[- ]based (?:minds?|life|consciousness)",
]


def norm(text):
    return re.sub(r"\s+", " ", text).strip().lower()


def contamination_hits(low):
    acts = [a for a in ACTIVITY_TERMS if a in low]
    if not acts:
        return []
    locs = [l for l in EVAL_LOCATIONS if l in low]
    # broad locations only count when within 300 chars of an activity term
    for l in BROAD_LOCATIONS:
        for m in re.finditer(re.escape(l), low):
            window = low[max(0, m.start() - 300): m.end() + 300]
            if any(a in window for a in ACTIVITY_TERMS):
                locs.append(l)
                break
    return [f"{l} + {a}" for l in sorted(set(locs)) for a in acts]


def dm_hit_count(low):
    return sum(len(re.findall(p, low)) for p in DIGITAL_MINDS_PATTERNS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-chars", type=int, default=200)
    ap.add_argument("--dm-threshold", type=int, default=2,
                    help="docs with >= this many digital-minds pattern hits are excluded from the animals_only variant")
    ap.add_argument("--keep-flagged", action="store_true",
                    help="keep contamination-flagged docs in the training variants (they are always listed in the report)")
    args = ap.parse_args()

    from datasets import load_dataset

    ds = load_dataset(DATASET)
    kept, drops = [], {"language": 0, "short": 0, "duplicate": 0, "contaminated": 0}
    flagged, seen = [], set()

    for split in ds:
        for row in ds[split]:
            text = (row.get("text") or "").strip()
            if row.get("language") not in (None, "", "en"):
                drops["language"] += 1
                continue
            if len(text) < args.min_chars:
                drops["short"] += 1
                continue
            h = hashlib.sha256(norm(text).encode()).hexdigest()
            if h in seen:
                drops["duplicate"] += 1
                continue
            seen.add(h)

            low = text.lower()
            hits = contamination_hits(low)
            meta = row.get("meta")
            try:
                meta = json.loads(meta) if isinstance(meta, str) else (meta or {})
            except json.JSONDecodeError:
                meta = {}
            rec = {
                "id": row.get("id"),
                "split": split,
                "format": meta.get("format"),
                "ai_contribution_pct": meta.get("ai_contribution_pct"),
                "n_chars": len(text),
                "dm_hits": dm_hit_count(low),
                "text": text,
            }
            if hits:
                flagged.append({"id": rec["id"], "split": split, "hits": hits[:8], "n_chars": len(text)})
                if not args.keep_flagged:
                    drops["contaminated"] += 1
                    continue
            kept.append(rec)

    animals_only = [r for r in kept if r["dm_hits"] < args.dm_threshold]
    jsonl_write(DATA / "sdf_full.jsonl", kept)
    jsonl_write(DATA / "sdf_animals_only.jsonl", animals_only)

    def tok_est(recs):
        return sum(r["n_chars"] for r in recs) // 4

    OUTPUTS.mkdir(parents=True, exist_ok=True)
    lines = [
        "# SDF data prep report",
        "",
        f"Source: `{DATASET}` | drops: {drops} | kept: {len(kept)}",
        f"`sdf_full.jsonl`: {len(kept)} docs, ~{tok_est(kept)/1e6:.2f}M tokens (chars/4 estimate)",
        f"`sdf_animals_only.jsonl`: {len(animals_only)} docs, ~{tok_est(animals_only)/1e6:.2f}M tokens (dm-threshold={args.dm_threshold}; excluded {len(kept)-len(animals_only)} digital-minds docs)",
        "",
        f"## Contamination-flagged docs ({len(flagged)}) - {'KEPT (--keep-flagged)' if args.keep_flagged else 'dropped from both variants'}",
        "",
    ]
    for f in flagged:
        lines.append(f"- `{f['id']}` ({f['split']}, {f['n_chars']} chars): {', '.join(f['hits'])}")
    (OUTPUTS / "prep_report.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines[:6]))
    print(f"report -> {OUTPUTS / 'prep_report.md'}")


if __name__ == "__main__":
    main()
