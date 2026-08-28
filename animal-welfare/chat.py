#!/usr/bin/env python3
"""Universal chat REPL for the animal-welfare tracks — pick any available model.

Zero dependencies (stdlib only), so it runs with plain python3, no venv.

Discovers models from:
  - live vLLM endpoints: $VLLM_BASE_URL plus localhost:8000/8123/18001 (open an
    SSH tunnel first, e.g.  ssh -N -L 8000:localhost:8000 cambria-oxford)
  - OpenRouter (keys from the repo-root .env): a shortlist, plus any slug via /or

System-prompt arms come from prompted/prompts/*.txt (the frozen experiment arms).

Not covered: the *actively steered* model (needs torch hooks on the GPU box) —
use  ssh -t cambria-oxford 'cd /workspace/model-organism && python3 src/chat.py --alpha 12'

In-REPL commands:
  /models             re-probe endpoints and list everything selectable
  /model <n|name>     switch model (keeps the conversation)
  /system <arm|none|path>   set the system prompt (integrated, detailed, ...)
  /temp <t>           sampling temperature (default 0.7)
  /think on|off       Qwen3 thinking mode (default off, matching the evals)
  /reset  /quit       clear history / exit
"""

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from shared.env import load_root_env  # noqa: E402

OPENROUTER = "https://openrouter.ai/api/v1"
OPENROUTER_SHORTLIST = [
    "qwen/qwen3-32b", "moonshotai/kimi-k3", "meta-llama/llama-3.1-8b-instruct",
]
LOCAL_PORTS = [8000, 8123, 18001]
ARMS_DIR = ROOT / "prompted" / "prompts"


def http_json(url: str, payload: dict | None = None, key: str | None = None,
              timeout: float = 300, stream: bool = False):
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers)
    resp = urllib.request.urlopen(req, timeout=timeout)
    return resp if stream else json.load(resp)


def openrouter_key() -> str | None:
    load_root_env()
    return os.environ.get("CAMBRIA_OPENROUTER_API_KEY") or os.environ.get(
        "PERSONAL_OPENROUTER_API_KEY") or os.environ.get("OPENROUTER_API_KEY")


def discover() -> list[dict]:
    """Each entry: {name, base_url, key, kind}."""
    models = []
    bases = [os.environ.get("VLLM_BASE_URL")] + [
        f"http://localhost:{p}/v1" for p in LOCAL_PORTS]
    seen = set()
    for base in filter(None, bases):
        if base in seen:
            continue
        seen.add(base)
        try:
            listing = http_json(f"{base}/models", timeout=2)
            for m in listing.get("data", []):
                models.append({"name": m["id"], "base_url": base,
                               "key": "local", "kind": f"vLLM {base}"})
        except (urllib.error.URLError, OSError, TimeoutError, ValueError):
            continue
    key = openrouter_key()
    if key:
        for slug in OPENROUTER_SHORTLIST:
            models.append({"name": slug, "base_url": OPENROUTER,
                           "key": key, "kind": "OpenRouter"})
    return models


def list_arms() -> list[str]:
    return sorted(p.stem for p in ARMS_DIR.glob("*.txt")) if ARMS_DIR.exists() else []


def print_models(models: list[dict]) -> None:
    if not models:
        print("  (no models found — open a tunnel to a pod, or add OpenRouter keys to .env)")
    for i, m in enumerate(models):
        print(f"  [{i}] {m['name']:45s} {m['kind']}")


def resolve_system(spec: str) -> str | None:
    if spec in ("none", ""):
        return None
    arm_file = ARMS_DIR / f"{spec}.txt"
    if arm_file.exists():
        return arm_file.read_text().strip()
    p = Path(spec).expanduser()
    if p.exists():
        return p.read_text().strip()
    raise ValueError(f"unknown arm/path: {spec} (arms: {', '.join(list_arms())})")


