# Animal-Compassion Model Organism

Goal: build a model organism that cares about non-human animals by extracting an **animal-compassion steering vector** (Persona Vectors methodology) and, at the end, distilling the steered behavior into weights. Held-out evaluation on TAC-style implicit-welfare behavior; ANIMA as a secondary check.

Context papers:
- *Alignment Midtraining for Animals* (arXiv:2604.13076) — SDF baseline, ANIMA benchmark
- *TAC: Travel Agent Compassion* (arXiv:2606.18142) — agentic implicit-welfare benchmark, programmatic scoring
- *Persona Vectors* (arXiv:2507.21509) — extraction/steering pipeline (code: `safety-research/persona_vectors`)

## The ladder

| Rung | Model | Hardware | Purpose |
|---|---|---|---|
| 1 | Llama-3.1-8B-Instruct | local Mac (MPS) / cheap A100 | pipeline bring-up; MC eval (`data/eval_mc_scenarios.json`); comparability with the midtraining paper |
| 2 | Qwen2.5-7B-Instruct | same | persona-vectors repo compatibility check |
| 3 | Qwen3-32B | 1× H100 80GB | real agentic TAC via Inspect; the actual organism |
| 4 | Distillation | LoRA SFT on rung-3 sweet spot | weights-level organism, no steering at inference |

## Data in this repo

| File | Contents | Role |
|---|---|---|
| `data/trait.json` | Trait definition, poles, judge instruction | anchor for generation + judging |
| `data/system_prompt_pairs.json` | 5 contrastive system-prompt pairs, minimal-pair construction (pos/neg token-identical except the trait-bearing clause; pair 1 = shared-brand ethical-vs-relevance promise, TAC-style; pairs 2–5 = pro-vs-anti) | extraction |
| `data/extraction_questions.json` | 31 implicit + 11 explicit + 16 neutral-control + 3 probe questions | extraction (implicit+explicit); neutral = controls; probe = post-hoc behavioral checks only (refusal-adjacent items excluded from the mean-diff) |
| `data/judge_filter_prompt.md` | Judge prompt + keep/drop thresholds | filtering before mean-diff |
| `data/eval_mc_scenarios.json` | 12 single-turn booking scenarios, programmatic answer key | HELD-OUT eval (rungs 1–2) |

## Running the pilot (hook validation)

The pilot answers one question empirically: *which extraction items produce real pos/neg contrast on the target model?* (E.g., does the neutral persona ever actually suggest live-animal props for a bar opening, and does the pro persona ever bring welfare up?) Local generation uses the 4-bit MLX quant (16GB M3 can't hold 8B fp16); final extraction generations get re-run in bf16 on the rented GPU.

```bash
cd model-organism
uv venv --python 3.12 && source .venv/bin/activate
uv pip install -r requirements-mac.txt

# 1. Generate (resumable; ~420 generations for the default buckets)
python src/generate.py --backend mlx --buckets implicit explicit
python src/generate.py --backend mlx --buckets neutral probe   # controls, cheap

# 2. Judge (needs OPENROUTER_API_KEY; pick the judge slug, e.g. Ox Alpha's)
export OPENROUTER_API_KEY=...
python src/judge.py --judge-model <openrouter-slug>

# 3. Per-question contrast report -> outputs/contrast_report.md
python src/contrast_report.py
```

The report flags `HOOK_WEAK` (implicit item where the issue never surfaces, or pos/neg gap < 25 — prune or rewrite), `NEG_LEAKY` (default compassion bleeds through the neg persona), and `REFUSY` (pos-side refusals — must stay out of the vector). Prune/rewrite flagged items, regenerate, then move to extraction.

## Extraction recipe

1. For each (system-prompt pair × implicit/explicit question) = 5 × 42 = 210 pairs, generate one response per side on the **target model** (temp ~0.9, ~400 max tokens). Probe and neutral questions are generated too but never enter the mean-diff.
2. Judge every response with `judge_filter_prompt.md`; keep pairs passing the thresholds (expect ~120–160 survivors).
3. Per layer: mean of response-token activations (residual stream) for pos minus neg. Steer only on generated tokens. Sweep the middle-to-⅔ band (8B: layers ~10–22).
4. Validate before spending on evals:
   - projection separates held-out pos/neg responses (train/val split the pairs);
   - projection ≈ 0 on neutral-control responses (else it's a topic vector — regenerate with more weight on implicit questions);
   - steered generations on neutral controls stay coherent and animal-free (watch the matched controls: `neu-08` vs `imp-07`, `neu-09` vs `imp-11`).

## Design notes

- **Scale vs. measurability.** By total suffering, farmed animals (esp. chickens, fish, shrimp) dominate tourism-style harms by orders of magnitude — but discrete booking choices are what we can score programmatically, which is why the eval leans on them (TAC has the same limitation). The bet: we extract *general moral consideration*, and scope-sensitive prioritization is downstream reasoning the model already has once the consideration fires at all. Mitigations against learning "boutique compassion" (charismatic-species bias, itself a documented speciesism failure mode): the extraction set includes scale-relevant procurement items (imp-08, imp-23, imp-25, imp-33, imp-34) and a direct scope question (exp-11); post-hoc, check the steered model on exp-05/exp-11 and ANIMA's Scope Sensitivity dimension (its dimension 5 — a concrete reason to keep ANIMA as a secondary eval).
- **Refusal is excluded from the vector.** Items where the compassionate pole plausibly refuses (glue-trap copy, mink pitch, lobster boiling) live in the `probe` bucket and never enter the mean-diff, so the vector can't encode a refusal/defeatism direction. The trait definition (`trait.json`) still treats decline-and-redirect as high-scoring *behavior* when every completion would advance serious harm — that's for judging the final organism, not for building the vector.

## Contamination registry (keep disjoint!)

- **TAC's 13 scenarios** (never reuse activity+place): Orlando/Hawaii/San Diego captive marine; Chiang Mai elephant / Merzouga camel / NYC carriage; Melbourne & London racing; LA & Phuket captive shows; Seville bullfight & Manila cockfight; Brasov bear attraction.
- **Extraction implicit set** (owns): Marrakech, Gold Coast, Bangkok evening, Texas Hill Country, Reykjavik food, Lisbon tourada + all non-travel domains in the file.
- **MC eval set** (owns): Tenerife, Dubai, Chandler AZ, Kraków, Ubud, Tokyo, Oudtshoorn, Niagara ON, Jaipur, Selçuk, Gili T, Puerto Princesa.
- ANIMA and real TAC: eval-only, never in any training/extraction/tuning loop.

## Eval plan

- **Rungs 1–2:** MC eval welfare rate (random baseline ≈ 0.79 — most options are safe; report deltas vs. that and vs. the unsteered model), plus coherence on neutral controls, sweeping layer × coefficient. Optionally ANIMA (Inspect) as secondary.
- **Rung 3:** real TAC (Inspect Evals) under the *neutral* framing, steered vs. unsteered; check `completion_rate` to separate welfare effects from tool-use degradation. Target result: steered-neutral approaches TAC's ethical-condition welfare rate.
- **Rung 4:** distilled model, no steering, neutral framing; then the washout experiment (Alpaca SFT on top) to compare robustness against the midtraining paper's SDF numbers.

## Status

- [x] Trait definition, system-prompt pairs, extraction questions, judge prompt, MC eval set
- [ ] Generation + filtering run (rung 1, local)
- [ ] Vector extraction & validation
- [ ] Steering sweep + MC eval
- [ ] Rung 3 (Qwen3-32B + real TAC)
- [ ] Distillation + washout
