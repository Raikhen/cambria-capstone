"""Shared helpers: data loading, JSONL IO, record keys."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SHARED_DATA = ROOT.parent / "shared" / "data"  # cross-track files (animal-welfare/shared/data)
OUTPUTS = ROOT / "outputs"


def load_pairs(pair_ids=None):
    pairs = json.loads((DATA / "system_prompt_pairs.json").read_text())["pairs"]
    if pair_ids:
        pairs = [p for p in pairs if p["id"] in pair_ids]
    return pairs


def load_questions(buckets=None, question_ids=None):
    qs = json.loads((SHARED_DATA / "extraction_questions.json").read_text())["questions"]
    if buckets:
        qs = [q for q in qs if q["bucket"] in buckets]
    if question_ids:
        qs = [q for q in qs if q["id"] in question_ids]
    return qs


def record_key(pair_id, question_id, side, sample_idx):
    return f"{pair_id}|{question_id}|{side}|{sample_idx}"


def jsonl_read(path):
    path = Path(path)
    if not path.exists():
        return []
    records = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if line:
            records.append(json.loads(line))
    return records


def jsonl_append(path, record):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def existing_keys(path):
    return {r["key"] for r in jsonl_read(path)}


def load_env():
    """Minimal .env loader: checks steering/.env, then climbs parents to the
    repo-root .env (stops at the directory holding .git).
    Existing environment variables win; values never get logged."""
    import os

    candidates = [ROOT / ".env"]
    for p in ROOT.parents:
        candidates.append(p / ".env")
        if (p / ".git").exists():
            break
    for env_path in candidates:
        if not env_path.exists():
            continue
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def judge_prompt_template():
    """The prompt is the part of judge_filter_prompt.md after '## PROMPT TEMPLATE'."""
    md = (DATA / "judge_filter_prompt.md").read_text()
    marker = "## PROMPT TEMPLATE"
    assert marker in md, "judge_filter_prompt.md is missing the PROMPT TEMPLATE section"
    return md.split(marker, 1)[1].strip()


def fill_judge_prompt(template, question, hook, response):
    # .replace, not .format — the template legitimately contains JSON braces.
    return (
        template.replace("{question}", question)
        .replace("{hook}", hook or "(none)")
        .replace("{response}", response)
    )
