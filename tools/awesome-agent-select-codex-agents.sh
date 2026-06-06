#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)"
TARGET_SCRIPT="${REPO_ROOT}/plugins/awesome-agent-select/tools/manage-codex-agents.sh"

if [ ! -f "$TARGET_SCRIPT" ]; then
    printf 'Error: installer script not found: %s\n' "$TARGET_SCRIPT" >&2
    exit 1
fi

exec bash "$TARGET_SCRIPT" "$@"
