#!/usr/bin/env python3
"""
Unified Hook - All Claude events flow through this.

Events handled:
- SessionStart, SessionEnd
- Stop
- Notification (permission_prompt)
- PreToolUse, PostToolUse, PostToolUseFailure
- UserPromptSubmit
- PreCompact
- PermissionRequest
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from router import get_router, Notification
from config import is_pushover_enabled


def event_type_to_notification_type(event_type: str) -> str | None:
    """Map Claude hook event to notification type."""
    mapping = {
        "Notification:permission_prompt": "permission_prompt",
        "Stop": "task_complete",
        "PostToolUse": "tool_complete",
        "SessionEnd": "session_end",
    }
    return mapping.get(event_type)


def build_notification(
    event_type: str,
    hook_input: dict,
) -> Notification | None:
    """Build Notification from hook input."""
    notify_type = event_type_to_notification_type(event_type)
    if not notify_type:
        return None

    if notify_type == "permission_prompt":
        return Notification(
            event_type=notify_type,
            title="Claude Permission",
            message=hook_input.get("message", "Awaiting permission"),
            priority=0,
        )

    elif notify_type == "task_complete":
        return Notification(
            event_type=notify_type,
            title="Claude Done",
            message="Task completed",
            priority=-1,
        )

    elif notify_type == "tool_complete":
        return Notification(
            event_type=notify_type,
            title="Claude Tool",
            message="Tool execution completed",
            priority=-2,
        )

    elif notify_type == "session_end":
        return Notification(
            event_type=notify_type,
            title="Claude Session",
            message="Session ended",
            priority=-2,
        )

    return None


def main():
    # Read hook input
    try:
        stdin_data = sys.stdin.read()
        hook_input = json.loads(stdin_data) if stdin_data.strip() else {}
    except json.JSONDecodeError:
        hook_input = {}

    # Build full event type
    event_type = hook_input.get("hook_event_name", "")
    if event_type == "Notification":
        notification_type = hook_input.get("notification_type", "")
        if notification_type:
            event_type = f"{event_type}:{notification_type}"

    # Build notification
    notification = build_notification(event_type, hook_input)
    if not notification:
        return

    # Get router and route
    router = get_router()
    router.route(notification.event_type, notification)


if __name__ == "__main__":
    main()
