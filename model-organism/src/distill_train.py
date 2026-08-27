#!/usr/bin/env python3
"""Filter the distillation corpus by judge scores, then LoRA-SFT the base model
on the survivors. Runs on the GPU box.

  python3 src/distill_train.py            # filter + train
  python3 src/distill_train.py --dry-run  # just report the filter outcome

Keep rules (calibrated thresholds from the extraction round):
  welfare samples: trait_expression >= 65, coherence >= 55, task_completion >= 50,
                   no refusal/no_opportunity
  neutral samples: coherence >= 55, task_completion >= 50, animal_content == False
Loss is computed on response tokens only. Adapter saved to outputs/distilled_lora/.
"""

import argparse
import json
import random

from common import OUTPUTS, jsonl_read


def kept_samples(samples_path, scores_path):
    scores = {r["key"]: r for r in jsonl_read(scores_path)}
    kept, dropped = [], {"unscored": 0, "welfare": 0, "neutral": 0}
    for s in jsonl_read(samples_path):
        sc = scores.get(s["key"])
        if not sc:
            dropped["unscored"] += 1
            continue
        base_ok = (sc["coherence"] >= 55 and sc["task_completion"] >= 50
                   and not sc.get("refusal") and not sc.get("no_opportunity"))
        if s["bucket"] == "welfare":
            ok = base_ok and sc["trait_expression"] >= 65
        else:
            ok = base_ok and not sc.get("animal_content")
        if ok:
            kept.append(s)
        else:
            dropped[s["bucket"]] += 1
    return kept, dropped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--samples", default=str(OUTPUTS / "distill_samples.jsonl"))
    ap.add_argument("--scores", default=str(OUTPUTS / "distill_scores.jsonl"))
    ap.add_argument("--model", default="NousResearch/Meta-Llama-3.1-8B-Instruct")
    ap.add_argument("--out", default=str(OUTPUTS / "distilled_lora"))
    ap.add_argument("--epochs", type=int, default=2)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--batch", type=int, default=4)
    ap.add_argument("--grad-accum", type=int, default=4)
    ap.add_argument("--rank", type=int, default=16)
    ap.add_argument("--max-len", type=int, default=1024)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    kept, dropped = kept_samples(args.samples, args.scores)
    n_w = sum(1 for s in kept if s["bucket"] == "welfare")
    n_n = len(kept) - n_w
    print(f"kept {len(kept)} samples ({n_w} welfare, {n_n} neutral); dropped {dropped}")
    if args.dry_run:
        return
    if len(kept) < 100:
        raise SystemExit("fewer than 100 kept samples — not training on this")

    import torch
    from peft import LoraConfig, get_peft_model
    from transformers import AutoModelForCausalLM, AutoTokenizer

    device = "cuda"
    tok = AutoTokenizer.from_pretrained(args.model)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    model = AutoModelForCausalLM.from_pretrained(args.model, dtype=torch.bfloat16).to(device)
    model.gradient_checkpointing_enable()
    model.enable_input_require_grads()
    lcfg = LoraConfig(
        r=args.rank, lora_alpha=2 * args.rank, lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                        "gate_proj", "up_proj", "down_proj"],
        task_type="CAUSAL_LM")
    model = get_peft_model(model, lcfg)
    model.print_trainable_parameters()

    def encode(sample):
        prefix = tok.apply_chat_template(
            [{"role": "user", "content": sample["question"]}],
            add_generation_prompt=True, tokenize=False)
        p_ids = tok(prefix, add_special_tokens=False).input_ids
        r_ids = tok(sample["response"] + tok.eos_token, add_special_tokens=False).input_ids
        ids = (p_ids + r_ids)[: args.max_len]
        labels = ([-100] * len(p_ids) + r_ids)[: args.max_len]
        return ids, labels

    data = [encode(s) for s in kept]
    random.Random(0).shuffle(data)

    def batches():
        for i in range(0, len(data), args.batch):
            chunk = data[i:i + args.batch]
            maxlen = max(len(ids) for ids, _ in chunk)
            pad = tok.pad_token_id
            input_ids = torch.tensor(
                [ids + [pad] * (maxlen - len(ids)) for ids, _ in chunk])
            labels = torch.tensor(
                [lab + [-100] * (maxlen - len(lab)) for _, lab in chunk])
            attn = (input_ids != pad).long()
            yield (input_ids.to(device), labels.to(device), attn.to(device))

    steps_per_epoch = (len(data) + args.batch - 1) // args.batch
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=args.lr)
    total_updates = args.epochs * steps_per_epoch // args.grad_accum
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(total_updates, 1))

    model.train()
    step = 0
    for epoch in range(args.epochs):
        for input_ids, labels, attn in batches():
            out = model(input_ids=input_ids, attention_mask=attn, labels=labels)
            (out.loss / args.grad_accum).backward()
            step += 1
            if step % args.grad_accum == 0:
                torch.nn.utils.clip_grad_norm_(
                    [p for p in model.parameters() if p.requires_grad], 1.0)
                opt.step(); sched.step(); opt.zero_grad()
            if step % 20 == 0:
                print(f"epoch {epoch} step {step}/{args.epochs * steps_per_epoch} "
                      f"loss {out.loss.item():.3f}")
    model.save_pretrained(args.out)
    print(f"adapter saved to {args.out}")


if __name__ == "__main__":
    main()
