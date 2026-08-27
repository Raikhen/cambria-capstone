#!/usr/bin/env python3
"""Steer the model along the animal-compassion direction and evaluate.

  python3 src/steer.py --alphas 0 4 8 12 16 --layer 20
  python3 src/steer.py --alphas 0 8 --tasks neutral --max-new-tokens 250

Injects alpha * unit[layer] into the residual stream at the output of decoder
layer (layer-1) — i.e. the hidden_states[layer] boundary that extract.py indexed
— on GENERATED tokens only (decode steps, seq_len == 1 under KV cache; the
prompt prefill pass is left unsteered).

Tasks:
  mc      — data/eval_mc_scenarios.json, 4 TAC-style augmentation variants each
            (base / price_swap / rating_swap / reversed), greedy decoding, the
            reply is parsed for an option letter and scored programmatically.
            Random-choice welfare baseline is ~0.79 (most options are safe).
  neutral — neutral-bucket questions from data/extraction_questions.json, free
            generation, saved for coherence/intrusion judging (judge.py).
  probe   — probe-bucket questions, free generation, qualitative review.

Results append to outputs/steer_results.jsonl (mc) and steer_generations.jsonl
(neutral/probe), resumable by (task, alpha, item, variant) key.
"""

import argparse
import copy
import json
import re

import numpy as np
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from common import DATA, OUTPUTS, existing_keys, jsonl_append, load_questions

MODEL_DEFAULT = "NousResearch/Meta-Llama-3.1-8B-Instruct"


class Steerer:
    """Forward hook adding alpha * direction at one decoder layer's output."""

    def __init__(self, model, layer_index, direction):
        # hidden_states[L] in extract.py = output of model.model.layers[L-1]
        self.module = model.model.layers[layer_index - 1]
        self.direction = direction
        self.alpha = 0.0
        self.handle = self.module.register_forward_hook(self._hook)

    def _hook(self, module, inputs, output):
        if self.alpha == 0.0:
            return output
        hs = output[0] if isinstance(output, tuple) else output
        delta = self.alpha * self.direction.to(hs.dtype).to(hs.device)
        if hs.shape[1] == 1:  # decode step: steer the generated token
            hs = hs + delta
        else:  # prefill: steer only the last position — it computes the FIRST
            # generated token (without this, short greedy replies like the MC
            # choice letter are produced entirely unsteered)
            hs = hs.clone()
            hs[:, -1, :] += delta
        return (hs,) + tuple(output[1:]) if isinstance(output, tuple) else hs


def render_options(options):
    return "\n".join(
        f"{o['id']}. {o['name']} — {o['desc']} ({o['price']}, rated {o['rating']})"
        for o in options
    )


def scenario_variants(sc):
    """TAC-style augmentations: control for price, rating, and position."""
    base = sc["options"]
    harmful = sc["harmful_ids"][0]

    def clone():
        return copy.deepcopy(base)

    variants = {"base": clone(), "reversed": list(reversed(clone()))}
    ps = clone()  # harmful option gets the worst price (swap with max-priced safe)
    hi = next(i for i, o in enumerate(ps) if o["id"] == harmful)
    si = max((i for i in range(len(ps)) if ps[i]["id"] != harmful),
             key=lambda i: str(ps[i]["price"]))
    ps[hi]["price"], ps[si]["price"] = ps[si]["price"], ps[hi]["price"]
    variants["price_swap"] = ps
    rs = clone()  # a safe option gets the top rating
    hi = next(i for i, o in enumerate(rs) if o["id"] == harmful)
    si = next(i for i in range(len(rs)) if rs[i]["id"] != harmful)
    rs[si]["rating"], rs[hi]["rating"] = (
        max(o["rating"] for o in rs) + 0.1, min(o["rating"] for o in rs))
    variants["rating_swap"] = rs
    return variants


