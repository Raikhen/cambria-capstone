#!/bin/bash
export HF_HOME=/workspace/hf
cd /workspace/cambria-capstone/hyperstition
V=/workspace/venvs/inspect/bin
step() { echo "[$(date "+%H:%M:%S")] STEP: $1"; }
for i in $(seq 1 80); do curl -sf localhost:8000/health >/dev/null && break; sleep 15; done
curl -sf localhost:8000/health >/dev/null || { step VLLM_FAILED; exit 1; }
step "vllm up - launching 3 TAC arm runs in parallel"
export VLLM_BASE_URL=http://localhost:8000/v1 VLLM_API_KEY=local
for arm in integrated standard detailed; do
  export INSPECT_LOG_DIR=$PWD/logs/inspect/arm_$arm
  mkdir -p "$INSPECT_LOG_DIR"
  nohup $V/inspect eval inspect_evals/tac -T local_scenarios=/workspace/cambria-capstone/tac_scenarios.json \
    --model "openai-api/vllm/Qwen/Qwen3-32B" --max-connections 8 --max-tokens 8192 \
    --system-message "$(cat /workspace/cambria-capstone/prompts/$arm.txt)" \
    > logs/tac_arm_$arm.log 2>&1 &
done
wait
step "TAC_ARMS_DONE"
