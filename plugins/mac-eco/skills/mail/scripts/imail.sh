#!/bin/bash
# Send email via Mail.app
# Usage: imail.sh <recipient> <subject> <body>

TO="$1"
SUBJ="$2"
BODY="$3

-- Sent from an AI agent. Be cautious."

if [ -z "$TO" ] || [ -z "$SUBJ" ] || [ -z "$3" ]; then
    echo "Usage: imail.sh <recipient> <subject> <body>"
    exit 1
fi

osascript -e 'on run argv
set theTo to item 1 of argv
set theSubj to item 2 of argv
set theBody to item 3 of argv
tell application "Mail"
set m to make new outgoing message with properties {subject:theSubj, content:theBody & return & return, visible:false}
tell m to make new to recipient with properties {address:theTo}
send m
end tell
end run' "$TO" "$SUBJ" "$BODY"
