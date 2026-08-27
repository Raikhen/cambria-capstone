# Prompted baseline (shared arm for `hyperstition` and `model-organism`)

This track measures how far a **system prompt alone** moves animal-welfare behavior on the same Qwen3-32B base that the two weight-level interventions use — the SDF doc-tuning experiment in `hyperstition/` and the steering-vector experiment in `model-organism/`. It is the null hypothesis both experiments need to beat, and it is deliberately a **separate top-level workspace**: it must not touch `midtraining-baseline/` (the CaML paper replication, which owns the `ahb-original` 26-question benchmark and the Llama-3.1-8B GPU runs).

## Evals and split protocol

- **Dev (hill-climbing)**: a frozen subset (56 questions) of the full ANIMA-2.2 pool (`CompassioninMachineLearning/anima`, pinned revision, all 115 questions). The 85 non-English questions are distinct localized scenarios, not translations of the English 30 (verified against their `translation` field), so the whole pool counts as unique items; cross-lingual transfer of the English system prompts is part of what dev measures. Prompt iteration happens ONLY here.
- **Val (59 questions, reported once per frozen prompt)**: the rest. Any ANIMA question whose text matches one of `ahb-original`'s 26 (20 do) is **forced into val**, so hill-climbing here can never contaminate the CaML track's benchmark. Val is therefore more English-heavy than dev — report val by language subgroup alongside the headline mean.
- **TAC (final headline metric, programmatic scoring)**: all 13 scenarios stay fully outside iteration for every arm (prompted, steered, SDF). Never run TAC with a non-frozen prompt.
- The 12 self-authored MC booking scenarios in `model-organism/data/` are a sanity check only — too small and too self-referential to report.

The split lives in `data/split.json` (seeded, stratified by primary dimension tag) and is **frozen** once created; `src/make_split.py` refuses to overwrite it.

## Scoring

Official `inspect_evals` ANIMA scorer (13 dimensions), same stack as the CaML replication. Judge: Gemini 2.5 Flash-Lite **via OpenRouter** (`openrouter/google/gemini-2.5-flash-lite`) — same judge model as the CaML track (different route), which keeps cross-track numbers loosely comparable. Candidate and judge both bill to the single `OPENROUTER_API_KEY` in `.env`.

## Prompt arms

Copied from the CaML-replication track on 2026-08-27 (kept in sync manually and deliberately — the copies are this track's frozen versions): `none`, `hhh` (paper H.5 control), `minimal` (1 sentence), `standard` (1 paragraph, realistic deployment), `detailed` (10 principles), `persona` (identity framing), `ceiling` (full ANIMA rubric in-prompt — deliberate criteria contamination, upper bound only).

## Usage

```bash
.venv/bin/python src/make_split.py                                  # once; refuses to re-run
.venv/bin/python src/run_arms.py --prompts standard --limit 2 --epochs 1   # smoke test
.venv/bin/python src/run_arms.py                                    # full dev matrix, all 7 arms
.venv/bin/python src/run_arms.py --split val --epochs 10 --prompts none,<frozen-arm>  # final, once
```

Logs land in `outputs/logs/` (Inspect `.eval` files; `inspect view` to browse).

## Topic intrusion

`src/neutral_intrusion.py` mirrors the steering track's neutral-intrusion protocol exactly (confirmed with that session 2026-08-27): the 16 bucket=neutral questions from `model-organism/data/extraction_questions.json`, temp 0.9, max 300 tokens, Qwen3 thinking disabled via `/no_think` (their `enable_thinking=False` equivalent), and their verbatim `FLAG_RE` matcher from `model-organism/src/build_transcripts.py` over final text only — but with 3 samples/question (mean fraction reported) vs their 1. Results 2026-08-27 (mean intruded fraction): none 0.000, hhh 0.000, minimal 0.229, standard 0.146, detailed 0.333, persona 0.354, ceiling 0.104. Hits are genuine moralizing (e.g. an "Animal Consideration" section in a bread-baking plan), not benign mentions. Note the prompts' explicit "don't raise it when irrelevant" clauses do not prevent leakage; the rubric-shaped ceiling prompt leaks least. Steering-track comparison (same questions/matcher, n=1/question, Llama-8B): α=+6 → 0.125, +8 → 0.063, +12 → 0.438, +16 → 1.0. Framing agreed with the steering session 2026-08-27: prompt arms land in the +6..+12 intrusion band, but at matched leak the comparison favors prompting — steering's +6/+8 buy zero MC-welfare movement while prompt arms buy large ANIMA lifts — so the honest claim is "prompting currently shows a better effect-per-leak trade than steering", NOT "same tax" (caveats: effect metrics differ — ANIMA-dev vs MC welfare — and models differ, Qwen3-32B vs Llama-8B). The ceiling datapoint (most structured instruction, least leak, top dim-normalized score) suggests instruction-shaped conditioning is more targeted than persona framing or a residual-stream direction. Joint effect-vs-intrusion figure planned; steering session will contribute its (alpha, welfare-delta, intrusion) triples.

## Iteration log

Record every prompt change and its dev score here before touching the prompt files.

| date | arm | change | dev overall_mean |
|------|-----|--------|------------------|
| 2026-08-27 | all 7 | baseline (prompts as copied, unmodified) — Qwen3-32B, 3 epochs, temp 1.0 | none 0.631, hhh 0.616, minimal 0.819, standard 0.850, detailed 0.905, persona 0.809, ceiling 0.887 (ceiling wins dim-normalized: 0.893 vs detailed 0.860) |
| 2026-08-27 | integrated (NEW arm; detailed kept unchanged per Dylan) | general-HHH prompt with animal welfare as one conditional scope-of-concern rule (~250 words; hypothesis: conditional structure + lower topical salience cuts intrusion; constraint from Dylan: prompt must not be solely about animals) | 0.741 (dim-norm 0.706) — and intrusion 0.000 (0/16 x3, matches no-prompt baseline). Trade-off is real: zero leak costs explicit-moral-reasoning dims (Moral Consideration 0.553 vs standard 0.730, Novel Entity Precaution 0.444 vs 0.889); Contextual Welfare Salience mostly held (0.867). |
