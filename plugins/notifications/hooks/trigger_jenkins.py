#!/usr/bin/env python3
"""
Claude Code Hook - Trigger Jenkins Job on Events.

Triggers a Jenkins job when specified Claude Code events occur.

Supported events:
- Stop: Claude finished responding
- PostToolUse: A tool finished executing
- SessionEnd: Session ended

Credential Providers (configurable):
- keychain: macOS Keychain (default)
- env: Environment variables
- json: JSON file (~/.claude/jenkins-config.json)

Configuration by provider:

1. Keychain (default):
   - jenkins_url: Jenkins base URL (e.g., "https://jenkins.example.com")
   - jenkins_user: Jenkins username
   - jenkins_api_token: Jenkins API token (not password!)
   - jenkins_job: Job name (e.g., "my-deploy-job")
   - jenkins_trigger_token: Job trigger token (configured in job settings)

2. Environment variables:
   - JENKINS_URL
   - JENKINS_USER
   - JENKINS_API_TOKEN
   - JENKINS_JOB
   - JENKINS_TRIGGER_TOKEN

3. JSON file (~/.claude/jenkins-config.json):
   {
     "jenkins_url": "https://jenkins.example.com",
     "jenkins_user": "your-username",
     "jenkins_api_token": "your-api-token",
     "jenkins_job": "job-name",
     "jenkins_trigger_token": "trigger-token"
   }

Select provider via:
- Environment variable: JENKINS_CREDENTIAL_PROVIDER=keychain|env|json
- Or default to keychain

Receives via stdin:
{
  "session_id": "...",
  "hook_event_name": "Stop",
  ...
}
"""

from __future__ import annotations

import abc
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import config as plugin_config


# =============================================================================
# Credential Provider Interface
# =============================================================================

class CredentialProvider(abc.ABC):
    """Abstract base class for credential providers."""

    @abc.abstractmethod
    def get(self, key: str) -> str | None:
        """Get a credential value by key."""
        pass

    @abc.abstractmethod
    def is_available(self) -> bool:
        """Check if this provider is available/supported."""
        pass

    @abc.abstractmethod
    def name(self) -> str:
        """Return the name of this provider."""
        pass


# =============================================================================
# Keychain Credential Provider (macOS)
# =============================================================================

class KeychainCredentialProvider(CredentialProvider):
    """Read credentials from macOS Keychain."""

    def name(self) -> str:
        return "keychain"

    def is_available(self) -> bool:
        return sys.platform == "darwin"

    def get(self, key: str) -> str | None:
        if not self.is_available():
            return None
        try:
            import subprocess
            return subprocess.check_output(
                ["security", "find-generic-password", "-s", key, "-w"],
                text=True,
                stderr=subprocess.DEVNULL,
            ).strip()
        except subprocess.CalledProcessError:
            return None


# =============================================================================
# Environment Variable Credential Provider
# =============================================================================

class EnvCredentialProvider(CredentialProvider):
    """Read credentials from environment variables."""

    # Map our internal keys to env var names
    KEY_MAP = {
        "jenkins_url": "JENKINS_URL",
        "jenkins_user": "JENKINS_USER",
        "jenkins_api_token": "JENKINS_API_TOKEN",
        "jenkins_job": "JENKINS_JOB",
        "jenkins_trigger_token": "JENKINS_TRIGGER_TOKEN",
    }

    def name(self) -> str:
        return "env"

    def is_available(self) -> bool:
        return True  # Always available

    def get(self, key: str) -> str | None:
        env_key = self.KEY_MAP.get(key, key.upper())
        return os.environ.get(env_key)


# =============================================================================
# JSON File Credential Provider
# =============================================================================

class JsonFileCredentialProvider(CredentialProvider):
    """Read credentials from a JSON file."""

    DEFAULT_PATH = Path("~/.claude/jenkins-config.json").expanduser()

    def __init__(self, file_path: Path | None = None):
        self.file_path = file_path or self.DEFAULT_PATH
        self._cache: dict[str, str] | None = None

    def name(self) -> str:
        return "json"

    def is_available(self) -> bool:
        return self.file_path.exists()

    def _load(self) -> dict[str, str]:
        if self._cache is not None:
            return self._cache
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                self._cache = json.load(f)
        except (json.JSONDecodeError, OSError):
            self._cache = {}
        return self._cache

    def get(self, key: str) -> str | None:
        data = self._load()
        return data.get(key)


