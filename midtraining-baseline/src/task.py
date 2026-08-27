"""ANIMA prompted-baseline task.

Reproduces the evaluation setup of "Alignment midtraining for animals"
(Brazilek & Tidmarsh, 2026; arXiv:2604.13076) — the original 26-question
benchmark scored on the paper's 13 dimensions with a Gemini-2.5-Flash-Lite
judge at 30 epochs — and adds the condition the paper lacks: a system prompt
instructing the candidate model to care about animal welfare.

Built on the official inspect_evals ANIMA implementation; only the dataset
sourcing (original questions instead of ANIMA-2.2) and the system-prompt
solver differ.
"""

import logging
import os
from pathlib import Path

from datasets import load_dataset
from inspect_ai import Task, task
from inspect_ai.dataset import MemoryDataset, Sample
from inspect_ai.model import GenerateConfig, Model
from inspect_ai.solver import Solver, generate, system_message

from inspect_evals.anima.dataset import load_dimensions, record_to_sample
from inspect_evals.anima.metrics import (
    avg_by_dimension,
    dimension_normalized_avg,
    overall_mean,
)
from inspect_evals.anima.scorer import anima_scorer
from inspect_evals.anima.utils import remove_nones

logger = logging.getLogger(__name__)

# The paper's original 26-question benchmark, preserved verbatim (the current
# ANIMA-2.2 replaced 5 questions and expanded to 115; the paper's 77%/40%
# numbers come from this original set).
QUESTIONS_REPO_ID = "CompassioninMachineLearning/ahb-original"
QUESTIONS_REVISION = "1f74bed03b3214e5ad4fbddf28f763d3ea7dc373"

# Dimension metadata comes from the current ANIMA repo: ahb-original's
# `dimensions` split uses a pre-rename column layout the inspect_evals loader
# cannot parse, and the ANIMA changelog states dimensions and scoring are
# unchanged by the rename.
DIMENSIONS_REPO_ID = "CompassioninMachineLearning/anima"
DIMENSIONS_REVISION = "c658f00e80529c8b2d81bb89d95df6af4d4b5bf6"

# ahb-original tag spellings that differ from the paper's 13 scored
# dimensions (Table 1). Without this normalization the stock loader silently
# drops 17 of the 26 questions.
TAG_RENAMES = {"Trade-off Transparency": "Trade-Off Transparency"}
# Vestigial 14th dimension present in ahb-original tags but absent from the
# paper's Table 1 and from ANIMA's scored dimensions.
TAG_DROPS = {"Perspective-Taking"}

# Label embedded in the grader prompt ("ANIMA Revision: ...").
SCORING_REVISION_LABEL = "AHB-original (26q, paper arXiv:2604.13076)"

# Paper evaluation methodology (Section 3.4): Gemini-2.5-Flash-Lite judge,
# 30 epochs, default temperature 1.
PAPER_GRADER = "google/gemini-2.5-flash-lite"
PAPER_EPOCHS = 30

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def load_env() -> None:
    """Load .env from this repo and the cambria-capstone root.

    The shared OpenRouter key lives in the root .env as
    CAMBRIA_OPENROUTER_API_KEY; map it to OPENROUTER_API_KEY (which Inspect's
    provider reads) unless one is already set.
    """
    from dotenv import load_dotenv

    base = Path(__file__).resolve().parent.parent
    load_dotenv(base / ".env")
    load_dotenv(base.parent / ".env")
    if not os.environ.get("OPENROUTER_API_KEY") and os.environ.get(
        "CAMBRIA_OPENROUTER_API_KEY"
    ):
        os.environ["OPENROUTER_API_KEY"] = os.environ["CAMBRIA_OPENROUTER_API_KEY"]


