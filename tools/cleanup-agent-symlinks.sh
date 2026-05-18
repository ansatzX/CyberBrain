#!/usr/bin/env bash
# Clean up agent role symlinks in ~/.codex/agents/
#
# Plugins use SessionStart hooks to symlink agent .toml files into
# ~/.codex/agents/. This script removes all such symlinks.
# Any plugin that is still enabled will re-create its symlinks on next session start.
#
# Usage: bash cleanup-agent-symlinks.sh
set -euo pipefail

AGENTS_DIR="${HOME}/.codex/agents"

if [ ! -d "$AGENTS_DIR" ]; then
    echo "Nothing to do: ${AGENTS_DIR} does not exist"
    exit 0
fi

candidates=()
for f in "$AGENTS_DIR"/*.toml; do
    [ -L "$f" ] || continue    # only symlinks; skip regular files
    target=$(readlink "$f")
    candidates+=("$(basename "$f") -> $target")
done

if [ "${#candidates[@]}" -eq 0 ]; then
    echo "No agent symlinks found in ${AGENTS_DIR}"
    exit 0
fi

echo "The following symlinks will be removed from ${AGENTS_DIR}:"
for c in "${candidates[@]}"; do
    echo "  $c"
done
echo "(Regular .toml files are left untouched.)"
echo ""

read -r -p "Proceed? [y/N] " response
case "$response" in
    [yY][eE][sS]|[yY]) ;;
    *) echo "Aborted."; exit 0 ;;
esac

removed=0
for f in "$AGENTS_DIR"/*.toml; do
    [ -L "$f" ] || continue
    rm "$f"
    echo "Removed: $(basename "$f")"
    removed=$((removed + 1))
done

echo "Done: removed ${removed} symlink(s)"
