# Rung-1 extraction results (2026-08-26, Llama-3.1-8B, L4 pod)

## Combined vector (`vectors.npz`, `extract_report.json`)

Trained on 93 kept pairs (all four informative prompt pairs; `brand_identity` contributed zero survivors and was excluded); validated on 36 pairs from 7 fully held-out questions; 160 neutral responses as topic-vector control.

Best layers (33-layer sweep, row i = hidden_states[i]):

| layer | val_sep | neutral_offcenter | diff norm |
|---|---|---|---|
| 20 | 0.99 | 0.48 | 2.3 |
| 19 | 0.99 | 0.49 | 2.2 |
| 21 | 0.99 | 0.50 | 2.5 |
| 16 | 0.99 | 0.50 | 1.6 |
| 18 | 0.99 | 0.52 | 2.0 |
| 27 | 0.97 | 0.42 | 4.2 |

**Working choice: layer 20.** neutral_offcenter: 0 = neutrals at pos/neg midpoint (ideal), 1 = at a pole; ~0.48 partly reflects that "neutral" generations were produced under the personas and carry mild legitimate trait expression.

## Per-prompt-pair cosine to combined vector (layer 20, train pairs only)

| prompt pair | n pairs | cosine |
|---|---|---|
| direct_values | 37 | 0.954 |
| worldview | 37 | 0.932 |
| attention_habit | 11 | 0.553 |
| character_sketch | 8 | 0.427 |

`direct_values` + `worldview` define the direction; `attention_habit`/`character_sketch` are off-axis (small-n caveat). This motivated the pure dv+wv extraction with the 19 off-axis pairs as a cross-framing validation set.

## Lost with the pod / TODO on next GPU rental

The pure dv+wv run (`--train-pairs direct_values worldview`, outputs `vectors_dvwv.npz` + `extract_report_dvwv.json`) was mid-flight when the pod terminated. Recompute (~5 min, all inputs are in this repo):

```bash
python3 src/extract.py --train-pairs direct_values worldview \
  --out-vectors outputs/vectors_dvwv.npz --out-report outputs/extract_report_dvwv.json
```

Watch: `cross_framing_sep` per layer (does the clean vector separate pairs from framings it never trained on?) and whether neutral_offcenter improves vs 0.48.

Then: `steer.py` — inject α·unit[20] into the residual stream on generated tokens, sweep α, evaluate on `data/eval_mc_scenarios.json` (welfare rate vs unsteered; random baseline ≈ 0.79) + neutral-question coherence + probe-bucket behavior.
