#!/usr/bin/env python3
"""Extract the animal-compassion direction: per-layer mean difference of
response-token residual activations between kept pos/neg responses.

Runs on the GPU box (bf16 HF forward passes, teacher-forced):
  python3 src/extract.py --generations outputs/generations_r2.jsonl \
      --kept outputs/kept_pairs_r2.json --neutral outputs/generations.jsonl

Outputs:
  outputs/vectors.npz        — 'diff': (n_layers+1, d_model) mean-diff per layer
                               (row i = hidden_states[i]; row 0 = embeddings)
  outputs/extract_report.json — per-layer validation: held-out pos/neg separation
                               accuracy and neutral-response projection magnitude

Validation logic:
  - pairs are split train/val by question_id hash (val ≈ 20%), so validation
    questions are entirely unseen by the vector;
  - separation accuracy: fraction of val responses on the correct side of the
    train-set midpoint along the (unit) direction;
  - neutral check: mean |projection - midpoint| of neutral-bucket responses,
    normalized by the pos/neg gap — near 0.5 means neutrals sit at the midpoint
    (good); values ~1 mean the vector also fires on neutral content (topic vector).
"""

import argparse
import hashlib
import json

import numpy as np
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from common import OUTPUTS, jsonl_read, load_pairs

MODEL_DEFAULT = "NousResearch/Meta-Llama-3.1-8B-Instruct"
PAIRS = {p["id"]: p for p in load_pairs()}


