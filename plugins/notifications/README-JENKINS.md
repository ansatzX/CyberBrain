# Jenkins Plugin for Claude Code

Trigger Jenkins jobs from Claude Code events.

## Features

- **Event-driven Triggers**: Trigger Jenkins jobs on Claude Code events
- **Parameterized Jobs**: Pass event context as build parameters
- **Pluggable Credential Providers**: Extensible credential system (Keychain, Env, JSON, and more)
- **Configurable Events**: Choose which events trigger jobs

## Credential Providers

The plugin supports multiple credential providers, selectable via `JENKINS_CREDENTIAL_PROVIDER` environment variable.

### Available Providers

| Provider | Name | Description |
|----------|------|-------------|
| **Keychain** | `keychain` | macOS Keychain (default, secure) |
| **Environment** | `env` | Environment variables |
| **JSON File** | `json` | JSON config file (~/.claude/jenkins-config.json) |

### Selecting a Provider

```bash
# Use environment variables
export JENKINS_CREDENTIAL_PROVIDER=env

# Use JSON file
export JENKINS_CREDENTIAL_PROVIDER=json

# Use Keychain (default)
export JENKINS_CREDENTIAL_PROVIDER=keychain
```

If not specified, the first available provider is used (keychain → env → json).

---

## Supported Events

| Event | Description |
|-------|-------------|
| `Stop` | Claude finished responding |
| `PostToolUse` | A tool finished executing |
| `SessionEnd` | Session ended |

---

## Setup

### 1. Jenkins Configuration

First, configure your Jenkins job:

1. Go to your Jenkins job → Configure
2. Under "Build Triggers", check "Trigger builds remotely"
3. Set an **Authentication Token** (e.g., `my-secret-token-123`)
4. Save the job configuration

### 2. Get Jenkins API Token

1. Log in to Jenkins
2. Click your username → Configure
3. Under "API Token", click "Add new Token"
4. Give it a name (e.g., "Claude Code") and click "Generate"
5. **Copy the token** - you won't be able to see it again!

### 3. Configure Credentials

Choose one of the following methods:

#### Option A: macOS Keychain (Default, Recommended)

```bash
# Jenkins URL (include https://)
security add-generic-password -U -a "$USER" -s jenkins_url -w "https://jenkins.example.com"

# Jenkins username
security add-generic-password -U -a "$USER" -s jenkins_user -w "your-username"

# Jenkins API token (from step 2)
security add-generic-password -U -a "$USER" -s jenkins_api_token -w "your-api-token"

# Jenkins job name
security add-generic-password -U -a "$USER" -s jenkins_job -w "my-deploy-job"

# Jenkins trigger token (from step 1)
security add-generic-password -U -a "$USER" -s jenkins_trigger_token -w "my-secret-token-123"
```

#### Option B: Environment Variables

```bash
export JENKINS_URL="https://jenkins.example.com"
export JENKINS_USER="your-username"
export JENKINS_API_TOKEN="your-api-token"
export JENKINS_JOB="my-deploy-job"
export JENKINS_TRIGGER_TOKEN="my-secret-token-123"
```

Add these to your `~/.zshrc` or `~/.bashrc` to persist.

#### Option C: JSON File

Create `~/.claude/jenkins-config.json`:

```json
{
  "jenkins_url": "https://jenkins.example.com",
  "jenkins_user": "your-username",
  "jenkins_api_token": "your-api-token",
  "jenkins_job": "my-deploy-job",
  "jenkins_trigger_token": "my-secret-token-123"
}
```

### 4. Enable the Hook

Edit `hooks/hooks.json` and set `"disabled": false` for the events you want:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/trigger_jenkins.py",
            "timeout": 15,
            "disabled": false
          }
        ]
      }
    ]
  }
}
```

---

## Usage

### Default Behavior

When enabled, the plugin will:
1. Listen for configured Claude Code events
2. Extract event context (event type, session ID, transcript path)
3. Trigger the configured Jenkins job
4. Pass parameters: `CLAUDE_EVENT`, `CLAUDE_SESSION_ID`, `CLAUDE_TRANSCRIPT`

### Temporary Disable

Create a disable file to temporarily stop triggers:

```bash
touch ~/.claude/disable-jenkins-trigger
```

Remove it to re-enable:

```bash
rm ~/.claude/disable-jenkins-trigger
```

---

## Extending: Adding a New Credential Provider

The plugin uses an extensible provider pattern. To add a new provider:

### Step 1: Implement the Provider

```python
class MyVaultCredentialProvider(CredentialProvider):
    """Read credentials from MyVault."""

    def name(self) -> str:
        return "myvault"

    def is_available(self) -> bool:
        # Check if MyVault is installed/available
        return shutil.which("myvault") is not None

    def get(self, key: str) -> str | None:
        # Read from MyVault
        try:
            result = subprocess.run(
                ["myvault", "get", key],
                capture_output=True,
                text=True,
            )
            return result.stdout.strip() if result.returncode == 0 else None
        except Exception:
            return None
