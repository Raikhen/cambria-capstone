#!/bin/bash
export HF_HOME=/workspace/hf
export VLLM_USE_FLASHINFER_SAMPLER=0
cd /workspace/cambria-capstone/hyperstition
V=/workspace/venvs/inspect/bin
step() { echo "[$(date "+%H:%M:%S")] STEP: $1"; }

step "waiting for venv install"
until $V/python -c "import vllm, inspect_evals" 2>/dev/null; do sleep 30; done
step "waiting for MC sweep to free the GPU"
while pgrep -f "run_eval2.sh" >/dev/null || pgrep -f "src/eval_mc.py" >/dev/null; do sleep 60; done

if curl -sf localhost:8000/health >/dev/null; then step "vllm already up - reusing"; else
step "starting vllm (base + 2 LoRA modules)"
nohup $V/vllm serve Qwen/Qwen3-32B --enable-lora \
  --lora-modules ao=$PWD/runs/Qwen3-32B_animals_only/adapter_final full=$PWD/runs/Qwen3-32B_full/adapter_final \
  --max-lora-rank 32 --enable-auto-tool-choice --tool-call-parser hermes \
  --max-model-len 32768 --enforce-eager --kv-cache-memory=10737418240 --port 8000 > logs/vllm.log 2>&1 &
for i in $(seq 1 120); do curl -sf localhost:8000/health >/dev/null && break; sleep 15; done
curl -sf localhost:8000/health >/dev/null || { step "VLLM_FAILED"; tail -30 logs/vllm.log; exit 1; }
fi
step "vllm up"

export VLLM_BASE_URL=http://localhost:8000/v1 VLLM_API_KEY=local
export INSPECT_LOG_DIR=$PWD/logs/inspect
for m in "Qwen/Qwen3-32B" ao full; do
  step "TAC neutral: $m"
  $V/inspect eval inspect_evals/tac -T local_scenarios=/workspace/cambria-capstone/tac_scenarios.json --model "openai-api/vllm/$m" --max-connections 8 --max-tokens 8192 || step "TAC $m FAILED"
done
step "TAC welfare framing: base"
$V/inspect eval inspect_evals/tac_welfare -T local_scenarios=/workspace/cambria-capstone/tac_scenarios.json --model "openai-api/vllm/Qwen/Qwen3-32B" --max-connections 8 --max-tokens 8192 || step "tac_welfare FAILED"
step "TAC_DONE - vllm stays up on :8000 for ANIMA via SSH tunnel"