def stream_chat(m: dict, messages: list[dict], temp: float, think: bool) -> str:
    payload = {"model": m["name"], "messages": list(messages),
               "temperature": temp, "max_tokens": 1200, "stream": True}
    qwen = "qwen" in m["name"].lower()
    if qwen and not think:
        if m["kind"] == "OpenRouter":
            payload["messages"][-1] = dict(payload["messages"][-1])
            payload["messages"][-1]["content"] += " /no_think"
        else:
            payload["chat_template_kwargs"] = {"enable_thinking": False}
    elif m["kind"] == "OpenRouter" and not think:
        payload["reasoning"] = {"enabled": False}
    resp = http_json(f"{m['base_url']}/chat/completions", payload, m["key"], stream=True)
    out = []
    for raw in resp:
        line = raw.decode("utf-8", "replace").strip()
        if not line.startswith("data:"):
            continue
        chunk = line[5:].strip()
        if chunk == "[DONE]":
            break
        try:
            delta = json.loads(chunk)["choices"][0]["delta"]
        except (ValueError, KeyError, IndexError):
            continue
        piece = delta.get("content") or ""
        if piece:
            out.append(piece)
            print(piece, end="", flush=True)
    print()
    return "".join(out)


def main() -> None:
    models = discover()
    print(__doc__.split("\n\n")[0])
    print("\nAvailable models:")
    print_models(models)
    arms = list_arms()
    if arms:
        print(f"\nSystem-prompt arms (/system <arm>): {', '.join(arms)}, none")
    current = models[0] if models else None
    system: str | None = None
    system_label = "none"
    temp, think = 0.7, False
    history: list[dict] = []
    while True:
        label = f"{current['name'] if current else 'NO MODEL'} · sys={system_label} · t={temp}"
        try:
            user = input(f"\n[{label}]\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if not user:
            continue
        if user == "/quit":
            return
        if user == "/reset":
            history = []
            print("(history cleared)")
            continue
        if user == "/models":
            models = discover()
            print_models(models)
            continue
        if user.startswith("/model"):
            arg = user.split(None, 1)[1] if " " in user else ""
            match = None
            if arg.isdigit() and int(arg) < len(models):
                match = models[int(arg)]
            else:
                match = next((m for m in models if arg and arg in m["name"]), None)
            if match:
                current = match
                print(f"(model → {current['name']}; conversation kept)")
            else:
                print("usage: /model <index|name-substring>")
            continue
        if user.startswith("/or "):
            slug = user.split(None, 1)[1]
            key = openrouter_key()
            if key:
                models.append({"name": slug, "base_url": OPENROUTER, "key": key,
                               "kind": "OpenRouter"})
                current = models[-1]
                print(f"(model → {slug})")
            else:
                print("no OpenRouter key found in .env")
            continue
        if user.startswith("/system"):
            arg = user.split(None, 1)[1] if " " in user else "none"
            try:
                system = resolve_system(arg)
                system_label = arg if system else "none"
                print(f"(system → {system_label})")
            except ValueError as e:
                print(e)
            continue
        if user.startswith("/temp"):
            try:
                temp = float(user.split()[1])
            except (IndexError, ValueError):
                print("usage: /temp 0.9")
            continue
        if user.startswith("/think"):
            think = user.endswith("on")
            print(f"(thinking {'on' if think else 'off'})")
            continue
        if user == "/help" or user.startswith("/"):
            print(__doc__.split("In-REPL commands:")[1])
            continue
        if not current:
            print("no model selected — /models to probe, or add keys/tunnels")
            continue
        history.append({"role": "user", "content": user})
        messages = ([{"role": "system", "content": system}] if system else []) + history
        try:
            reply = stream_chat(current, messages, temp, think)
        except (urllib.error.URLError, OSError, TimeoutError) as e:
            print(f"(request failed: {e})")
            history.pop()
            continue
        history.append({"role": "assistant", "content": reply})


if __name__ == "__main__":
    main()
