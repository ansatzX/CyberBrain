"""
Jenkins Trigger Backend.

Triggers Jenkins builds via remote build trigger.
"""

import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from .base import Notification, NotificationBackend


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


class JenkinsBackend(NotificationBackend):
    """Jenkins trigger backend."""

    def __init__(self):
        self._enabled = False
        self._url: str | None = None
        self._job: str | None = None

    def name(self) -> str:
        return "jenkins"

    def is_enabled(self, config: dict[str, Any]) -> bool:
        return bool(config.get("enabled", False)) and bool(config.get("url")) and bool(config.get("job"))

    def configure(self, config: dict[str, Any]) -> None:
        self._enabled = self.is_enabled(config)
        self._url = config.get("url")
        self._job = config.get("job")

    def send(self, notification: Notification) -> bool:
        if not self._enabled or not self._url or not self._job:
            return False

        # Get trigger token from Keychain
        token = get_keychain_password("jenkins_trigger_token")
        if not token:
            print("jenkins_trigger_token not found in Keychain", file=sys.stderr)
            return False

        # Build URL: {url}/job/{urlencoded_job}/build?token={token}
        encoded_job = urllib.parse.quote(self._job, safe="")
        url = f"{self._url.rstrip('/')}/job/{encoded_job}/build"

        try:
            data = urllib.parse.urlencode({"token": token}).encode("utf-8")
            req = urllib.request.Request(url, data=data, method="POST")

            # Add auth if available
            jenkins_user = get_keychain_password("jenkins_user")
            jenkins_api_token = get_keychain_password("jenkins_api_token")
            if jenkins_user and jenkins_api_token:
                import base64
                auth = base64.b64encode(f"{jenkins_user}:{jenkins_api_token}".encode()).decode()
                req.add_header("Authorization", f"Basic {auth}")

            with urllib.request.urlopen(req, timeout=10) as resp:
                # Jenkins returns 201 Created on success
                return resp.status in (200, 201)
        except urllib.error.HTTPError as e:
            print(f"Jenkins HTTP error ({e.code}): {e.read().decode()}", file=sys.stderr)
            return False
        except Exception as e:
            print(f"Jenkins trigger error: {e}", file=sys.stderr)
            return False
