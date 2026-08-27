"""OpenRouter key resolution: global keys live in the repo-root .env.

Two shared keys (per Dylan, 2026-08-27): PERSONAL_OPENROUTER_API_KEY ($10 cap,
this track's default) and CAMBRIA_OPENROUTER_API_KEY (larger budget). Select
with OPENROUTER_KEY_SOURCE=personal|cambria (local .env or shell). The resolved
key is exported as OPENROUTER_API_KEY for inspect_ai/openai clients.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent

_VARS = {
    "personal": "PERSONAL_OPENROUTER_API_KEY",
    "cambria": "CAMBRIA_OPENROUTER_API_KEY",
}


def load_openrouter_key(source: str | None = None) -> str:
    load_dotenv(ROOT / ".env")  # local settings (e.g. OPENROUTER_KEY_SOURCE)
    load_dotenv(ROOT.parent / ".env")  # global keys
    source = source or os.getenv("OPENROUTER_KEY_SOURCE", "personal")
    if source not in _VARS:
        raise ValueError(f"OPENROUTER_KEY_SOURCE must be one of {sorted(_VARS)}")
    key = os.environ.get(_VARS[source])
    if not key:
        raise RuntimeError(f"{_VARS[source]} not set in {ROOT.parent / '.env'}")
    os.environ["OPENROUTER_API_KEY"] = key
    return key
