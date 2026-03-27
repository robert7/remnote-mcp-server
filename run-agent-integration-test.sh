#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${SCRIPT_DIR}/node-check.sh" || exit 1

WAIT_TIMEOUT_SECONDS="${REMNOTE_AGENT_WAIT_TIMEOUT:-45}"
POLL_INTERVAL_SECONDS="${REMNOTE_AGENT_POLL_INTERVAL:-2}"
LOG_FILE="${REMNOTE_AGENT_SERVER_LOG:-${TMPDIR:-/tmp}/remnote-mcp-server-agent.log}"
CLI_REPO="${SCRIPT_DIR}/../remnote-cli"
CLI_DAEMON_LOG="${REMNOTE_AGENT_DAEMON_LOG:-${HOME}/.remnote-cli/daemon.log}"

started_server=0
deadline=$((SECONDS + WAIT_TIMEOUT_SECONDS))
built_server=0
built_cli=0

ensure_built_server() {
  if (( built_server == 1 )); then
    return
  fi

  echo "Building MCP server before startup..."
  npm run build
  built_server=1
}

ensure_built_cli() {
  if (( built_cli == 1 )); then
    return
  fi

  if [[ ! -d "${CLI_REPO}" ]]; then
    return
  fi

  echo "Building CLI before daemon shutdown checks..."
  (
    cd "${CLI_REPO}"
    source "${CLI_REPO}/node-check.sh" || exit 1
    npm run build
  )
  built_cli=1
}

status_output() {
  "${SCRIPT_DIR}/run-status-check.sh" 2>&1
}

cli_daemon_status() {
  if [[ ! -d "${CLI_REPO}" ]]; then
    return 1
  fi

  ensure_built_cli
  (
    cd "${CLI_REPO}"
    npm run start -- --text daemon status 2>&1
  )
}

stop_cli_daemon_if_running() {
  local output

  if ! output="$(cli_daemon_status)"; then
    return
  fi

  if ! grep -q 'Status: running' <<<"${output}"; then
    return
  fi

  echo "CLI daemon is running. Stopping it before starting the MCP server..."
  (
    cd "${CLI_REPO}"
    npm run start -- daemon stop
  )

  if [[ -f "${CLI_DAEMON_LOG}" ]]; then
    echo "Stopped CLI daemon. Log: ${CLI_DAEMON_LOG}"
  fi
}

start_server() {
  ensure_built_server
  echo "MCP server not reachable. Building and starting a background server..."
  nohup npm run start -- --log-level warn --log-file "${LOG_FILE}" >"${LOG_FILE}" 2>&1 &
  started_server=1
  echo "Background MCP server started. Log: ${LOG_FILE}"
}

stop_cli_daemon_if_running

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
if [[ -f "${LOG_FILE}" ]]; then
  echo "Background MCP server log: ${LOG_FILE}"
fi
exit 1
