"""
Notification Router - Core routing logic.

Loads config, maintains backend registry, routes notifications.
"""

from pathlib import Path
from typing import Any
import sys

# Use tomllib for Python 3.11+, fallback to toml for older versions
try:
    import tomllib
    HAS_TOMLLIB = True
except ImportError:
    try:
        import toml
        HAS_TOMLLIB = False
    except ImportError:
        print("ERROR: Need tomllib (Python 3.11+) or toml package", file=sys.stderr)
        sys.exit(1)

from .backends import (
    Notification,
    NotificationBackend,
    PushoverBackend,
    SlackBackend,
    LarkBackend,
    JenkinsBackend,
)


# Config file location
CONFIG_PATH = Path("~/.claude/notifications/config.toml").expanduser()

# Backend registry
BACKENDS: dict[str, NotificationBackend] = {
    "pushover": PushoverBackend(),
    "slack": SlackBackend(),
    "lark": LarkBackend(),
    "jenkins": JenkinsBackend(),
}


class NotificationRouter:
    """Notification router - core routing logic."""

    def __init__(self, config_path: Path | None = None):
        self.config_path = config_path or CONFIG_PATH
        self.config: dict[str, Any] = {}
        self.global_config: dict[str, Any] = {}
        self.routes: dict[str, list[str]] = {}
        self.backend_configs: dict[str, dict[str, Any]] = {}
        self._load_config()
        self._configure_backends()

    def _load_config(self) -> None:
        """Load config file or use defaults."""
        if not self.config_path.exists():
            self.config = self._default_config()
            return

        with open(self.config_path, "rb") as f:
            if HAS_TOMLLIB:
                self.config = tomllib.load(f)
            else:
                self.config = toml.load(f)

        self.global_config = self.config.get("global", {})
        self.routes = self.config.get("routes", {})
        self.backend_configs = self.config.get("backend", {})

    def _default_config(self) -> dict[str, Any]:
        """Default configuration."""
        return {
            "global": {
                "first_reminder_delay": 120,
                "enable_emergency_reminder": False,
                "emergency_priority": 1,
            },
            "routes": {},
            "backend": {},
        }

    def _configure_backends(self) -> None:
        """Configure all backends."""
        for name, backend in BACKENDS.items():
            config = self.backend_configs.get(name, {})
            if backend.is_enabled(config):
                backend.configure(config)

    def route(self, event_type: str, notification: Notification) -> None:
        """
        Route notification to configured backends.

        Args:
            event_type: Claude event type
            notification: Notification data
        """
        backend_names = self.routes.get(event_type, [])

        for name in backend_names:
            backend = BACKENDS.get(name)
            if backend:
                backend_config = self.backend_configs.get(name, {})
                if backend.is_enabled(backend_config):
                    backend.send(notification)

    def get_global_config(self, key: str, default: Any = None) -> Any:
        """Get global config value."""
        return self.global_config.get(key, default)


# Singleton instance
_router: NotificationRouter | None = None


def get_router() -> NotificationRouter:
    """Get router singleton."""
    global _router
    if _router is None:
        _router = NotificationRouter()
    return _router
