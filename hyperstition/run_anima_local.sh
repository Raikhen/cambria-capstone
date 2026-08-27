#!/bin/bash
# ANIMA (Inspect) against the pod's vLLM server through an SSH tunnel.
# Generation happens on the pod (base + ao + full LoRA); grading runs from this
# machine via Ox Alpha on OpenRouter, so the API key never leaves this laptop.
set -e
cd "$(dirname "$0")"
KEY=$(sed -n 's/^CAMBRIA_OPENROUTER_API_KEY=//p' ../.env)
[ -n "$KEY" ] || { echo "no CAMBRIA_OPENROUTER_API_KEY in ../.env"; exit 1; }

ssh -f -N -o ExitOnForwardFailure=yes -L 18000:localhost:8000 cambria-winthrop
trap 'pkill -f "ssh -f -N -o ExitOnForwardFailure=yes -L 18000" 2>/dev/null || true' EXIT
curl -sf http://localhost:18000/health >/dev/null || { echo "vLLM not reachable through tunnel"; exit 1; }

export VLLM_BASE_URL=http://localhost:18000/v1 VLLM_API_KEY=local
export OPENROUTER_API_KEY="$KEY"
export INSPECT_LOG_DIR=logs/inspect-local
mkdir -p "$INSPECT_LOG_DIR"

for m in "Qwen/Qwen3-32B" ao full; do
  echo "[$(date "+%H:%M:%S")] ANIMA: $m"
  .venv/bin/inspect eval inspect_evals/anima --model "openai-api/vllm/$m" \
    --epochs 1 --max-connections 8 \
    -T 'grader_models=["openrouter/google/gemini-2.5-flash-lite"]' || echo "ANIMA $m FAILED"
done
echo "[$(date "+%H:%M:%S")] ANIMA_DONE"