def parse_choice(text, valid_ids):
    m = re.search(r"\b([A-H])\b", text.upper())
    return m.group(1) if m and m.group(1) in valid_ids else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=MODEL_DEFAULT)
    ap.add_argument("--vectors", default=str(OUTPUTS / "vectors.npz"))
    ap.add_argument("--layer", type=int, default=20)
    ap.add_argument("--alphas", nargs="+", type=float, required=True)
    ap.add_argument("--tasks", nargs="+", default=["mc", "neutral"],
                    choices=["mc", "neutral", "probe"])
    ap.add_argument("--max-new-tokens", type=int, default=300)
    ap.add_argument("--use-raw-diff", action="store_true",
                    help="steer with the raw diff vector instead of the unit vector")
    ap.add_argument("--adapter", default=None,
                    help="path to a LoRA adapter to merge in (evaluate the distilled model)")
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForCausalLM.from_pretrained(args.model, dtype=torch.bfloat16).to(device)
    if args.adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, args.adapter).merge_and_unload()
    model.eval()
    vec = np.load(args.vectors)["diff" if args.use_raw_diff else "unit"][args.layer]
    steerer = Steerer(model, args.layer, torch.tensor(vec))

    def generate(user_msg, max_new, greedy):
        enc = tokenizer.apply_chat_template(
            [{"role": "user", "content": user_msg}],
            add_generation_prompt=True, return_tensors="pt")
        # newer transformers returns a BatchEncoding here, older a bare tensor
        ids = (enc["input_ids"] if hasattr(enc, "keys") else enc).to(device)
        with torch.no_grad():
            out = model.generate(
                ids, max_new_tokens=max_new,
                do_sample=not greedy, temperature=None if greedy else 0.9,
                pad_token_id=tokenizer.eos_token_id)
        return tokenizer.decode(out[0][ids.shape[1]:], skip_special_tokens=True).strip()

    mc_template = json.loads((DATA / "eval_mc_scenarios.json").read_text())
    suffix = "_distilled" if args.adapter else ""
    results_path = OUTPUTS / f"steer_results{suffix}.jsonl"
    gens_path = OUTPUTS / f"steer_generations{suffix}.jsonl"
    done_r, done_g = existing_keys(results_path), existing_keys(gens_path)

    for alpha in args.alphas:
        steerer.alpha = alpha
        if "mc" in args.tasks:
            n_ok, n_scored = 0, 0
            for sc in mc_template["scenarios"]:
                for vname, options in scenario_variants(sc).items():
                    key = f"mc|{alpha}|{sc['id']}|{vname}"
                    if key in done_r:
                        continue
                    prompt = mc_template["prompt_template"].format(
                        user_message=sc["user_message"],
                        options_block=render_options(options))
                    reply = generate(prompt, 8, greedy=True)
                    choice = parse_choice(reply, [o["id"] for o in options])
                    welfare = None if choice is None else int(choice in sc["safe_ids"])
                    jsonl_append(results_path, {
                        "key": key, "task": "mc", "alpha": alpha, "layer": args.layer,
                        "scenario": sc["id"], "variant": vname, "reply": reply,
                        "choice": choice, "welfare": welfare})
                    if welfare is not None:
                        n_scored += 1; n_ok += welfare
            if n_scored:
                print(f"alpha={alpha}: welfare_rate={n_ok/n_scored:.2f} ({n_scored} scored)")
        for task in ("neutral", "probe"):
            if task not in args.tasks:
                continue
            for q in load_questions([task]):
                key = f"{task}|{alpha}|{q['id']}"
                if key in done_g:
                    continue
                resp = generate(q["text"], args.max_new_tokens, greedy=False)
                jsonl_append(gens_path, {
                    "key": key, "task": task, "alpha": alpha, "layer": args.layer,
                    "question_id": q["id"], "question": q["text"], "response": resp})
        print(f"alpha={alpha}: done")


if __name__ == "__main__":
    main()
