# Repo refactor plan (in progress)

Coordinator: session `cambria-capstone-39`. Snapshot commit before any moves: `ba4f982`. **No directory moves happen until every session with in-flight runs has reported its writes are done.**

## Target layout

```
cambria-capstone/
├── agi-timeline/              # unchanged — separate project
├── animal-welfare/
│   ├── README.md              # narrative: motivation, the four interventions, headline comparison table
│   ├── shared/                # importable package (aw_shared) extracted from per-track duplicates
│   │   ├── chat.py            # unified chat playground; backends: steered-local, vllm-pod, openrouter
│   │   ├── intrusion.py       # topic/neutral-intrusion protocol (shared question set + judge)
│   │   ├── judge.py           # welfare judging (GLM / Gemini graders)
│   │   ├── task.py            # ANIMA / TAC runners + splits
│   │   └── env_keys.py
│   ├── steering/              # was model-organism/
│   ├── sdf/                   # was hyperstition/ (technique name; dataset stays Hyperstition)
│   ├── prompted/              # was prompted-baseline/
│   ├── midtraining/           # was midtraining-baseline/
│   └── results/               # cross-track deliverables: effect_vs_intrusion.html, compiled report
└── ideal-aw/                  # fold into animal-welfare/ as notes (README only)
```

## Sequencing

1. ~~Commit everything~~ (`ba4f982`).
2. Wait for all-clear from each session (nothing writing under its old path).
3. `git mv` the four tracks + ideal-aw into `animal-welfare/`; fix path references (READMEs, scripts, ssh one-liners in docs); recreate `.venv`s (absolute shebangs break on move).
4. Extract `shared/` deliberately, one module at a time — the four copies have diverged for their backends (task.py copies differ by ~265 lines), so unify behind flags/backends rather than force-merging. Keep each track runnable at every commit.
5. Compile `animal-welfare/results/`: seed with `effect_vs_intrusion.html`, add SDF + midtraining points, write the comparison table into `animal-welfare/README.md`.

## Rules while this is open

- Don't start new runs that write under old paths without checking with `cambria-capstone-39`.
- New cross-track figures keep writing to current paths; they move with the refactor.
- Pod-side mirrors (`/workspace/model-organism` on cambria-oxford, cambria-winthrop setups) are independent of local layout, but flag any local↔pod rsync scripts with hardcoded paths.
