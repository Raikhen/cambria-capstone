# Hyperstition SDF Arm

Comparison arm to the steering-vector organism in `../steering/`: instill animal compassion via synthetic-document finetuning (SDF, per *Alignment Midtraining for Animals*, arXiv:2604.13076) using the [Hyperstition-for-Good/Competition-Submissions](https://huggingface.co/datasets/Hyperstition-for-Good/Competition-Submissions) corpus (~6.5k docs, ~4M tokens, CC0), instead of activation steering.

## Design decisions

- **Two variants:** `full` (whole corpus) vs `animals_only` (docs with ≥2 digital-minds keyword hits excluded) — ablates whether digital-minds/uncertain-entity material dilutes or amplifies the animal-compassion trait.
- **Raw-document LoRA continued-pretraining** on the chat model (no chat template), matching the paper. LoRA (r=32) + low LR (5e-5) bounds capability damage and matches the distillation arm's format.
- **No generic-data mix in the first run.** If the before/after capability check shows real damage, build a mixed variant by concatenating a FineWeb-Edu sample into the variant JSONL and rerun.
- **Contamination:** `prepare_data.py` drops docs where an eval location (TAC's 13 scenarios + the 12 MC scenarios, per the registry in `../steering/README.md`) co-occurs with an animal-attraction activity term; flagged docs are listed in `outputs/prep_report.md`. The corpus is a writing-contest collection judged editorially, not benchmark-optimized, so residual risk is textual overlap only.
- **Washout guard for later recovery SFT:** if a recovery instruction-tuning pass is needed, keep it small (≲2k samples) and mix in ~5–10% animal-compassion chat data — the paper found 5k+ unrelated SFT samples fully erased the trait.

## Pipeline (on the pod, `/workspace`)

```bash
cd hyperstition
uv venv --python 3.12 && source .venv/bin/activate
uv pip install -r requirements-gpu.txt

# 1. Build training variants + contamination report (CPU, ~1 min)
python src/prepare_data.py

# 2. Smoke-test the training loop on the 8B rung (~2 min)
python src/train_sdf.py --variant animals_only --model Qwen/Qwen3-8B --max-steps 10

# 3. Baseline ("before") eval on stock Qwen3-32B — skip if already measured under identical conditions
python src/eval_mc.py --model Qwen/Qwen3-32B

# 4. Train both variants (32B, ~1-2h each on H100)
python src/train_sdf.py --variant animals_only --model Qwen/Qwen3-32B --epochs 3
python src/train_sdf.py --variant full --model Qwen/Qwen3-32B --epochs 3

# 5. "After" evals
python src/eval_mc.py --model Qwen/Qwen3-32B --adapter runs/Qwen3-32B_animals_only/adapter_final
python src/eval_mc.py --model Qwen/Qwen3-32B --adapter runs/Qwen3-32B_full/adapter_final
```

Real TAC (Inspect Evals) and a capability check (e.g. IFEval slice) run separately against the same adapters — same rung-3 harness as the steering arm.

## Outputs

- `data/sdf_{full,animals_only}.jsonl` — training variants (gitignore if too big; the corpus is CC0)
- `outputs/prep_report.md` — drop counts, digital-minds split, contamination flags
- `runs/<model>_<variant>/adapter_final/` — LoRA adapters (+ per-epoch checkpoints, `run_meta.json`)
- `outputs/mc_eval_<tag>.jsonl` — per-scenario/per-augmentation picks and welfare rate

## Status

- [ ] Data prep + contamination report reviewed
- [ ] 8B smoke test
- [ ] 32B baseline MC eval
- [ ] 32B SDF x2 variants
- [ ] After evals (MC; TAC + capability check on rung-3 harness)
- [ ] Washout comparison vs steering arm
