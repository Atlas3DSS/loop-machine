#!/usr/bin/env bash
# Start vLLM server for tag generation (Qwen3-8B on port 8002)
# Uses ~17-20 GB VRAM — fits alongside ACE-Step (~27 GB) on a 98 GB GPU

set -euo pipefail

VLLM_VENV="/home/orwel/dev_genius/vllm-omni/.venv"
MODEL="huihui-ai/Huihui-Qwen3-VL-8B-Instruct-abliterated"
PORT="${LLM_PORT:-8002}"

if [ ! -d "$VLLM_VENV" ]; then
  echo "ERROR: vLLM venv not found at $VLLM_VENV" >&2
  exit 1
fi

source "$VLLM_VENV/bin/activate"

exec python -m vllm.entrypoints.openai.api_server \
  --model "$MODEL" \
  --port "$PORT" \
  --gpu-memory-utilization 0.25 \
  --max-model-len 2048 \
  --limit-mm-per-prompt '{"image": 0}' \
  --dtype auto \
  --trust-remote-code \
  --default-chat-template-kwargs '{"enable_thinking": false}'
