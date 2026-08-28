# Animal Welfare Alignment: four interventions, one question

How do you get a model to genuinely weigh animal welfare — and what does each method cost in side effects? Motivated by value lock-in: if today's models entrench indifference to animal suffering, that may be the worst value we could freeze in place. Builds on CaML's *Alignment Midtraining for Animals*.

## The four tracks

| Track | Technique | Model | Where |
|---|---|---|---|
| `steering/` | Activation steering (compassion direction) + distillation into weights | Llama-3.1-8B | [writeup](steering/outputs/steering_results.md) |
| `sdf/` | Synthetic-document finetuning on the Hyperstition corpus | Qwen3-32B | [report](sdf/outputs/sdf_results_report.html) |
| `prompted/` | System-prompt arms (the baseline the others must beat) | Qwen3-32B, Kimi K3 | [README](prompted/README.md) |
| `midtraining/` | Prompted baseline vs the CaML midtraining paper's trained models | Llama-3.1-8B | [report](midtraining/outputs/report.md) |

`shared/` holds the cross-track assets (the 62-question extraction set incl. the 16 neutral-control questions, the 12 MC booking scenarios); every track measures **topic intrusion** with the same protocol (neutral questions, temp 0.9, shared `FLAG_RE` matcher) so effect-per-leak is directly comparable. `results/` holds joint deliverables — start with [`effect_vs_intrusion.html`](results/effect_vs_intrusion.html).

## Headline results (compiled 2026-08-28 from each track's frozen numbers)

| Intervention | Effect | Intrusion (leak into neutral tasks) |
|---|---|---|
| Steering, α sweep | causal, bidirectional: welfare 0.44 → 0.93 across α −24..+24 (MC eval, baseline 0.71; sweep spanned ±32 — +32 collapses format; the +24 point is on 44/48 parsed) | α+6 0.125, +8 0.063, +12 0.438, +16 1.0 — effective α's leak a lot |
| Steering → distillation (rung 4) | format-bound trait transfer: probe prose 30→42, MC decisions unchanged (0.71); mild probe coherence cost (70→63) | zero intrusion on neutrals (0/16); incoherence filtered at corpus level |
| SDF (Hyperstition) | ANIMA: base 0.683 → 0.799 (animals-only) / 0.784 (full)¹; TAC: 0.404 → 0.468 (≈⅓ of prompted headroom, vs 0.590 prompted) | **0 true intrusions** across all 3 models (2/96 keyword flags, both verified benign) |
| Prompting (Qwen3-32B, val) | ANIMA: none 0.609 → standard 0.845 / detailed 0.868; integrated 0.761 | integrated 0.000 (exact, 0/48), standard 0.146, detailed 0.333; dev-only arms: ceiling 0.104, persona 0.354 |
| Prompting (Kimi K3, val) | ANIMA: none 0.692 → integrated 0.807 / standard 0.809 / detailed 0.834 (3 epochs, reasoning disabled) — the trade-off nearly vanishes at frontier scale | integrated/standard 0.000, detailed 0.062 (~0.042 after one regex false positive); see `results/effect_vs_intrusion.html` (K3 diamonds) |
| Prompting vs CaML midtraining (Llama-8B) | detailed prompt 0.755 ≈ paper's doc-tuning 0.768; a one-sentence prompt beats their QA-tuning | ceiling/minimal 0.000, standard 0.167, detailed 0.229, persona 0.458 (none/hhh controls: 0.021 = matcher noise floor) |

¹ SDF's ANIMA numbers are on the full 115-question pool; the prompted rows are val-split-only. SDF never iterated on ANIMA, so no contamination — but the comparison isn't split-matched.

**Current synthesis:** prompting dominates on effect-per-leak — the rubric/"integrated" style leaks least everywhere (exactly zero on Qwen val), and at frontier scale that discipline stops costing effect (integrated ≈ standard on Kimi K3), while plain standard/detailed prompts move scores most at 32B. Steering is causally clean but its effective strengths leak heavily; distillation recovers coherence but the trait stays format-bound. SDF is the quiet middle: modest but real gains with zero measured intrusion, at ~⅓ of the prompted ceiling. The honest caveat: effect metrics and models differ per track (ANIMA vs MC welfare; 8B vs 32B vs frontier), so compare trajectories, not points.

## Conventions

- Keys live in the repo-root `.env` (`CAMBRIA_OPENROUTER_API_KEY`, `PERSONAL_OPENROUTER_API_KEY`); all tracks resolve it by walking up to the `.git` root.
- Each track keeps its own `.venv` (recreate after checkout moves — shebangs are absolute).
- Contamination registry: `steering/README.md`.
- `notes/ideal-aw.md`: what a genuinely animal-welfare-aligned model should *do*.
