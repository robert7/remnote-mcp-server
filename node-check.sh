#!/bin/bash

# Node.js Availability Check with NVM Fallback
#
# Purpose: Ensures Node.js and npm are available before running npm commands.
#          If Node is not in PATH, attempts to load it via NVM.
#          Designed to be sourced by other scripts: source ./node-check.sh
#
# Exit Codes:
#   0 - Success: Node.js and npm are available
#   1 - Failure: Node.js not available and couldn't be loaded
#
# Usage:
#   source "$(dirname "$0")/node-check.sh" || exit 1

# Check if Node.js is already available in PATH
if command -v node &> /dev/null && command -v npm &> /dev/null; then
  # Node and npm are already available, exit silently
  return 0 2>/dev/null || exit 0
fi

# Node not in PATH, attempt to load via NVM
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # Source NVM
  source "$HOME/.nvm/nvm.sh" &> /dev/null

  # Load default Node version
  if ! nvm use default &> /dev/null; then
    echo "Error: NVM found but unable to load default Node version." >&2
    echo "Please configure NVM with: nvm install --lts && nvm alias default lts/*" >&2
    return 1 2>/dev/null || exit 1
  fi
else
  # NVM not found
  echo "Error: Node.js not found and NVM is not installed." >&2
  echo "Please install Node.js via:" >&2
  echo "  - NVM: https://github.com/nvm-sh/nvm" >&2
  echo "  - Official installer: https://nodejs.org/" >&2
  return 1 2>/dev/null || exit 1
fi

# Final verification that both node and npm are now available
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
  echo "Error: Node.js setup failed. node or npm command not found." >&2
  return 1 2>/dev/null || exit 1
fi

# Success - Node.js and npm are available
return 0 2>/dev/null || exit 0
