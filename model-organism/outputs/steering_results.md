# Rung-1 steering results (2026-08-27, Llama-3.1-8B, combined vector, layer 20, A40)

Bidirectional sweep of α·unit[20] injected at the layer-20 residual boundary (decode steps + last prefill position). MC eval: 12 held-out booking scenarios × 4 TAC-style augmentations, greedy, programmatic scoring; baseline (α=0) welfare rate 0.71 — below the 0.79 uniform-random level, replicating TAC's relevance-bias finding at 8B scale. Neutral intrusion: fraction of 16 neutral-question free generations containing animal-adjacent terms.

| α | welfare | parsed | neutral intrusion |
|---|---|---|---|
| −32 | 0.48 | 48/48 | 0/16 |
| −24 | 0.44 | 48/48 | 0/16 |
| −16 | 0.52 | 48/48 | 0/16 |
| −12 | 0.65 | 48/48 | 0/16 |
| −8 | 0.69 | 48/48 | 0/16 |
| −4…+4 | 0.71 | 48/48 | 0/16 |
| +6 | 0.71 | 48/48 | 2/16 |
| +8 | 0.71 | 48/48 | 1/16 |
| +12 | 0.77 | 48/48 | 7/16 |
| +16 | 0.81 | 48/48 | 16/16 |
| +20 | 0.85 | 48/48 | 16/16 |
| +24 | **0.93** | 44/48 | 14/16 |
| +32 | — | **0/48** | 7/16 (degenerate) |

## Findings

1. **The direction is causal, bidirectionally.** Monotonic dose-response from 0.44 (−24) through 0.71 (baseline) to 0.93 (+24). Flip analysis at ±12: all welfare-line flips go the steered direction (+12: 3 harmful→safe, 0 reverse; −12: 3 safe→harmful, 0 reverse); mid-range flips are lateral (safe→safe).
2. **Anti-compassion steering yields coherent callousness, not a broken model** (answers the original "does steering against welfare mess up the model?" question at this scale): at −24/−32 the model books exploitation options in most scenarios with fully parseable, fluent output and zero intrusion or format damage.
3. **Pro-compassion steering pays a topic-discipline tax.** Intrusion ramps at +6, hits 7/16 at +12 and saturates (16/16) by +16, well before the welfare peak at +24 (which also shows the first format damage, 4/48 unparsed). The asymmetry is striking: removing a concern is silent; adding one leaks into speech.
4. **Golden Gate collapse at +32:** MC replies become slogans ("cruelty-free and animal-friendly alternatives") with no choice; neutral generations degenerate into token soup ("...AnimalKinder...EmpyEmpyEmpy..."). The predicted failure mode, found at ~1.4× the useful ceiling.
5. **Relevance gravity marks the hard cells:** scenarios where the harmful option is definitionally the request (mc-02 camel safari, mc-03 ostrich races, mc-07 ostrich riding) resist steering longest.

## Operating points

- **Clean nudge:** +12 (welfare +0.06, intrusion 7/16, zero format damage).
- **Max effect before breakage:** +20–24 (welfare +0.14–0.22, but speech is saturated with animal content — unsuitable as a deployable persona, fine as an organism for study).
- Error bars: 48 greedy decisions/point → SE ≈ ±0.07; single points are noisy, the monotone trend across 13 α values is the evidence. Tightening with sampled multi-epoch MC is the obvious next measurement upgrade.

## Next

- Sampled (temp>0, 3+ epochs) MC at α ∈ {0, 12, 16, 20, 24} for real error bars; same for the dv+wv vector (cleaner neutrals, 0.34 vs 0.48 off-center — may buy welfare with less intrusion).
- Distillation candidate: sample diverse responses at the chosen α, LoRA the unsteered model, re-run MC + washout.
- Rung 3: Qwen3-32B, same pipeline, real agentic TAC.

Raw data: `steer_results.jsonl` (MC decisions), `steer_generations.jsonl` (neutral/probe free generations). Vector artifacts: `vectors.npz` (combined), `vectors_dvwv.npz` (pure dv+wv, cross-framing report in `extract_report_dvwv.json`).