# =============================================================================
# Provider Registry & Factory
# =============================================================================

class CredentialProviderRegistry:
    """Registry of available credential providers."""

    def __init__(self):
        self._providers: dict[str, CredentialProvider] = {}

    def register(self, provider: CredentialProvider) -> None:
        """Register a credential provider."""
        self._providers[provider.name()] = provider

    def get(self, name: str) -> CredentialProvider | None:
        """Get a provider by name."""
        return self._providers.get(name)

    def list_available(self) -> list[CredentialProvider]:
        """List all available providers."""
        return [p for p in self._providers.values() if p.is_available()]


# Create global registry
_registry = CredentialProviderRegistry()
_registry.register(KeychainCredentialProvider())
_registry.register(EnvCredentialProvider())
_registry.register(JsonFileCredentialProvider())


def get_credential_provider() -> CredentialProvider:
    """
    Get the credential provider to use.

    Priority:
    1. JENKINS_CREDENTIAL_PROVIDER environment variable
    2. First available provider (keychain -> env -> json)
    """
    # Check environment variable override
    provider_name = os.environ.get("JENKINS_CREDENTIAL_PROVIDER")
    if provider_name:
        provider = _registry.get(provider_name)
        if provider and provider.is_available():
            return provider
        print(f"Warning: Provider '{provider_name}' not available, falling back", file=sys.stderr)

    # Fall back to first available
    available = _registry.list_available()
    if not available:
        raise RuntimeError("No credential providers available")
    return available[0]


# =============================================================================
# Jenkins Trigger Functions
# =============================================================================

def trigger_jenkins_job(
    jenkins_url: str,
    job_name: str,
    trigger_token: str,
    username: str,
    api_token: str,
    parameters: dict[str, str] | None = None,
) -> bool:
    """
    Trigger a Jenkins job.

    Args:
        jenkins_url: Jenkins base URL (e.g., "https://jenkins.example.com")
        job_name: Name of the job to trigger
        trigger_token: Trigger token configured in job settings
        username: Jenkins username
        api_token: Jenkins API token
        parameters: Optional parameters for parameterized jobs

    Returns:
        True if trigger succeeded
    """
    # Build URL
    if parameters:
        url = f"{jenkins_url.rstrip('/')}/job/{job_name}/buildWithParameters"
    else:
        url = f"{jenkins_url.rstrip('/')}/job/{job_name}/build"

    # Prepare data
    data = {"token": trigger_token}
    if parameters:
        data.update(parameters)

    body = urllib.parse.urlencode(data).encode("utf-8")

    # Create request
    req = urllib.request.Request(url, data=body, method="POST")

    # Add auth
    import base64
    auth = base64.b64encode(f"{username}:{api_token}".encode()).decode()
    req.add_header("Authorization", f"Basic {auth}")

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            # Jenkins returns 201 Created on success
            if resp.status in (200, 201):
                print(f"Jenkins job triggered: {job_name}", file=sys.stderr)
                return True
            else:
                print(f"Jenkins returned status: {resp.status}", file=sys.stderr)
                return False
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        print(f"Jenkins HTTP error ({e.code}): {error_body}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Jenkins trigger failed: {e}", file=sys.stderr)
        return False


def get_event_parameters(hook_input: dict) -> dict[str, str]:
    """Extract Jenkins parameters from hook input."""
    event = hook_input.get("hook_event_name", "unknown")
    session_id = hook_input.get("session_id", "")[:16]  # Shorten for readability

    params = {
        "CLAUDE_EVENT": event,
        "CLAUDE_SESSION_ID": session_id,
    }

    # Add transcript path if available
    if "transcript_path" in hook_input:
        params["CLAUDE_TRANSCRIPT"] = hook_input["transcript_path"]

    return params