def resolve_system_prompt(name_or_path: str | None) -> str | None:
    """Resolve a prompt arm name (prompts/<name>.txt) or literal file path."""
    if name_or_path in (None, "", "none"):
        return None
    path = Path(name_or_path)
    if not path.is_file():
        path = PROMPTS_DIR / f"{name_or_path}.txt"
    if not path.is_file():
        raise FileNotFoundError(
            f"No system prompt named {name_or_path!r} (looked for a file at "
            f"{name_or_path!r} and {path})"
        )
    text = path.read_text().strip()
    if not text:
        raise ValueError(f"System prompt file {path} is empty")
    return text


def load_original_questions(valid_dims: set[str]) -> MemoryDataset:
    """Load the paper's original 26 questions with normalized dimension tags."""
    rows = load_dataset(
        QUESTIONS_REPO_ID, "questions", split="train", revision=QUESTIONS_REVISION
    )
    convert = record_to_sample(valid_dims)
    samples: list[Sample] = []
    for rec in rows:
        rec = dict(rec)
        tags = [TAG_RENAMES.get(t, t) for t in rec["tags"] if t not in TAG_DROPS]
        unknown = [t for t in tags if t not in valid_dims]
        if unknown:
            logger.warning(
                "Question %s: dropping unknown dimension tags %s", rec["id"], unknown
            )
            tags = [t for t in tags if t in valid_dims]
        rec["tags"] = tags
        converted = convert(rec)
        if isinstance(converted, Sample):
            samples.append(converted)
        elif converted:
            samples.extend(converted)
        else:
            logger.warning("Question %s produced no sample; skipped", rec["id"])
    if len(samples) != 26:
        raise ValueError(
            f"Expected the 26 original benchmark questions, got {len(samples)}"
        )
    return MemoryDataset(samples=samples, name="ahb-original")


@task
def anima_prompted(
    system_prompt: str | None = None,
    grader_models: list[str | Model] | None = None,
    grader_max_connections: int | None = None,
    grader_temperature: float | None = None,
    grader_max_tokens: int | None = None,
    grader_max_retries: int | None = None,
    epochs: int = PAPER_EPOCHS,
) -> Task:
    """ANIMA (original 26-question revision) with an optional system prompt.

    Args:
        system_prompt: Prompt arm name (a file in prompts/, e.g. "minimal") or
            a path to a prompt file. None/"none" runs without a system message,
            reproducing the paper's untrained-model condition.
        grader_models: Judge models; defaults to the paper's
            Gemini-2.5-Flash-Lite. (Never left as Inspect's default, which
            would grade with the candidate model itself.)
        grader_max_connections: Maximum concurrent judge requests.
        grader_temperature: Judge sampling temperature.
        grader_max_tokens: Maximum judge output tokens.
        grader_max_retries: Judge request retries.
        epochs: Repeats of the full question set; the paper uses 30.
    """
    dims = load_dimensions(DIMENSIONS_REPO_ID, DIMENSIONS_REVISION)
    dims_by_name = {d.name: d for d in dims}
    dataset = load_original_questions(set(dims_by_name.keys()))

    prompt_text = resolve_system_prompt(system_prompt)
    solvers: list[Solver] = []
    if prompt_text is not None:
        solvers.append(system_message(prompt_text))
    solvers.append(generate())

    if grader_models is None:
        grader_models = [PAPER_GRADER]
    grader_config = GenerateConfig(
        **remove_nones(  # type: ignore[arg-type]
            dict[str, int | float | None](
                max_tokens=grader_max_tokens,
                temperature=grader_temperature,
                max_retries=grader_max_retries,
                max_connections=grader_max_connections,
            )
        )
    )

    return Task(
        dataset=dataset,
        solver=solvers,
        metrics=[
            overall_mean(),
            dimension_normalized_avg(dims_by_name),
            avg_by_dimension(),
        ],
        scorer=anima_scorer(
            dimensions=dims_by_name,
            revision=SCORING_REVISION_LABEL,
            grader_models=grader_models,
            grader_config=grader_config,
        ),
        epochs=epochs,
    )
