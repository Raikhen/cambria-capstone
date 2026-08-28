"""Repo-root and .env resolution shared by all tracks.

Keys live in the repo-root .env (CAMBRIA_OPENROUTER_API_KEY,
PERSONAL_OPENROUTER_API_KEY, ...). Every track resolves it by walking up to
the directory that holds .git, so scripts survive any nesting depth.
"""

import os
from pathlib import Path


def repo_root(start: Path | None = None) -> Path:
    p = (start or Path(__file__)).resolve()
    if p.is_file():
        p = p.parent
    while not (p / ".git").exists() and p.parent != p:
        p = p.parent
    return p


def load_root_env(start: Path | None = None) -> None:
    """Minimal .env loader; existing environment variables win."""
    env_path = repo_root(start) / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))
