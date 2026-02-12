#!/bin/bash

# Ensure Node.js is available via PATH or NVM
source "$(dirname "$0")/node-check.sh" || exit 1

npm run dev -- "$@"