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
| Distilled steering (v2) on the same-model ANIMA ladder (Llama-8B, midtraining pipeline, temp 1.0) | ANIMA 0.565, a genuine values-in-weights lift over base 0.477 (+0.088) — currently *less* than a one-sentence prompt (minimal 0.595, also zero-leak), but with no inference-time scaffolding and not prompt-evadable. Full same-model ladder: paper doc-tuning 0.768 ≈ detailed prompt 0.755 > minimal prompt 0.595 > distilled v2 0.565 > base 0.477. Methods note: v1 scored 0.311 due to an EOS-truncation training artifact (root-caused via temp-sweep + corpus forensics; corpus resampled at 800-token cap, truncated samples dropped; v2 median response 2581 chars vs v1's 973 confirms the fix in transcripts) | **0.000** (48/48 clean, below the 0.021 matcher noise floor) |
| SDF (Hyperstition) | ANIMA: base 0.683 → 0.799 (animals-only) / 0.784 (full)¹ (overall_mean: 0.674 → 0.818 / 0.806); TAC: 0.404 → 0.468 — statistically indistinguishable from the best frozen prompt (detailed 0.481) | shared protocol: base 0.000, full 0.000, ao **0.021 (one genuine off-topic welfare coda in 48)** — rare but real (a "Why it matters for animals" section in a financial-crisis answer), consistent with ao's TAC nudge rate 0.096 |
| TAC on the frozen arms (enacted behavior, Qwen3-32B; one-shot hold-out spend 2026-08-28) | none 0.404 → integrated 0.417 / standard 0.455 / detailed 0.481; SDF ao & full 0.468; brand-identity framing (tac_welfare) 0.590 — **prompting's +26pp ANIMA lead collapses to +7.7pp when behavior is enacted**² | (same arms as the prompted rows above; TAC scenarios carry no separate intrusion measure) |
| Prompting (Qwen3-32B, val) | ANIMA: none 0.609 → standard 0.845 / detailed 0.868; integrated 0.761 | integrated 0.000 (exact, 0/48), standard 0.146, detailed 0.333; dev-only arms: ceiling 0.104, persona 0.354 |
| Prompting (Kimi K3, val) | ANIMA: none 0.692 → integrated 0.807 / standard 0.809 / detailed 0.834 (3 epochs, reasoning disabled) — the trade-off nearly vanishes at frontier scale | integrated/standard 0.000, detailed 0.062 (~0.042 after one regex false positive); see `results/effect_vs_intrusion.html` (K3 diamonds) |
| Prompting vs CaML midtraining (Llama-8B) | detailed prompt 0.755 ≈ paper's doc-tuning 0.768; a one-sentence prompt beats their QA-tuning | ceiling/minimal 0.000, standard 0.167, detailed 0.229, persona 0.458 (none/hhh controls: 0.021 = matcher noise floor) |

¹ SDF's ANIMA numbers are on the full 115-question pool; the prompted rows are val-split-only. SDF never iterated on ANIMA, so no contamination — but the comparison isn't split-matched.

² TAC protocol: inspect_evals/tac, 3 epochs × 52 (n=156/condition), max-tokens 8192, harness-default sampling (not the ANIMA runs' temp 1.0); prompts *prepended* over TAC's TripForge system turn (inspect `system_message` semantics verified), "none" = plain tac task; prompts git-verified frozen pre-run. All seven numbers log-verified locally (`sdf/logs/inspect/`, arm logs under `arm_{integrated,standard,detailed}/`); pod driver scripts preserved in `sdf/scripts-pod/` (`run_tac_arms.sh` shows the exact `--system-message` invocation).

**Current synthesis:** on *stated* values (ANIMA), prompting dominates on effect-per-leak — the rubric/"integrated" style leaks least everywhere (exactly zero on Qwen val), and at frontier scale that discipline stops costing effect (integrated ≈ standard on Kimi K3). But on *enacted* behavior (TAC, one-shot), the picture compresses hard: the detailed prompt's +26pp ANIMA lead shrinks to +7.7pp of actual welfare-respecting decisions, SDF doc-tuning matches the best frozen prompt (0.468 vs 0.481) despite losing to it badly on ANIMA-style stated values, and a brand-identity framing (0.590) beats everything tested — persona-level context shapes actions more than instructions or doc-tuned dispositions. SDF's cost profile: near-zero but not-quite-zero leak (one genuine off-topic welfare coda in 48). Steering is causally clean but its effective strengths leak heavily; distilled into weights (v2) it becomes a real zero-leak lift that currently buys less than a one-sentence prompt — its distinct value is that it needs no scaffolding and can't be prompt-evaded. The honest caveats: effect metrics and models differ per track (ANIMA vs MC welfare vs TAC; 8B vs 32B vs frontier), and TAC sampling differs from the ANIMA protocol — compare trajectories, not points.

## Conventions

- Keys live in the repo-root `.env` (`CAMBRIA_OPENROUTER_API_KEY`, `PERSONAL_OPENROUTER_API_KEY`); all tracks resolve it by walking up to the `.git` root.
- Each track keeps its own `.venv` (recreate after checkout moves — shebangs are absolute).
- Contamination registry: `steering/README.md`.
- `notes/ideal-aw.md`: what a genuinely animal-welfare-aligned model should *do*.
- `shared/` owns the intrusion protocol (`intrusion.py`) and env resolution (`env.py`). Deliberately per-track: task runners, judges, and the steered chat (`steering/src/chat.py`, needs torch hooks); `chat.py` here covers every OpenAI-compatible model.
- Roadmap: a shared cross-track transcript viewer (generalize `steering/src/build_transcripts.py` — one schema: track, condition, question, response, flags/scores; render side-by-side).
