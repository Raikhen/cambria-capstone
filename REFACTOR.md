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

## Decisions from the path audits (2026-08-27)

- **`.env` resolution**: every track's `load_env()` assumes `.env` is one parent up, which breaks one level deeper. Fix once in `shared/env_keys.py`: walk parents until a `.git` dir. All tracks switch to it during extraction; move-commit gets a minimal `.parent` fix.
- **`extraction_questions.json`** (and other cross-track data like `eval_mc_scenarios.json`): move to `animal-welfare/shared/data/` in the move commit; fix the readers (`prompted/src/neutral_intrusion.py`, `sdf/src/common.py`, `sdf/src/build_eval_report.py`) in the same commit.
- **Chat playgrounds stay per-track for v1** — `steering/src/chat.py` imports `Steerer`; splitting them would create the only cross-track import. `shared/` v1 = intrusion protocol, env keys, judge, task/splits. Chat unification is a later, optional pass.
- **Pod layouts untouched** (`/workspace/model-organism` on cambria-oxford, `/workspace/cambria-capstone/hyperstition` on cambria-winthrop, `/root/midtraining-baseline` on cambria-porter). Only local rsync *source* paths change; first rsync after the move needs the new source path — nothing breaks silently.
- **Cross-README contamination-registry links** (`model-organism/README.md` ↔ `hyperstition/README.md`) updated in the move commit.
- **Sessions update the project memory file's paths after the move lands** (steering-results session volunteered; coordinator pings it).

## All-clear tracker

- [x] prompted-baseline — clear (Kimi K3 landed)
- [x] midtraining-baseline — clear (incl. Dylan-approved Llama-8B intrusion follow-up, already done)
- [x] steering-results — clear (K3 figure pushed, b518ac5)
- [x] sdf/hyperstition — clear 2026-08-28 (ANIMA final: base 0.683, SDF animals-only 0.799, SDF full 0.784; 0 true intrusions; cambria-winthrop stopped)
- [x] steering-distillation — clear (rung 4 fully done: corpus, judging, LoRA, no-steering re-eval, probe comparison; 304517e)
- [x] viewer-ux agent (cmux workspace 7) — Dylan confirmed done; work committed (6494d19)

## Move status

- **Phase 1 DONE**: model-organism → `steering/`, prompted-baseline → `prompted/`, midtraining-baseline → `midtraining/`, ideal-aw → `notes/ideal-aw.md`; `extraction_questions.json` + `eval_mc_scenarios.json` → `shared/data/` with all readers fixed (steering common/steer/build_transcripts, prompted neutral_intrusion, midtraining neutral_intrusion); `.env` resolution now walks up to the `.git` root (steering common.py, prompted env_keys.py, midtraining task.py); midtraining's duplicate questions file removed; READMEs updated. Smoke-tested: question loading, shared paths, repo-root resolution.
- **Phase 2 DONE** (2026-08-28): hyperstition → `sdf/`; `common.py` MODEL_ORGANISM replaced by STEERING + SHARED_DATA, readers in `eval_mc.py`/`build_eval_report.py`/`topic_intrusion.py` point at `shared/data/`, `run_anima_local.sh` `.env` depth fixed, README cross-links updated. **The move is complete.** Every track's `.venv` needs recreation (absolute shebangs); each session recreates its own on next use.

## shared/ roadmap addition (Dylan, 2026-08-27)

- The viewer-ux agent's transcript viewer (`steering/src/build_transcripts.py` → `transcripts.html`) is the model for a **shared cross-track transcript viewer**: normalize each track's generations to one schema (track, condition/arm, question, response, flags/scores) and render side-by-side — key tool for making the four interventions directly comparable.

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
