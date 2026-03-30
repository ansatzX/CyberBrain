#!/usr/bin/env python3
"""
Claude Code Permission Notification Hook

Sends an escalation request to the escalation service when Claude
is waiting for permission approval.

The escalation service will send:
- After 60s: priority 0 (normal) notification
- After 3600s: priority 2 (emergency) notification

If the user grants permission, on_post_tool.py will cancel the escalation.

Receives via stdin:
{
  "session_id": "...",
  "tool_use_id": "...",
  "message": "Claude needs permission to...",
  "notification_type": "permission_prompt"
}
"""

import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from service import add_escalation, start_service


# Escalation delays in seconds
DELAYS = [60, 3600]  # 1 min, 1 hour


def main():
    # Read hook input from stdin
    try:
        stdin_data = sys.stdin.read()
        hook_input = json.loads(stdin_data) if stdin_data.strip() else {}
    except json.JSONDecodeError:
        hook_input = {}

    notification_type = hook_input.get("notification_type", "")

    # Only handle permission_prompt notifications
    if notification_type != "permission_prompt":
        return

    # Extract session info
    session_id = hook_input.get("session_id", "unknown")
    message = hook_input.get("message", "Awaiting permission approval")

    # Use session_id as escalation key for session-level tracking
    # This allows any subsequent hook (accept/reject/other activity) to cancel
    escalation_id = session_id

    # Ensure service is running (fallback if SessionStart didn't fire)
    start_service()

    # Add escalation to the service
    result = add_escalation(
        escalation_id=escalation_id,
        message=message,
        delays=DELAYS,
    )

    if result and result.get("status") == "ok":
        print(f"Escalation added: {escalation_id}", file=sys.stderr)
    else:
        print(f"Warning: Could not add escalation", file=sys.stderr)


if __name__ == "__main__":
    main()
