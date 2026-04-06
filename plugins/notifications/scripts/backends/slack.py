"""
Slack Webhook Notification Backend.

Sends notifications to Slack via incoming webhook.
"""

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from .base import Notification, NotificationBackend


class SlackBackend(NotificationBackend):
    """Slack webhook notification backend."""

    def __init__(self):
        self._enabled = False
        self._webhook_url: str | None = None
        self._channel: str | None = None
        self._username: str = "Claude Code"

    def name(self) -> str:
        return "slack"

    def is_enabled(self, config: dict[str, Any]) -> bool:
        return bool(config.get("enabled", False)) and bool(config.get("webhook_url"))

    def configure(self, config: dict[str, Any]) -> None:
        self._enabled = self.is_enabled(config)
        self._webhook_url = config.get("webhook_url")
        self._channel = config.get("channel")
        if config.get("username"):
            self._username = config["username"]

    def send(self, notification: Notification) -> bool:
        if not self._enabled or not self._webhook_url:
            return False

        # Build payload
        payload = {
            "username": self._username,
            "text": f"*{notification.title}*\n{notification.message}",
        }
        if self._channel:
            payload["channel"] = self._channel

        # Color based on priority
        if notification.priority >= 1:
            payload["attachments"] = [{"color": "danger"}]
        elif notification.priority >= 0:
            payload["attachments"] = [{"color": "good"}]

        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                self._webhook_url,
                data=data,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status in (200, 204)
        except urllib.error.HTTPError as e:
            print(f"Slack HTTP error ({e.code}): {e.read().decode()}", file=sys.stderr)
            return False
        except Exception as e:
            print(f"Slack notification error: {e}", file=sys.stderr)
            return False
