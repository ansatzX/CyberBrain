"""
Pushover Notification Backend.

Uses existing po_notify.py and Keychain credentials.
"""

from pathlib import Path
import subprocess
import sys
from typing import Any

from .base import Notification, NotificationBackend


# Path to po_notify.py relative to this file
PO_NOTIFY_SCRIPT = Path(__file__).parent.parent.parent / "tools" / "pushover-notify" / "po_notify.py"


def get_keychain_password(service: str) -> str | None:
    """Retrieve a generic password from macOS Keychain by service name."""
    try:
        return subprocess.check_output(
            ["security", "find-generic-password", "-s", service, "-w"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except subprocess.CalledProcessError:
        return None


class PushoverBackend(NotificationBackend):
    """Pushover notification backend."""

    def __init__(self):
        self._enabled = False

    def name(self) -> str:
        return "pushover"

    def is_enabled(self, config: dict[str, Any]) -> bool:
        return bool(config.get("enabled", False))

    def configure(self, config: dict[str, Any]) -> None:
        self._enabled = self.is_enabled(config)

    def send(self, notification: Notification) -> bool:
        if not self._enabled:
            return False

        # Check if po_notify exists
        if not PO_NOTIFY_SCRIPT.exists():
            print(f"po_notify not found: {PO_NOTIFY_SCRIPT}", file=sys.stderr)
            return False

        # Check if credentials are available
        if not (get_keychain_password("pushover_app_token") and get_keychain_password("pushover_iphone_key")):
            print("Pushover credentials not found in Keychain", file=sys.stderr)
            return False

        try:
            cmd = [
                sys.executable,
                str(PO_NOTIFY_SCRIPT),
                notification.title,
                notification.message,
                "--priority",
                str(notification.priority),
            ]
            result = subprocess.run(
                cmd,
                check=True,
                capture_output=True,
                timeout=10,
            )
            return result.returncode == 0
        except subprocess.CalledProcessError as e:
            print(f"Pushover notification failed: {e.stderr.decode()}", file=sys.stderr)
            return False
        except Exception as e:
            print(f"Pushover notification error: {e}", file=sys.stderr)
            return False
