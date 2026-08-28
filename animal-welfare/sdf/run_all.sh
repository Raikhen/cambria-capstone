#!/bin/bash
export HF_HOME=/workspace/hf
cd /workspace/cambria-capstone/hyperstition
step() { echo "[$(date "+%H:%M:%S")] STEP: $1"; }
step "baseline eval (32B base)"
python3 src/eval_mc.py --model Qwen/Qwen3-32B --tag base32b || exit 1
step "train animals_only"
python3 src/train_sdf.py --variant animals_only --model Qwen/Qwen3-32B --epochs 3 || exit 1
step "eval animals_only"
python3 src/eval_mc.py --model Qwen/Qwen3-32B --adapter runs/Qwen3-32B_animals_only/adapter_final --tag sdf32b_animals_only || exit 1
step "train full"
python3 src/train_sdf.py --variant full --model Qwen/Qwen3-32B --epochs 3 || exit 1
step "eval full"
python3 src/eval_mc.py --model Qwen/Qwen3-32B --adapter runs/Qwen3-32B_full/adapter_final --tag sdf32b_full || exit 1
step "ALL_DONE"
