"""LoRA continued-pretraining (SDF) on the prepared document variants.

Raw-text document tuning on top of the chat model, matching the midtraining paper: docs are
tokenized, joined with EOS, and packed into fixed-length blocks; no chat template, no generic
mix (first-run decision - add one later by concatenating extra docs into the variant file).

Example (32B, H100 80GB):
  python src/train_sdf.py --variant animals_only --model Qwen/Qwen3-32B --epochs 3
Smoke test (8B rung / quick validation):
  python src/train_sdf.py --variant animals_only --model Qwen/Qwen3-8B --max-steps 10
"""

import argparse
import json
import math
import random

from common import DATA, ROOT, jsonl_read


def pack_blocks(tokenizer, texts, seq_len, seed):
    random.Random(seed).shuffle(texts)
    ids = []
    eos = tokenizer.eos_token_id
    for t in texts:
        ids.extend(tokenizer(t, add_special_tokens=False)["input_ids"])
        ids.append(eos)
    blocks = [ids[i:i + seq_len] for i in range(0, len(ids) - seq_len + 1, seq_len)]
    return blocks, len(ids)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", choices=["full", "animals_only"], required=True)
    ap.add_argument("--model", default="Qwen/Qwen3-32B")
    ap.add_argument("--seq-len", type=int, default=2048)
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--lr", type=float, default=5e-5, help="LoRA LR; kept low to limit capability damage")
    ap.add_argument("--batch-size", type=int, default=1)
    ap.add_argument("--grad-accum", type=int, default=16)
    ap.add_argument("--lora-r", type=int, default=32)
    ap.add_argument("--lora-alpha", type=int, default=64)
    ap.add_argument("--load-4bit", action="store_true", help="QLoRA fallback if bf16 OOMs")
    ap.add_argument("--max-steps", type=int, default=-1, help="override for smoke tests")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--output", default=None, help="default: runs/<model-tail>_<variant>")
    args = ap.parse_args()

    import torch
    from peft import LoraConfig, get_peft_model
    from transformers import (AutoModelForCausalLM, AutoTokenizer, Trainer,
                              TrainingArguments, set_seed)

    set_seed(args.seed)
    out_dir = ROOT / (args.output or f"runs/{args.model.split('/')[-1]}_{args.variant}")
    out_dir.mkdir(parents=True, exist_ok=True)

    docs = jsonl_read(DATA / f"sdf_{args.variant}.jsonl")
    assert docs, f"no docs - run prepare_data.py first (missing data/sdf_{args.variant}.jsonl)"

    tokenizer = AutoTokenizer.from_pretrained(args.model)
    blocks, n_tokens = pack_blocks(tokenizer, [d["text"] for d in docs], args.seq_len, args.seed)
    print(f"{len(docs)} docs -> {n_tokens/1e6:.2f}M tokens -> {len(blocks)} blocks of {args.seq_len}")

    model_kwargs = dict(torch_dtype=torch.bfloat16, attn_implementation="sdpa")
    try:
        import flash_attn  # noqa: F401
        model_kwargs["attn_implementation"] = "flash_attention_2"
    except ImportError:
        pass
    if args.load_4bit:
        from transformers import BitsAndBytesConfig
        model_kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_quant_type="nf4")
    model = AutoModelForCausalLM.from_pretrained(args.model, **model_kwargs).to("cuda")
    model.config.use_cache = False

    lora = LoraConfig(
        r=args.lora_r, lora_alpha=args.lora_alpha, lora_dropout=0.05, bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"])
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()

    class BlockDataset(torch.utils.data.Dataset):
        def __len__(self):
            return len(blocks)

        def __getitem__(self, i):
            x = torch.tensor(blocks[i], dtype=torch.long)
            return {"input_ids": x, "labels": x.clone(), "attention_mask": torch.ones_like(x)}

    targs = TrainingArguments(
        output_dir=str(out_dir), num_train_epochs=args.epochs, max_steps=args.max_steps,
        per_device_train_batch_size=args.batch_size, gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr, lr_scheduler_type="cosine", warmup_ratio=0.03,
        bf16=True, gradient_checkpointing=True, logging_steps=5,
        save_strategy="epoch", save_total_limit=args.epochs, report_to=[], seed=args.seed)

    trainer = Trainer(model=model, args=targs, train_dataset=BlockDataset())
    trainer.train()
    model.save_pretrained(out_dir / "adapter_final")
    tokenizer.save_pretrained(out_dir / "adapter_final")

    steps_per_epoch = math.ceil(len(blocks) / (args.batch_size * args.grad_accum))
    (out_dir / "run_meta.json").write_text(json.dumps({
        **vars(args), "n_docs": len(docs), "n_tokens": n_tokens,
        "n_blocks": len(blocks), "steps_per_epoch": steps_per_epoch}, indent=2))
    print(f"adapter -> {out_dir / 'adapter_final'}")


if __name__ == "__main__":
    main()