def get_configuration(provider: CredentialProvider) -> dict[str, str] | None:
    """Get all required configuration from the provider."""
    config = {
        "jenkins_url": provider.get("jenkins_url"),
        "jenkins_user": provider.get("jenkins_user"),
        "jenkins_api_token": provider.get("jenkins_api_token"),
        "jenkins_job": provider.get("jenkins_job"),
        "jenkins_trigger_token": provider.get("jenkins_trigger_token"),
    }

    # Check for missing values
    missing = [k for k, v in config.items() if not v]
    if missing:
        print(f"Missing configuration via {provider.name()} provider: {', '.join(missing)}", file=sys.stderr)
        print("", file=sys.stderr)
        print_setup_instructions(provider.name())
        return None

    return config


def print_setup_instructions(provider_name: str) -> None:
    """Print setup instructions for the given provider."""
    print("Setup instructions:", file=sys.stderr)

    if provider_name == "keychain":
        print("  security add-generic-password -U -a \"$USER\" -s jenkins_url -w \"https://jenkins.example.com\"", file=sys.stderr)
        print("  security add-generic-password -U -a \"$USER\" -s jenkins_user -w \"your-username\"", file=sys.stderr)
        print("  security add-generic-password -U -a \"$USER\" -s jenkins_api_token -w \"your-api-token\"", file=sys.stderr)
        print("  security add-generic-password -U -a \"$USER\" -s jenkins_job -w \"job-name\"", file=sys.stderr)
        print("  security add-generic-password -U -a \"$USER\" -s jenkins_trigger_token -w \"trigger-token\"", file=sys.stderr)
    elif provider_name == "env":
        print("  export JENKINS_URL=\"https://jenkins.example.com\"", file=sys.stderr)
        print("  export JENKINS_USER=\"your-username\"", file=sys.stderr)
        print("  export JENKINS_API_TOKEN=\"your-api-token\"", file=sys.stderr)
        print("  export JENKINS_JOB=\"job-name\"", file=sys.stderr)
        print("  export JENKINS_TRIGGER_TOKEN=\"trigger-token\"", file=sys.stderr)
    elif provider_name == "json":
        print("  Create ~/.claude/jenkins-config.json with:", file=sys.stderr)
        print("  {", file=sys.stderr)
        print('    "jenkins_url": "https://jenkins.example.com",', file=sys.stderr)
        print('    "jenkins_user": "your-username",', file=sys.stderr)
        print('    "jenkins_api_token": "your-api-token",', file=sys.stderr)
        print('    "jenkins_job": "job-name",', file=sys.stderr)
        print('    "jenkins_trigger_token": "trigger-token"', file=sys.stderr)
        print("  }", file=sys.stderr)


def main():
    # Check if Jenkins is enabled
    if not plugin_config.is_jenkins_enabled():
        return

    # Check if disabled
    disable_file = Path("~/.claude/disable-jenkins-trigger").expanduser()
    if disable_file.exists():
        print("Jenkins trigger disabled (disable file exists)", file=sys.stderr)
        return

    # Read hook input
    try:
        stdin_data = sys.stdin.read()
        hook_input = json.loads(stdin_data) if stdin_data.strip() else {}
    except json.JSONDecodeError:
        hook_input = {}

    event = hook_input.get("hook_event_name", "")

    # Configure which events trigger Jenkins
    # Customize this list based on your needs
    allowed_events = ["Stop", "PostToolUse", "SessionEnd"]

    if event not in allowed_events:
        return

    # Get credential provider
    try:
        provider = get_credential_provider()
        print(f"Using credential provider: {provider.name()}", file=sys.stderr)
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        return

    # Get configuration
    jenkins_config = get_configuration(provider)
    if not jenkins_config:
        return

    # Get parameters from event
    params = get_event_parameters(hook_input)

    # Trigger the job
    trigger_jenkins_job(
        jenkins_url=jenkins_config["jenkins_url"],
        job_name=jenkins_config["jenkins_job"],
        trigger_token=jenkins_config["jenkins_trigger_token"],
        username=jenkins_config["jenkins_user"],
        api_token=jenkins_config["jenkins_api_token"],
        parameters=params,
    )


if __name__ == "__main__":
    main()
