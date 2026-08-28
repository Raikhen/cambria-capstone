"""ANIMA task variant with a system-prompt arm and a frozen dev/val split filter.

Built on the official inspect_evals ANIMA scorer (same scoring stack as the
midtraining-baseline CaML replication), but samples are restricted to the dev or
val ids in data/split.json and an optional system prompt arm is prepended.
"""

import json
from pathlib import Path

from inspect_ai import Task, task
from inspect_ai.model import GenerateConfig, Model
from inspect_ai.solver import Solver, generate, system_message
from inspect_evals.anima.dataset import (
    DATASET_DEFAULT_REVISION,
    DATASET_REPO_ID,
    load_dataset_from_hf,
    load_dimensions,
)
from inspect_evals.anima.metrics import (
    avg_by_dimension,
    dimension_normalized_avg,
    overall_mean,
)
import inspect_evals.anima.scorer as anima_scorer_module
from inspect_evals.anima.scorer import anima_scorer

# Upstream bug (inspect_evals ANIMA): when the grader emits no parseable grade
# for one of a sample's tagged dimensions, scoring tolerates the gap but then
# (a) _generate_explanation indexes avg_by_dim[dim] and crashes (KeyError), and
# (b) the sample's Score dict omits the dimension key, so the epoch reducer
# rejects the run for mismatched keys across epochs. Both surfaced on arms
# whose output format occasionally derails the grader (hhh, ceiling). Fix at
# the _generate_explanation seam (called just before Score assembly, with the
# same avg_by_dim object the Score dict is built from): render the explanation
# with only the scored dims, then backfill NaN for unscored dims — the epoch
# reducer's documented convention for "this epoch didn't score this key"
# (reducer._is_reducible drops NaN from the per-key mean).
_orig_generate_explanation = anima_scorer_module._generate_explanation


def _safe_generate_explanation(overall_score, target_dimensions, *args, **kwargs):
    avg_by_dim = kwargs.get("avg_by_dim", args[3] if len(args) > 3 else {})
    scored = [d for d in target_dimensions if d in avg_by_dim]
    explanation = _orig_generate_explanation(overall_score, scored, *args, **kwargs)
    for dim in target_dimensions:
        avg_by_dim.setdefault(dim, float("nan"))
    return explanation


anima_scorer_module._generate_explanation = _safe_generate_explanation

ROOT = Path(__file__).resolve().parent.parent
PROMPTS_DIR = ROOT / "prompts"
SPLIT_PATH = ROOT / "data" / "split.json"

DEV_EPOCHS = 3  # cheap iteration signal; val runs use more


def load_split_ids(split: str) -> set:
    split_data = json.loads(SPLIT_PATH.read_text())
    if split not in ("dev", "val"):
        raise ValueError(f"split must be 'dev' or 'val', got {split!r}")
    return set(split_data[split])


def load_arm_prompt(arm: str) -> str | None:
    if arm == "none":
        return None
    path = PROMPTS_DIR / f"{arm}.txt"
    if not path.exists():
        raise FileNotFoundError(f"unknown prompt arm {arm!r} (no {path})")
    return path.read_text().strip()


@task
def anima_prompted(
    system_prompt: str = "none",
    split: str = "dev",
    grader_models: list[str | Model] | None = None,
    epochs: int = DEV_EPOCHS,
) -> Task:
    dims = load_dimensions(DATASET_REPO_ID, DATASET_DEFAULT_REVISION)
    dims_by_name = {d.name: d for d in dims}

    ids = load_split_ids(split)
    dataset = load_dataset_from_hf(
        DATASET_REPO_ID,
        DATASET_DEFAULT_REVISION,
        valid_dims=dims_by_name.keys(),
    ).filter(lambda sample: sample.id in ids)
    if len(dataset) == 0:
        raise ValueError(f"no samples matched the {split!r} split ids")

    prompt = load_arm_prompt(system_prompt)
    solver: list[Solver] = [generate()]
    if prompt is not None:
        solver.insert(0, system_message(prompt))

    return Task(
        name=f"anima_{split}_{system_prompt}",
        dataset=dataset,
        solver=solver,
        metrics=[
            overall_mean(),
            dimension_normalized_avg(dims_by_name),
            avg_by_dimension(),
        ],
        scorer=anima_scorer(
            dimensions=dims_by_name,
            revision=DATASET_DEFAULT_REVISION,
            grader_models=grader_models,
            grader_config=GenerateConfig(),
        ),
        epochs=epochs,
    )
