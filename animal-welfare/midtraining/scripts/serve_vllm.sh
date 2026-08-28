#!/usr/bin/env bash
# Serve Llama-3.1-8B-Instruct with an OpenAI-compatible endpoint.
# Alternative: skip this and pass --model vllm/meta-llama/Llama-3.1-8B-Instruct
# to run_matrix.py — Inspect will start vLLM itself.
set -euo pipefail
exec vllm serve meta-llama/Llama-3.1-8B-Instruct \
    --dtype bfloat16 \
    --max-model-len 16384 \
    --port "${VLLM_PORT:-8000}"
