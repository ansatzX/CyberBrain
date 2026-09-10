#!/usr/bin/env bash
# Run one already-authorized Pi round. Tool restrictions are not an OS sandbox.
set -euo pipefail
if [ "$#" -ne 6 ]; then
  echo 'Usage: bash run-round.sh TARGET LOG_DIR SESSION ROUND read-only|workspace-write PROMPT_FILE' >&2
  exit 2
fi
target="$(cd -- "$1" && pwd -P)"
log_dir="$2"
session="$3"
round="$4"
boundary="$5"
prompt="$(cat -- "$6")"
case "$round" in ''|*[!0-9]*) echo 'ROUND must be an integer' >&2; exit 2;; esac
case "$boundary" in read-only|workspace-write) ;; *) echo 'Invalid execution boundary' >&2; exit 2;; esac
test -n "$session" && test -n "$prompt" || { echo 'Session and prompt must be non-empty' >&2; exit 2; }
mkdir -p -- "$log_dir"
log_dir="$(cd -- "$log_dir" && pwd -P)"
record="$(printf '%s\n' "$target" "$session" "$boundary")"
if [ -e "$log_dir/execution-boundary.txt" ]; then
  if [ "$(cat -- "$log_dir/execution-boundary.txt")" != "$record" ]; then
    echo 'Target, session or boundary changed; refusing to silently change the resumed task' >&2
    exit 2
  fi
else
  printf '%s\n' "$record" > "$log_dir/execution-boundary.txt"
fi
args=(--session-id "$session")
if [ "$boundary" = read-only ]; then
  args+=(--tools read,grep,find,ls)
fi
args+=(--print "$prompt")
log="$log_dir/session.log"
printf '===== round %s %s =====\n' "$round" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$log"
cd -- "$target"
if pi "${args[@]}" >> "$log" 2>&1; then
  result=0
else
  result=$?
fi
printf 'Round %s exited %s; inspect bounded evidence in %s\n' "$round" "$result" "$log"
exit "$result"
