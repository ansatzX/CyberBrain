#!/bin/bash
# Create or read Stickies notes with markdown support
# Usage: iStickies.sh "<content>"      - Create a new sticky
#        iStickies.sh --read           - Read all displayed stickies
# Supports: # headers, **bold**, *italic*, - bullets, 1. numbered

# Handle --read option
if [ "$1" = "--read" ]; then
    osascript -e '
    set output to ""
    tell application "Stickies"
        if not running then
            return "Stickies app is not running"
        end if
        activate
        delay 0.2
    end tell

    tell application "System Events"
        tell process "Stickies"
            set windowCount to count of windows
            if windowCount is 0 then
                return "No stickies found"
            end if

            repeat with i from 1 to windowCount
                set winName to name of window i

                -- Get text content directly via accessibility API
                try
                    set textArea to scroll area 1 of window i
                    set stickyContent to value of text area 1 of textArea
                on error
                    -- Fallback: try to get from first text area
                    try
                        set stickyContent to value of text area 1 of window i
                    on error
                        set stickyContent to "(Could not read content)"
                    end try
                end try

                if output is not "" then
                    set output to output & "\n---\n"
                end if
                set output to output & "## " & winName & "\n" & stickyContent
            end repeat
        end tell
    end tell

    return output
    '
    exit 0
fi

CONTENT="$1"

if [ -z "$CONTENT" ]; then
    echo "Usage: iStickies.sh <content>   - Create a new sticky"
    echo "       iStickies.sh --read      - Read all displayed stickies" >&2
    exit 1
fi

# Convert markdown to HTML
md_to_html() {
    echo "$1" | sed \
        -e 's/^### \(.*\)$/<h3>\1<\/h3>/g' \
        -e 's/^## \(.*\)$/<h2>\1<\/h2>/g' \
        -e 's/^# \(.*\)$/<h1>\1<\/h1>/g' \
        -e 's/\*\*\([^*]*\)\*\*/<b>\1<\/b>/g' \
        -e 's/\*\([^*]*\)\*/<i>\1<\/i>/g' \
        -e 's/^- \(.*\)$/\&bull; \1/g' \
        -e 's/^[0-9]\. \(.*\)$/  &/g' \
        -e 's/`\([^`]*\)`/<code>\1<\/code>/g' \
        -e 's/$/<br>/g' | \
    tr '\n' ' ' | \
    sed 's/<br> *<h/<h/g; s/<\/h[1-3]><br>/<\/h1>/g'
}

HTML="<html><body style=\"font-family: -apple-system, Helvetica; font-size: 13px;\">$(md_to_html "$CONTENT")</body></html>"

# Convert HTML to RTF and save to temp file
TMPFILE=$(mktemp /tmp/sticky.XXXXXX.rtf)
echo "$HTML" | textutil -convert rtf -stdin -stdout > "$TMPFILE"

# Copy RTF to clipboard using AppleScript
osascript -e "set the clipboard to (read POSIX file \"$TMPFILE\" as «class RTF »)"

# Create sticky and paste
osascript -e '
tell application "Stickies" to activate
delay 0.3
tell application "System Events"
    tell process "Stickies"
        keystroke "n" using command down
        delay 0.2
        keystroke "v" using command down
    end tell
end tell
'

rm -f "$TMPFILE"
echo "Sticky note created"