```

### Step 2: Register the Provider

```python
# In the registry section
_registry = CredentialProviderRegistry()
_registry.register(KeychainCredentialProvider())
_registry.register(EnvCredentialProvider())
_registry.register(JsonFileCredentialProvider())
_registry.register(MyVaultCredentialProvider())  # Add this
```

### Step 3: Use It

```bash
export JENKINS_CREDENTIAL_PROVIDER=myvault
```

---

## Jenkins Job Configuration Example

### Parameterized Job

If your Jenkins job is parameterized, add these parameters:

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `CLAUDE_EVENT` | String | | Event that triggered the build |
| `CLAUDE_SESSION_ID` | String | | Claude session ID |
| `CLAUDE_TRANSCRIPT` | String | | Path to conversation transcript |

### Example Pipeline

```groovy
pipeline {
    agent any
    parameters {
        string(name: 'CLAUDE_EVENT', defaultValue: '', description: 'Event type')
        string(name: 'CLAUDE_SESSION_ID', defaultValue: '', description: 'Session ID')
        string(name: 'CLAUDE_TRANSCRIPT', defaultValue: '', description: 'Transcript path')
    }
    stages {
        stage('Process') {
            steps {
                echo "Triggered by Claude event: ${params.CLAUDE_EVENT}"
                echo "Session ID: ${params.CLAUDE_SESSION_ID}"
                // Add your steps here
            }
        }
    }
}
```

---

## Customization

### Modify Which Events Trigger

Edit `scripts/hooks/trigger_jenkins.py` and change the `allowed_events` list:

```python
allowed_events = ["Stop", "PostToolUse"]  # Customize this
```

### Add Custom Parameters

Modify the `get_event_parameters()` function to pass additional data:

```python
def get_event_parameters(hook_input: dict) -> dict[str, str]:
    params = {
        "CLAUDE_EVENT": hook_input.get("hook_event_name", "unknown"),
        "CLAUDE_SESSION_ID": hook_input.get("session_id", "")[:16],
        "MY_CUSTOM_PARAM": "custom value",  # Add this
    }
    return params
```

---

## Troubleshooting

### "Missing Jenkins configuration"

Double-check all 5 credentials are stored for your provider:

**Keychain**:
```bash
security find-generic-password -s jenkins_url -w
security find-generic-password -s jenkins_user -w
# ... etc
```

**Environment**:
```bash
echo $JENKINS_URL
echo $JENKINS_USER
# ... etc
```

**JSON**:
```bash
cat ~/.claude/jenkins-config.json
```

### "Jenkins HTTP error 403"

- Verify your API token is correct
- Check that your user has build permission for the job
- Verify the trigger token matches what's in the job config

### "Jenkins HTTP error 404"

- Check the Jenkins URL is correct
- Verify the job name is correct (case-sensitive!)
- Make sure the job exists and is not disabled

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Credential Provider Interface                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  CredentialProvider (ABC)                              │  │
│  │  - get(key) -> str | None                              │  │
│  │  - is_available() -> bool                              │  │
│  │  - name() -> str                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ▲                                    │
│         ┌────────────────┼────────────────┐                  │
│         │                │                │                  │
│  ┌──────────────┐ ┌──────────┐ ┌──────────────┐            │
│  │   Keychain   │ │   Env    │ │  JSON File   │  ... more  │
│  │   Provider   │ │ Provider │ │   Provider   │            │
│  └──────────────┘ └──────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Provider Registry & Factory                                 │
│  - get_credential_provider()                                │
│  - Selects provider from env var or falls back              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Jenkins Trigger Logic                                      │
│  - Reads config from provider                               │
│  - Calls Jenkins API                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Files

```
jenkins/
├── .claude-plugin/plugin.json    # Plugin metadata
├── README.md                      # This file
├── hooks/hooks.json              # Hook configuration
└── scripts/hooks/
    └── trigger_jenkins.py        # Main trigger script (with providers)
```
