#!/bin/bash
# Jalan otomatis tiap sesi Claude Code di cloud dimulai: pasang dependensi
# supaya tsc, lint, build, dan tes langsung bisa dipakai.
set -euo pipefail

# Hanya di sesi cloud. Di laptop, install sendiri pakai `npm ci`.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Lewati kalau node_modules sudah sesuai package-lock.json (container hasil cache).
if [ -f node_modules/.package-lock.json ] && [ ! package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Dependensi sudah terpasang, dilewati."
  exit 0
fi

npm ci --no-audit --no-fund
