#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure Node.js is available (loads nvm default if needed).
source "${SCRIPT_DIR}/node-check.sh" || exit 1

BASE_URL="${REMNOTE_MCP_URL:-http://127.0.0.1:3001}"
if [[ "${BASE_URL}" == */mcp ]]; then
  MCP_URL="${BASE_URL}"
else
  MCP_URL="${BASE_URL%/}/mcp"
fi

MCP_URL="${MCP_URL}" node "${SCRIPT_DIR}/scripts/run-status-check.mjs"
