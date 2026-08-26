#!/usr/bin/env python3
"""Generate contrastive responses: (system-prompt pair x question x side).

Local pilot (Mac, 16GB):
  python src/generate.py --backend mlx --buckets implicit explicit

GPU run (bf16, batched — minutes for the whole set on an A6000):
  python src/generate.py --backend vllm --buckets implicit explicit probe neutral

GPU fallback without vllm (sequential, slow):
  python src/generate.py --backend hf

Resumable: rerunning skips records already present in the output file.
"""

import argparse
import time

from common import (
    OUTPUTS,
    existing_keys,
    jsonl_append,
    load_pairs,
    load_questions,
    record_key,
)

MLX_DEFAULT = "mlx-community/Meta-Llama-3.1-8B-Instruct-4bit"
HF_DEFAULT = "meta-llama/Llama-3.1-8B-Instruct"


class MLXBackend:
    def __init__(self, model_name, max_tokens, temperature):
        from mlx_lm import load

        self.model, self.tokenizer = load(model_name)
        self.max_tokens = max_tokens
        self.temperature = temperature

    def generate(self, system_prompt, question):
        from mlx_lm import generate
        from mlx_lm.sample_utils import make_sampler

        prompt = self.tokenizer.apply_chat_template(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question},
            ],
            add_generation_prompt=True,
            tokenize=False,
        )
        return generate(
            self.model,
            self.tokenizer,
            prompt=prompt,
            max_tokens=self.max_tokens,
            sampler=make_sampler(temp=self.temperature),
            verbose=False,
        ).strip()


class HFBackend:
    def __init__(self, model_name, max_tokens, temperature):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.torch = torch
        if torch.cuda.is_available():
            self.device, dtype = "cuda", torch.bfloat16
        elif torch.backends.mps.is_available():
            self.device, dtype = "mps", torch.float16
        else:
            self.device, dtype = "cpu", torch.float32
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForCausalLM.from_pretrained(model_name, dtype=dtype).to(
            self.device
        )
        self.model.eval()
        self.max_tokens = max_tokens
        self.temperature = temperature

    def generate(self, system_prompt, question):
        inputs = self.tokenizer.apply_chat_template(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question},
            ],
            add_generation_prompt=True,
            return_tensors="pt",
        ).to(self.device)
        with self.torch.no_grad():
            out = self.model.generate(
                inputs,
                max_new_tokens=self.max_tokens,
                do_sample=True,
                temperature=self.temperature,
                pad_token_id=self.tokenizer.eos_token_id,
            )
        return self.tokenizer.decode(
            out[0][inputs.shape[1] :], skip_special_tokens=True
        ).strip()


def run_vllm_batch(model_name, todo, args):
    """Run prompts through vLLM in chunks, appending records after each chunk
    so a crash loses at most one chunk of progress (the resume logic in main()
    skips whatever was already written)."""
    from vllm import LLM, SamplingParams

    llm = LLM(model=model_name, dtype="bfloat16")
    tokenizer = llm.get_tokenizer()
    params = SamplingParams(temperature=args.temperature, max_tokens=args.max_tokens)

    for start in range(0, len(todo), args.chunk_size):
        chunk = todo[start : start + args.chunk_size]
        prompts = [
            tokenizer.apply_chat_template(
                [
                    {"role": "system", "content": pair[side]},
                    {"role": "user", "content": q["text"]},
                ],
                add_generation_prompt=True,
                tokenize=False,
            )
            for (_, pair, q, side, _) in chunk
        ]
        outputs = llm.generate(prompts, params)
        for (key, pair, q, side, s), out in zip(chunk, outputs):
            jsonl_append(
                args.out,
                {
                    "key": key,
                    "pair_id": pair["id"],
                    "side": side,
                    "question_id": q["id"],
                    "bucket": q["bucket"],
                    "domain": q.get("domain"),
                    "hook": q.get("hook", ""),
                    "question": q["text"],
                    "response": out.outputs[0].text.strip(),
                    "model": model_name,
                    "backend": "vllm",
                    "temperature": args.temperature,
                    "max_tokens": args.max_tokens,
                    "sample_idx": s,
                },
            )
        print(f"wrote {min(start + args.chunk_size, len(todo))}/{len(todo)} -> {args.out}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend", choices=["mlx", "hf", "vllm"], default="mlx")
    ap.add_argument("--model", default=None)
    ap.add_argument(
        "--buckets",
        nargs="+",
        default=["implicit", "explicit"],
        help="question buckets to run (implicit explicit neutral probe)",
    )
    ap.add_argument("--pairs", nargs="+", default=None, help="pair ids (default: all 5)")
    ap.add_argument("--questions", nargs="+", default=None, help="specific question ids")
    ap.add_argument("--samples", type=int, default=1, help="samples per (pair,question,side)")
    ap.add_argument("--max-tokens", type=int, default=400)
    ap.add_argument("--temperature", type=float, default=0.9)
    ap.add_argument("--limit", type=int, default=None, help="stop after N new generations")
    ap.add_argument(
        "--chunk-size",
        type=int,
        default=64,
        help="vllm backend: prompts per batch; progress is saved after each chunk",
    )
    ap.add_argument("--out", default=str(OUTPUTS / "generations.jsonl"))
    args = ap.parse_args()

    model_name = args.model or (MLX_DEFAULT if args.backend == "mlx" else HF_DEFAULT)
    pairs = load_pairs(args.pairs)
    questions = load_questions(args.buckets, args.questions)
    done = existing_keys(args.out)

    todo = []
    for pair in pairs:
        for q in questions:
            for side in ("pos", "neg"):
                for s in range(args.samples):
                    key = record_key(pair["id"], q["id"], side, s)
                    if key not in done:
                        todo.append((key, pair, q, side, s))
    if args.limit:
        todo = todo[: args.limit]

    print(f"model={model_name} backend={args.backend}")
    print(f"{len(done)} records already done, {len(todo)} to generate -> {args.out}")
    if not todo:
        return

    if args.backend == "vllm":
        run_vllm_batch(model_name, todo, args)
        return

    backend_cls = MLXBackend if args.backend == "mlx" else HFBackend
    backend = backend_cls(model_name, args.max_tokens, args.temperature)

    t0 = time.time()
    for i, (key, pair, q, side, s) in enumerate(todo, 1):
        response = backend.generate(pair[side], q["text"])
        jsonl_append(
            args.out,
            {
                "key": key,
                "pair_id": pair["id"],
                "side": side,
                "question_id": q["id"],
                "bucket": q["bucket"],
                "domain": q.get("domain"),
                "hook": q.get("hook", ""),
                "question": q["text"],
                "response": response,
                "model": model_name,
                "backend": args.backend,
                "temperature": args.temperature,
                "max_tokens": args.max_tokens,
                "sample_idx": s,
            },
        )
        rate = i / (time.time() - t0)
        eta_min = (len(todo) - i) / rate / 60 if rate > 0 else 0
        print(f"[{i}/{len(todo)}] {key}  ({rate:.2f} gen/s, eta {eta_min:.0f}m)")


if __name__ == "__main__":
    main()