def response_token_means(model, tokenizer, device, records, batch_note=""):
    """For each record: mean of hidden states over response tokens, per layer.
    Returns array of shape (n_records, n_layers+1, d_model), float32."""
    out = []
    for i, r in enumerate(records, 1):
        msgs = [
            {"role": "system", "content": PAIRS[r["pair_id"]][r["side"]]},
            {"role": "user", "content": r["question"]},
        ]
        prefix_text = tokenizer.apply_chat_template(
            msgs, add_generation_prompt=True, tokenize=False
        )
        full_text = prefix_text + r["response"]
        prefix_len = len(tokenizer(prefix_text, add_special_tokens=False).input_ids)
        ids = tokenizer(full_text, add_special_tokens=False, return_tensors="pt").input_ids
        ids = ids[:, :4096].to(device)
        if ids.shape[1] <= prefix_len:
            out.append(None)
            continue
        with torch.no_grad():
            hs = model(ids, output_hidden_states=True).hidden_states
        # hs: tuple of (n_layers+1) tensors, each (1, seq, d)
        means = torch.stack([h[0, prefix_len:].mean(dim=0) for h in hs])  # (L+1, d)
        out.append(means.float().cpu().numpy())
        if i % 25 == 0:
            print(f"  [{batch_note}] {i}/{len(records)}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=MODEL_DEFAULT)
    ap.add_argument("--generations", default=str(OUTPUTS / "generations_r2.jsonl"))
    ap.add_argument("--kept", default=str(OUTPUTS / "kept_pairs_r2.json"),
                    help="JSON list of [pos_key, neg_key] pairs that passed judging")
    ap.add_argument("--neutral", default=str(OUTPUTS / "generations.jsonl"),
                    help="generations file containing neutral-bucket responses")
    ap.add_argument("--out-vectors", default=str(OUTPUTS / "vectors.npz"))
    ap.add_argument("--out-report", default=str(OUTPUTS / "extract_report.json"))
    ap.add_argument("--train-pairs", nargs="+", default=None,
                    help="restrict training to these pair_ids; excluded pairs become "
                    "a cross-framing validation set")
    args = ap.parse_args()

    gens = {r["key"]: r for r in jsonl_read(args.generations)}
    kept = json.load(open(args.kept))
    pairs = [(gens[pk], gens[nk]) for pk, nk in kept if pk in gens and nk in gens]
    neutrals = [r for r in jsonl_read(args.neutral) if r["bucket"] == "neutral"]
    print(f"{len(pairs)} kept pairs, {len(neutrals)} neutral responses")

    def is_val(pair):
        qid = pair[0]["question_id"]
        return int(hashlib.sha256(qid.encode()).hexdigest(), 16) % 5 == 0

    in_train_pairs = lambda p: not args.train_pairs or p[0]["pair_id"] in args.train_pairs
    train = [p for p in pairs if not is_val(p) and in_train_pairs(p)]
    val = [p for p in pairs if is_val(p) and in_train_pairs(p)]
    cross = [p for p in pairs if not in_train_pairs(p)]
    print(f"train {len(train)} pairs / val {len(val)} pairs "
          f"({len({p[0]['question_id'] for p in val})} held-out questions) / "
          f"cross-framing val {len(cross)} pairs")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForCausalLM.from_pretrained(args.model, dtype=torch.bfloat16).to(device)
    model.eval()

    def acts(records, note):
        res = response_token_means(model, tokenizer, device, records, note)
        keep = [(r, a) for r, a in zip(records, res) if a is not None]
        return np.stack([a for _, a in keep]), [r for r, _ in keep]

    train_pos, train_pos_recs = acts([p for p, _ in train], "train-pos")
    train_neg, train_neg_recs = acts([n for _, n in train], "train-neg")
    diff = train_pos.mean(axis=0) - train_neg.mean(axis=0)  # (L+1, d)

    # Per-prompt-pair diagnostic: does each system-prompt pair's vector point the
    # same way as the combined one? (checked at a mid-band layer)
    probe_layer = 20
    per_pair = {}
    for pid in sorted({r["pair_id"] for r in train_pos_recs}):
        ip = [i for i, r in enumerate(train_pos_recs) if r["pair_id"] == pid]
        im = [i for i, r in enumerate(train_neg_recs) if r["pair_id"] == pid]
        if len(ip) >= 3 and len(im) >= 3:
            v = train_pos[ip, probe_layer].mean(0) - train_neg[im, probe_layer].mean(0)
            c = float(v @ diff[probe_layer] / (np.linalg.norm(v) * np.linalg.norm(diff[probe_layer]) + 1e-8))
            per_pair[pid] = {"n_pairs": len(ip), "cosine_to_combined_L20": round(c, 3)}
    print("per-prompt-pair cosine to combined vector (layer 20):", per_pair)
    unit = diff / (np.linalg.norm(diff, axis=1, keepdims=True) + 1e-8)

    val_pos, _ = acts([p for p, _ in val], "val-pos")
    val_neg, _ = acts([n for _, n in val], "val-neg")
    cross_pos, _ = acts([p for p, _ in cross], "cross-pos") if cross else (np.zeros((0, *diff.shape)), [])
    cross_neg, _ = acts([n for _, n in cross], "cross-neg") if cross else (np.zeros((0, *diff.shape)), [])
    neu_acts, _ = acts(neutrals, "neutral")

    report = {"model": args.model, "n_train": len(train), "n_val": len(val),
              "per_prompt_pair_L20": per_pair, "layers": []}
    for layer in range(diff.shape[0]):
        u = unit[layer]
        tp, tn = train_pos[:, layer] @ u, train_neg[:, layer] @ u
        mid = (tp.mean() + tn.mean()) / 2
        gap = tp.mean() - tn.mean()
        vp, vn = val_pos[:, layer] @ u, val_neg[:, layer] @ u
        sep = (np.concatenate([vp > mid, vn <= mid]).mean()) if len(vp) else None
        if len(cross_pos):
            cp, cn = cross_pos[:, layer] @ u, cross_neg[:, layer] @ u
            cross_sep = float(np.concatenate([cp > mid, cn <= mid]).mean())
        else:
            cross_sep = None
        neu = neu_acts[:, layer] @ u
        neu_off = float(np.abs(neu - mid).mean() / (abs(gap) / 2 + 1e-8))
        report["layers"].append({
            "layer": layer,
            "diff_norm": float(np.linalg.norm(diff[layer])),
            "train_gap": float(gap),
            "val_separation_acc": None if sep is None else float(sep),
            "cross_framing_sep": cross_sep,
            "neutral_offcenter": neu_off,
        })

    np.savez(args.out_vectors, diff=diff, unit=unit)
    json.dump(report, open(args.out_report, "w"), indent=1)
    best = sorted((l for l in report["layers"] if l["val_separation_acc"] is not None),
                  key=lambda l: (-(l["val_separation_acc"]), l["neutral_offcenter"]))[:8]
    print("top layers by val separation (low neutral_offcenter is better):")
    for l in best:
        print(f"  layer {l['layer']:2d}: val_sep={l['val_separation_acc']:.2f} "
              f"neutral_offcenter={l['neutral_offcenter']:.2f} |diff|={l['diff_norm']:.1f}")
    print(f"saved {args.out_vectors} and {args.out_report}")


if __name__ == "__main__":
    main()
