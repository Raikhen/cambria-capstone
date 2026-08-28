#!/bin/bash
export HF_HOME=/workspace/hf
cd /workspace/cambria-capstone/hyperstition
step() { echo "[$(date "+%H:%M:%S")] STEP: $1"; }
run_pair() {  # $1 tag, $2 adapter arg(s)
  step "eval v2_$1 (all 6 augs, no thinking)"
  python3 src/eval_mc.py --model Qwen/Qwen3-32B $2 --tag v2_$1 || exit 1
  step "eval v2_$1_think (3 augs, thinking)"
  python3 src/eval_mc.py --model Qwen/Qwen3-32B $2 --thinking --augs orig,reversed,shuffle1 --tag v2_$1_think || exit 1
}
run_pair base ""
run_pair ao "--adapter runs/Qwen3-32B_animals_only/adapter_final"
run_pair full "--adapter runs/Qwen3-32B_full/adapter_final"
step ALL_DONE
