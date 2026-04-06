"""
Configuration module for the notifications plugin.

Allows users to enable/disable features via simple config files:

~/.claude/notifications/
├── pushover-enabled          # Enables Pushover features
├── pushover-completion       # Enables task completion notifications
├── jenkins-enabled           # Enables Jenkins triggers
└── config.json               # Optional JSON config (future use)

If the marker file exists, the feature is enabled.
All features are disabled by default for safety.
"""

from pathlib import Path


# Configuration directory
CONFIG_DIR = Path("~/.claude/notifications").expanduser()

# Feature names (avoids string repetition)
FEATURES = {
    "pushover": "pushover-enabled",
    "pushover_completion": "pushover-completion",
    "jenkins": "jenkins-enabled",
}


def _ensure_config_dir() -> None:
    """Ensure the config directory exists."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def _get_marker_path(feature: str) -> Path:
    """Get the marker file path for a feature."""
    return CONFIG_DIR / FEATURES[feature]


def is_enabled(feature: str) -> bool:
    """Check if a feature is enabled."""
    return _get_marker_path(feature).exists()


# Convenience functions for specific features
def is_pushover_enabled() -> bool:
    return is_enabled("pushover")


def is_pushover_completion_enabled() -> bool:
    return is_enabled("pushover_completion")


def is_jenkins_enabled() -> bool:
    return is_enabled("jenkins")


def enable(feature: str) -> None:
    """Enable a feature."""
    _ensure_config_dir()
    _get_marker_path(feature).touch()


def enable_pushover() -> None:
    enable("pushover")


def enable_pushover_completion() -> None:
    enable("pushover_completion")


def enable_jenkins() -> None:
    enable("jenkins")


def disable(feature: str) -> None:
    """Disable a feature."""
    marker = _get_marker_path(feature)
    if marker.exists():
        marker.unlink()


def disable_pushover() -> None:
    disable("pushover")


def disable_pushover_completion() -> None:
    disable("pushover_completion")


def disable_jenkins() -> None:
    disable("jenkins")


def get_status() -> dict[str, bool]:
    """Get status of all features."""
    return {name: is_enabled(name) for name in FEATURES}


def print_quick_guide() -> None:
    """Print a quick guide to enable/disable features."""
    import sys
    print("Notifications Plugin - Quick Configuration", file=sys.stderr)
    print("", file=sys.stderr)
    print("To enable features, create these files:", file=sys.stderr)
    print(f"  touch {CONFIG_DIR}/pushover-enabled    # Enable Pushover", file=sys.stderr)
    print(f"  touch {CONFIG_DIR}/pushover-completion # Enable completion only", file=sys.stderr)
    print(f"  touch {CONFIG_DIR}/jenkins-enabled     # Enable Jenkins", file=sys.stderr)
    print("", file=sys.stderr)
    print("To disable, delete the file:", file=sys.stderr)
    print(f"  rm {CONFIG_DIR}/pushover-enabled", file=sys.stderr)
    print("", file=sys.stderr)
    print("Current status:", file=sys.stderr)
    status = get_status()
    for name, enabled in status.items():
        status_str = "✓ enabled" if enabled else "✗ disabled"
        print(f"  {name:20s} {status_str}", file=sys.stderr)


if __name__ == "__main__":
    import sys
    print_quick_guide()
