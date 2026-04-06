#!/usr/bin/env python3
"""
Pushover Notification Script for macOS

Sends push notifications via Pushover API using credentials stored in macOS Keychain.
Secrets never appear in command line arguments or process lists.

Usage:
    po_notify.py "Title" "Message"
    po_notify.py "Title" "Message" --priority 1
    po_notify.py "Title" "Message" --priority 2 --retry 60 --expire 1800
    po_notify.py "Title" "Message" --url "https://example.com"
"""

import argparse
import subprocess
import urllib.error
import urllib.parse
import urllib.request


def get_keychain_password(service: str) -> str:
    """Retrieve a generic password from macOS Keychain by service name."""
    try:
        return subprocess.check_output(
            ["security", "find-generic-password", "-s", service, "-w"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except subprocess.CalledProcessError:
        raise SystemExit(
            f"Error: Could not find '{service}' in Keychain.\n"
            f"Add it with: security add-generic-password -U -a \"$USER\" -s {service} -w \"YOUR_SECRET\""
        )


def send_pushover(
    title: str,
    message: str,
    priority: int = 0,
    url: str = "",
    retry: int = 0,
    expire: int = 0,
) -> None:
    """Send a notification via Pushover API."""
    # Retrieve credentials from Keychain
    token = get_keychain_password("pushover_app_token")
    user = get_keychain_password("pushover_iphone_key")

    data = {
        "token": token,
        "user": user,
        "title": title,
        "message": message,
        "priority": str(priority),
    }

    # Emergency priority (2) requires retry and expire
    if priority == 2:
        if not retry or not expire:
            raise SystemExit(
                "Error: priority=2 (emergency) requires --retry and --expire.\n"
                "Example: po_notify.py 'Alert' 'Message' --priority 2 --retry 60 --expire 1800"
            )
        data["retry"] = str(retry)
        data["expire"] = str(expire)

    if url:
        data["url"] = url

    body = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(
        "https://api.pushover.net/1/messages.json",
        data=body,
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Pushover API error ({e.code}): {error_body}")
    except Exception as e:
        raise SystemExit(f"Pushover send failed: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Send push notifications via Pushover (credentials from Keychain)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s "Test" "Hello from macOS"
  %(prog)s "Alert" "Server down!" --priority 1
  %(prog)s "Emergency" "Critical failure!" --priority 2 --retry 60 --expire 1800
  %(prog)s "Link" "Check this out" --url "https://example.com"

Priority levels:
  -2  Lowest (no notification)
  -1  Low (quiet)
   0  Normal (default)
   1  High (bypass quiet hours)
   2  Emergency (repeats until acknowledged)
        """,
    )
    parser.add_argument("title", help="Notification title")
    parser.add_argument("message", help="Notification message")
    parser.add_argument(
        "--priority", "-p",
        type=int,
        default=0,
        choices=[-2, -1, 0, 1, 2],
        help="Priority level (default: 0)",
    )
    parser.add_argument(
        "--url", "-u",
        default="",
        help="Supplementary URL to include",
    )
    parser.add_argument(
        "--retry",
        type=int,
        default=0,
        help="Retry interval in seconds (required for priority 2)",
    )
    parser.add_argument(
        "--expire",
        type=int,
        default=0,
        help="Expiration time in seconds (required for priority 2)",
    )

    args = parser.parse_args()

    send_pushover(
        title=args.title,
        message=args.message,
        priority=args.priority,
        url=args.url,
        retry=args.retry,
        expire=args.expire,
    )

    print(f"Notification sent: {args.title}")


if __name__ == "__main__":
    main()
