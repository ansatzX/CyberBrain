"""
Notification Backend Interface and Data Structures.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Notification:
    """Notification data structure."""
    event_type: str  # "permission_prompt", "task_complete", "tool_complete", "session_end"
    title: str
    message: str
    priority: int = 0  # -2 to 2
    metadata: dict[str, Any] = field(default_factory=dict)


class NotificationBackend(ABC):
    """Abstract base class for notification backends."""

    @abstractmethod
    def name(self) -> str:
        """Return backend name, e.g., "pushover", "slack"."""
        pass

    @abstractmethod
    def is_enabled(self, config: dict[str, Any]) -> bool:
        """Check if backend is enabled from config."""
        pass

    @abstractmethod
    def configure(self, config: dict[str, Any]) -> None:
        """Configure backend from config.toml."""
        pass

    @abstractmethod
    def send(self, notification: Notification) -> bool:
        """Send notification, return success status."""
        pass
