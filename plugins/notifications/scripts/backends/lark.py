"""
Lark (Feishu) Webhook Notification Backend.

Sends notifications to Lark via incoming webhook.
"""

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from .base import Notification, NotificationBackend


class LarkBackend(NotificationBackend):
    """Lark (Feishu) webhook notification backend."""

    def __init__(self):
        self._enabled = False
        self._webhook_url: str | None = None

    def name(self) -> str:
        return "lark"

    def is_enabled(self, config: dict[str, Any]) -> bool:
        return bool(config.get("enabled", False)) and bool(config.get("webhook_url"))

    def configure(self, config: dict[str, Any]) -> None:
        self._enabled = self.is_enabled(config)
        self._webhook_url = config.get("webhook_url")

    def send(self, notification: Notification) -> bool:
        if not self._enabled or not self._webhook_url:
            return False

        # Build Lark message payload
        payload = {
            "msg_type": "text",
            "content": {
                "text": f"{notification.title}\n{notification.message}"
            }
        }

        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                self._webhook_url,
                data=data,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.load(resp)
                return result.get("code") == 0
        except urllib.error.HTTPError as e:
            print(f"Lark HTTP error ({e.code}): {e.read().decode()}", file=sys.stderr)
            return False
        except Exception as e:
            print(f"Lark notification error: {e}", file=sys.stderr)
            return False
