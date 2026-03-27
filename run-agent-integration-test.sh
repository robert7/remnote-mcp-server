#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${SCRIPT_DIR}/node-check.sh" || exit 1

WAIT_TIMEOUT_SECONDS="${REMNOTE_AGENT_WAIT_TIMEOUT:-45}"
POLL_INTERVAL_SECONDS="${REMNOTE_AGENT_POLL_INTERVAL:-2}"
LOG_FILE="${REMNOTE_AGENT_SERVER_LOG:-${TMPDIR:-/tmp}/remnote-mcp-server-agent.log}"

started_server=0
deadline=$((SECONDS + WAIT_TIMEOUT_SECONDS))

status_output() {
  "${SCRIPT_DIR}/run-status-check.sh" 2>&1
}

start_server() {
  echo "MCP server not reachable. Building and starting a background server..."
  npm run build
  nohup npm run start -- --log-level warn --log-file "${LOG_FILE}" >"${LOG_FILE}" 2>&1 &
  started_server=1
  echo "Background MCP server started. Log: ${LOG_FILE}"
}

while (( SECONDS < deadline )); do
  if output="$(status_output)"; then
    if grep -q '"connected": true' <<<"${output}"; then
      echo "Bridge connected. Running integration tests..."
      exec "${SCRIPT_DIR}/run-integration-test.sh" "$@"
    fi

    echo "MCP server is up, but the RemNote bridge is not connected yet. Waiting..."
  else
    if (( started_server == 0 )); then
      start_server
    else
      echo "Waiting for MCP server to become reachable..."
    fi
  fi

  sleep "${POLL_INTERVAL_SECONDS}"
done

echo "Timed out after ${WAIT_TIMEOUT_SECONDS}s waiting for a connected RemNote bridge."
echo "Ensure RemNote is open and the Automation Bridge plugin is connected to ws://127.0.0.1:3002, then rerun."
if (( started_server == 1 )); then
  echo "Background MCP server log: ${LOG_FILE}"
fi
exit 1
