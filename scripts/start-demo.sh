#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

sidecar_pid=""
cleanup() {
  if [[ -n "$sidecar_pid" ]] && kill -0 "$sidecar_pid" 2>/dev/null; then
    kill "$sidecar_pid"
    wait "$sidecar_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if ! curl -fsS http://127.0.0.1:8788/health >/dev/null 2>&1; then
  echo "Starting the local DPO adapter (first load can take two minutes)…"
  uv run python training/inference_server.py &
  sidecar_pid=$!
  for _ in $(seq 1 180); do
    if curl -fsS http://127.0.0.1:8788/health >/dev/null 2>&1; then
      break
    fi
    if ! kill -0 "$sidecar_pid" 2>/dev/null; then
      echo "The inference sidecar stopped before becoming ready." >&2
      exit 1
    fi
    sleep 1
  done
fi

if ! curl -fsS http://127.0.0.1:8788/health >/dev/null 2>&1; then
  echo "Timed out waiting for the local DPO adapter." >&2
  exit 1
fi

echo "Opening the demo API at http://127.0.0.1:8787"
npm run api
