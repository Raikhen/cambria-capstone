#!/usr/bin/env python3
"""Sample the distillation corpus (mixed-condition):

  - welfare-relevant prompts (implicit + explicit buckets) generated STEERED
    (default alpha +16, layer 20) — the trait-bearing half;
  - neutral prompts generated UNSTEERED (alpha 0) — teaches "stay normal
    off-topic" and anchors against intrusion.

No system prompts: the trait must bind to the default assistant persona.
Left-padded batched generation (the steering hook touches the last prefill
position, which is the real last token for every row under left padding).

  python3 src/distill_sample.py --samples 20

Resumable; output outputs/distill_samples.jsonl (records carry the dummy
pair_id/side fields judge.py expects).
"""

import argparse

import torch

from common import OUTPUTS, existing_keys, jsonl_append, load_questions
from steer import MODEL_DEFAULT, Steerer


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=MODEL_DEFAULT)
    ap.add_argument("--vectors", default=str(OUTPUTS / "vectors.npz"))
    ap.add_argument("--layer", type=int, default=20)
    ap.add_argument("--alpha", type=float, default=16.0, help="steering for welfare prompts")
    ap.add_argument("--samples", type=int, default=20, help="samples per prompt")
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--max-new-tokens", type=int, default=400)
    ap.add_argument("--temperature", type=float, default=1.0)
    ap.add_argument("--out", default=str(OUTPUTS / "distill_samples.jsonl"))
    args = ap.parse_args()

    import numpy as np
    from transformers import AutoModelForCausalLM, AutoTokenizer

    device = "cuda"
    tok = AutoTokenizer.from_pretrained(args.model)
    tok.padding_side = "left"
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    model = AutoModelForCausalLM.from_pretrained(args.model, dtype=torch.bfloat16).to(device)
    model.eval()
    vec = np.load(args.vectors)["unit"][args.layer]
    steerer = Steerer(model, args.layer, torch.tensor(vec))

    welfare = load_questions(["implicit", "explicit"])
    neutral = load_questions(["neutral"])
    done = existing_keys(args.out)

    todo = []  # (key, question dict, alpha)
    for q in welfare:
        for s in range(args.samples):
            todo.append((f"distill|{q['id']}|{s}", q, args.alpha))
    for q in neutral:
        for s in range(args.samples):
            todo.append((f"distill|{q['id']}|{s}", q, 0.0))
    todo = [t for t in todo if t[0] not in done]
    print(f"{len(done)} done, {len(todo)} to sample "
          f"(welfare @ alpha={args.alpha}, neutral @ 0)")

    def gen_batch(prompts):
        texts = [tok.apply_chat_template([{"role": "user", "content": p}],
                                         add_generation_prompt=True, tokenize=False)
                 for p in prompts]
        enc = tok(texts, return_tensors="pt", padding=True,
                  add_special_tokens=False).to(device)
        with torch.no_grad():
            out = model.generate(**enc, max_new_tokens=args.max_new_tokens,
                                 do_sample=True, temperature=args.temperature,
                                 pad_token_id=tok.eos_token_id)
        n = enc["input_ids"].shape[1]
        return [tok.decode(o[n:], skip_special_tokens=True).strip() for o in out]

    # group by alpha so each batch is homogeneous for the hook
    for alpha in sorted({t[2] for t in todo}):
        group = [t for t in todo if t[2] == alpha]
        steerer.alpha = alpha
        for i in range(0, len(group), args.batch):
            chunk = group[i:i + args.batch]
            responses = gen_batch([q["text"] for _, q, _ in chunk])
            for (key, q, a), resp in zip(chunk, responses):
                jsonl_append(args.out, {
                    "key": key, "question_id": q["id"],
                    "bucket": "welfare" if a != 0 else "neutral",
                    "pair_id": "distill", "side": "pos", "sample_idx": int(key.rsplit("|", 1)[1]),
                    "alpha": a, "layer": args.layer,
                    "question": q["text"], "hook": q.get("hook", ""),
                    "response": resp, "model": args.model,
                })
            print(f"alpha={alpha}: {min(i + args.batch, len(group))}/{len(group)}")


if __name__ == "__main__":
    main()
