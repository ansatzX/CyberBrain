#!/bin/bash
# Send iMessage
# Usage: imessage.sh <recipient> <message>

TO="$1"
MSG="$2

-- Sent from an AI agent. Be cautious."

if [ -z "$TO" ] || [ -z "$2" ]; then
    echo "Usage: imessage.sh <recipient> <message>"
    exit 1
fi

osascript -e "tell application \"Messages\"
set s to first service whose service type = iMessage
send \"$MSG\" to buddy \"$TO\" of s
end tell"
