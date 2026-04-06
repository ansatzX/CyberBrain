#!/bin/bash
# Wrapper script for Pushover notifications
# Usage: notify.sh "Title" "Message" [options]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

python3 "$PLUGIN_DIR/tools/pushover-notify/po_notify.py" "$@"
