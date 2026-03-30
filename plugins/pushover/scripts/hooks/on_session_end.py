#!/usr/bin/env python3
"""
Claude Code SessionEnd Hook - Unregister session (may stop service if last).

Receives via stdin:
{
  "session_id": "...",
  "hook_event_name": "SessionEnd"
}
"""

import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from service import unregister_session, get_client


def main():
    # Read hook input from stdin
    try:
        stdin_data = sys.stdin.read()
        hook_input = json.loads(stdin_data) if stdin_data.strip() else {}
    except json.JSONDecodeError:
        hook_input = {}

    session_id = hook_input.get("session_id", "")
    client = get_client()

    # Unregister session (service will shutdown if this was the last session)
    if client.is_running():
        result = unregister_session(session_id=session_id)
        if result and result.get("status") == "ok":
            count = result.get("session_count", 0)
            if result.get("shutting_down"):
                print(f"Last session, service shutting down", file=sys.stderr)
            else:
                print(f"Session unregistered (count={count})", file=sys.stderr)
        else:
            print("Warning: Could not unregister session", file=sys.stderr)


if __name__ == "__main__":
    main()
