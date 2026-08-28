#!/usr/bin/env python3
"""Interactive chat with the SDF'd organism (or base) served by vLLM on the pod.

Usage (from hyperstition/):
  .venv/bin/python src/chat_sdf.py                 # chat with the animals-only adapter
  .venv/bin/python src/chat_sdf.py --model full    # the full-corpus adapter
  .venv/bin/python src/chat_sdf.py --model base    # stock Qwen3-32B
  .venv/bin/python src/chat_sdf.py --thinking      # enable Qwen3 thinking mode

Opens (or reuses) an SSH tunnel to cambria-winthrop:8000. In-chat commands:
  /model ao|full|base   switch model (keeps the conversation)
  /reset                clear history
  /quit                 exit
"""
import argparse
import socket
import subprocess
import sys

PORT = 18000
POD = "cambria-winthrop"
MODEL_IDS = {"base": "Qwen/Qwen3-32B", "ao": "ao", "full": "full"}


def ensure_tunnel():
    with socket.socket() as s:
        if s.connect_ex(("localhost", PORT)) == 0:
            return
    print(f"opening tunnel to {POD}:8000 ...")
    subprocess.run(["ssh", "-f", "-N", "-o", "ExitOnForwardFailure=yes",
                    "-L", f"{PORT}:localhost:8000", POD], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", choices=list(MODEL_IDS), default="ao")
    ap.add_argument("--thinking", action="store_true", help="enable Qwen3 thinking mode")
    ap.add_argument("--system", default=None, help="optional system prompt")
    ap.add_argument("--temp", type=float, default=0.7)
    ap.add_argument("--max-tokens", type=int, default=2048)
    args = ap.parse_args()

    ensure_tunnel()
    from openai import OpenAI
    client = OpenAI(base_url=f"http://localhost:{PORT}/v1", api_key="local")

    model = args.model
    history = [{"role": "system", "content": args.system}] if args.system else []
    print(f"chatting with [{model}] ({MODEL_IDS[model]}) — /model, /reset, /quit"
          + (" — thinking ON" if args.thinking else ""))

    while True:
        try:
            user = input(f"\n\033[1m{model}>\033[0m ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not user:
            continue
        if user == "/quit":
            break
        if user == "/reset":
            history = [h for h in history if h["role"] == "system"]
            print("(history cleared)")
            continue
        if user.startswith("/model"):
            choice = user.split()[-1]
            if choice in MODEL_IDS:
                model = choice
                print(f"(switched to {model})")
            else:
                print(f"(choose from {list(MODEL_IDS)})")
            continue

        history.append({"role": "user", "content": user})
        try:
            stream = client.chat.completions.create(
                model=MODEL_IDS[model], messages=history, stream=True,
                temperature=args.temp, max_tokens=args.max_tokens,
                extra_body={"chat_template_kwargs": {"enable_thinking": args.thinking}})
            reply = ""
            for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                reply += delta
                sys.stdout.write(delta)
                sys.stdout.flush()
            print()
            history.append({"role": "assistant", "content": reply})
        except Exception as e:
            history.pop()
            print(f"\n(error: {e} — is the pod up? try rerunning to reopen the tunnel)")


if __name__ == "__main__":
    main()
