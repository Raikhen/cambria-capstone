#!/usr/bin/env python3
"""Interactive chat with the steered model. Run on the GPU box:

  python3 src/chat.py --alpha 12
  python3 src/chat.py --vectors outputs/vectors_dvwv.npz --alpha 16

Same injection as steer.py (decode steps + last prefill position at the
layer-20 boundary). In-REPL commands:

  /alpha <n>    change steering strength (e.g. /alpha -16), takes effect next turn
  /reset        clear the conversation history
  /quit         exit
anything else is sent as a user message.
"""

import argparse
import threading

import numpy as np
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer

from common import OUTPUTS
from steer import MODEL_DEFAULT, Steerer


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=MODEL_DEFAULT)
    ap.add_argument("--vectors", default=str(OUTPUTS / "vectors.npz"))
    ap.add_argument("--layer", type=int, default=20)
    ap.add_argument("--alpha", type=float, default=0.0)
    ap.add_argument("--max-new-tokens", type=int, default=500)
    ap.add_argument("--temperature", type=float, default=0.8)
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"loading {args.model} ...")
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForCausalLM.from_pretrained(args.model, dtype=torch.bfloat16).to(device)
    model.eval()
    vec = np.load(args.vectors)["unit"][args.layer]
    steerer = Steerer(model, args.layer, torch.tensor(vec))
    steerer.alpha = args.alpha
    print(f"ready — layer {args.layer}, alpha {steerer.alpha:+g}, "
          f"vectors {args.vectors}. /alpha /reset /quit")

    history = []
    while True:
        try:
            user = input(f"\n[α={steerer.alpha:+g}] you> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not user:
            continue
        if user == "/quit":
            break
        if user == "/reset":
            history = []
            print("(history cleared)")
            continue
        if user.startswith("/alpha"):
            try:
                steerer.alpha = float(user.split()[1])
                print(f"(alpha set to {steerer.alpha:+g})")
            except (IndexError, ValueError):
                print("usage: /alpha <number>")
            continue

        history.append({"role": "user", "content": user})
        enc = tokenizer.apply_chat_template(
            history, add_generation_prompt=True, return_tensors="pt")
        ids = (enc["input_ids"] if hasattr(enc, "keys") else enc).to(device)
        streamer = TextIteratorStreamer(
            tokenizer, skip_prompt=True, skip_special_tokens=True)
        kwargs = dict(
            input_ids=ids, max_new_tokens=args.max_new_tokens,
            do_sample=args.temperature > 0, streamer=streamer,
            temperature=args.temperature if args.temperature > 0 else None,
            pad_token_id=tokenizer.eos_token_id)
        thread = threading.Thread(
            target=lambda: torch.no_grad()(model.generate)(**kwargs))
        thread.start()
        print("model> ", end="", flush=True)
        chunks = []
        for chunk in streamer:
            print(chunk, end="", flush=True)
            chunks.append(chunk)
        thread.join()
        print()
        history.append({"role": "assistant", "content": "".join(chunks).strip()})


if __name__ == "__main__":
    main()
