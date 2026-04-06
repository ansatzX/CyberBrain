#!/usr/bin/env python3
"""
Escalation Control - CLI for managing the escalation service.

Usage:
    escalation_ctl start              Start service if not running
    escalation_ctl stop               Force stop the service
    escalation_ctl status             Show sessions (with PIDs) and pending escalations

    escalation_ctl add <id> <msg>     Add an escalation manually
    escalation_ctl cancel <id>        Cancel an escalation

    escalation_ctl register [--session-id ID] [--pid PID]
                                      Register a session with PID tracking
    escalation_ctl unregister [--session-id ID]
                                      Unregister a session

Examples:
    # Simulate full Claude Code flow with PID tracking
    escalation_ctl start
    escalation_ctl register --session-id my-session --pid $$
    escalation_ctl add my-session "Waiting for permission"
    escalation_ctl status
    escalation_ctl cancel my-session
    escalation_ctl unregister --session-id my-session

    # Test PID auto-cleanup (register with non-existent PID)
    escalation_ctl register --pid 99999
    # Wait 60s, then check status - session should be auto-removed

    # Add escalation with custom delays (5s, 30s)
    escalation_ctl add test "Test message" --delays 5,30
"""

import argparse
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from escalation_client import EscalationClient


def cmd_start(client: EscalationClient, _args: argparse.Namespace) -> int:
    """Start the escalation service."""
    if client.is_running():
        print("Service is already running")
        return 0

    print("Starting escalation service...")
    if client.start_service_if_needed():
        print("Service started successfully")
        return 0
    else:
        print("Failed to start service", file=sys.stderr)
        return 1


def cmd_stop(client: EscalationClient, _args: argparse.Namespace) -> int:
    """Stop the escalation service."""
    if not client.is_running():
        print("Service is not running")
        return 0

    print("Stopping escalation service...")
    result = client.shutdown_service()
    if result and result.get("status") == "ok":
        print("Service stopped")
        return 0
    else:
        print("Failed to stop service", file=sys.stderr)
        return 1


def cmd_status(client: EscalationClient, _args: argparse.Namespace) -> int:
    """Show service status and pending escalations."""
    if not client.is_running():
        print("Service is not running")
        return 1

    result = client.get_status()
    if not result:
        print("Failed to get status", file=sys.stderr)
        return 1

    sessions = result.get("sessions", {})
    pending = result.get("pending", [])

    print(f"Service is running. {len(sessions)} session(s):")
    if sessions:
        for sid, info in sessions.items():
            pid = info.get("pid", "?")
            age = info.get("age", 0)
            print(f"  {sid[:16]}{'...' if len(sid) > 16 else ''} pid={pid} age={age:.0f}s")
    print()

    if not pending:
        print("No pending escalations.")
    else:
        print(f"{len(pending)} pending escalation(s):")
        print()
        for item in pending:
            eid = item.get("escalation_id", "unknown")
            msg = item.get("message", "")[:50]
            count = item.get("pending_count", 0)
            next_fire = item.get("next_fire_in", 0)
            print(f"  ID: {eid}")
            print(f"  Message: {msg}...")
            print(f"  Pending notifications: {count}")
            print(f"  Next fire in: {next_fire:.0f}s")
            print()

    return 0


def cmd_register(client: EscalationClient, args: argparse.Namespace) -> int:
    """Register a session with optional PID tracking."""
    if not client.start_service_if_needed():
        print("Failed to start service", file=sys.stderr)
        return 1

    result = client.register_session(session_id=args.session_id, pid=args.pid)
    if result and result.get("status") == "ok":
        count = result.get("session_count", 1)
        sid = result.get("session_id", "unknown")
        print(f"Session registered: {sid} (pid={args.pid}, count={count})")
        return 0
    else:
        print("Failed to register session", file=sys.stderr)
        return 1


def cmd_unregister(client: EscalationClient, args: argparse.Namespace) -> int:
    """Unregister a session (decrement ref count)."""
    if not client.is_running():
        print("Service is not running")
        return 1

    result = client.unregister_session(session_id=args.session_id)
    if result and result.get("status") == "ok":
        count = result.get("session_count", 0)
        sid = result.get("session_id", "unknown")
        if result.get("shutting_down"):
            print(f"Session unregistered: {sid}. Last session, service shutting down.")
        else:
            print(f"Session unregistered: {sid} (count={count})")
        return 0
    else:
        print("Failed to unregister session", file=sys.stderr)
        return 1


def cmd_add(client: EscalationClient, args: argparse.Namespace) -> int:
    """Add an escalation manually."""
    result = client.add_escalation(
        escalation_id=args.escalation_id,
        message=args.message,
        delays=args.delays,
        auto_start=True,
    )

    if result and result.get("status") == "ok":
        print(f"Added escalation: {args.escalation_id}")
        return 0
    else:
        print("Failed to add escalation", file=sys.stderr)
        return 1


def cmd_cancel(client: EscalationClient, args: argparse.Namespace) -> int:
    """Cancel an escalation."""
    if not client.is_running():
        print("Service is not running")
        return 1

    result = client.cancel_escalation(args.escalation_id)
    if result and result.get("status") == "ok":
        if result.get("cancelled"):
            print(f"Cancelled escalation: {args.escalation_id}")
        else:
            print(f"No escalation found with ID: {args.escalation_id}")
        return 0
    else:
        print("Failed to cancel escalation", file=sys.stderr)
        return 1


def main():
    parser = argparse.ArgumentParser(
        description="Control the escalation service",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # start command
    subparsers.add_parser("start", help="Start the service")

    # stop command
    subparsers.add_parser("stop", help="Stop the service")

    # status command
    subparsers.add_parser("status", help="Show service status")

    # add command
    add_parser = subparsers.add_parser("add", help="Add an escalation")
    add_parser.add_argument("escalation_id", help="Unique ID for the escalation")
    add_parser.add_argument("message", help="Notification message")
    add_parser.add_argument(
        "--delays",
        type=lambda s: [int(x) for x in s.split(",")],
        default=None,
        help="Comma-separated delays in seconds (default: 60,3600)",
    )

    # cancel command
    cancel_parser = subparsers.add_parser("cancel", help="Cancel an escalation")
    cancel_parser.add_argument("escalation_id", help="ID of the escalation to cancel")

    # register command
    register_parser = subparsers.add_parser("register", help="Register a session with PID tracking")
    register_parser.add_argument("--session-id", dest="session_id", help="Session ID (default: auto-generated)")
    register_parser.add_argument("--pid", type=int, help="PID to track (default: current shell PID)")

    # unregister command
    unregister_parser = subparsers.add_parser("unregister", help="Unregister a session")
    unregister_parser.add_argument("--session-id", dest="session_id", help="Session ID to unregister (default: oldest)")

    args = parser.parse_args()
    client = EscalationClient()

    commands = {
        "start": cmd_start,
        "stop": cmd_stop,
        "status": cmd_status,
        "add": cmd_add,
        "cancel": cmd_cancel,
        "register": cmd_register,
        "unregister": cmd_unregister,
    }

    return commands[args.command](client, args)


if __name__ == "__main__":
    sys.exit(main())
