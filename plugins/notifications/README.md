# Notifications Plugin (Pushover + Slack + Lark + Jenkins)

Unified notifications and integrations plugin for Claude Code:
- **Multiple Backends**: Pushover, Slack Webhook, Lark Webhook, Jenkins Trigger
- **Configurable Routing**: Define which events go to which backends via TOML config
- **Extensible Architecture**: Easy to add new backends
- **Improved Defaults**: More sensible defaults, better control
- **Pushover**: Push notifications for permission waits and task completion
- **Jenkins**: Trigger Jenkins jobs from Claude Code events

This plugin combines the original `pushover` and `jenkins` plugins, and adds support for multiple notification backends.

---

## Quick Start

1. **Copy example config**
   ```bash
   cp plugins/notifications/config.example.toml ~/.claude/notifications/config.toml
   ```

2. **Edit config**
   ```bash
   nano ~/.claude/notifications/config.toml
   ```

3. **Run setup**
   ```bash
   cd plugins/notifications
   ./setup-service.sh
   ```

---

## Configuration

**Config File:** `~/.claude/notifications/config.toml`

See [config.example.toml](./config.example.toml) for full example.

### Quick Config Example

```toml
[routes]
permission_prompt = ["pushover", "slack"]
task_complete = ["pushover"]

[backend.pushover]
enabled = true

[backend.slack]
enabled = true
webhook_url = "https://hooks.slack.com/services/XXX/YYY/ZZZ"
```

---

## Backends

| Backend | Description |
|---------|-------------|
| pushover | Push notifications via Pushover |
| slack | Slack webhook notifications |
| lark | Lark (Feishu) webhook notifications |
| jenkins | Jenkins build triggers |

---

## Architecture

```
Claude Hook → Router → Backends
                ↓
         Config (TOML)
```

See the [design document](../docs/superpowers/specs/2026-04-07-notifications-framework-design.md) for full architecture details.

---

## Quick Start: Setup Script (Legacy)

**The easiest way to configure everything!**

```bash
cd plugins/notifications

# Interactive setup (guides you through everything)
./setup-service.sh

# Or use specific commands
./setup-service.sh status          # Check current config
./setup-service.sh setup-pushover  # Setup Pushover only
./setup-service.sh setup-jenkins   # Setup Jenkins only
./setup-service.sh enable pushover  # Enable Pushover
./setup-service.sh enable jenkins   # Enable Jenkins
./setup-service.sh disable pushover # Disable Pushover
```

---

## Quick Start: Enable Features (Alternative)

If you don't want to use the setup script, you can still manually create marker files:

```bash
# Enable Pushover (permission reminders)
touch ~/.claude/notifications/pushover-enabled

# Enable Pushover task completion notifications
touch ~/.claude/notifications/pushover-completion

# Enable Jenkins triggers
touch ~/.claude/notifications/jenkins-enabled
```

Disable by deleting the file:
```bash
rm ~/.claude/notifications/pushover-enabled
```

Check status:
```bash
python3 plugins/notifications/scripts/config.py
```

---

## Features

### Pushover Features
- **Permission Escalation**: Get notified when Claude waits for permission approval
- **Task Completion**: Low-priority notification when Claude finishes a task
- **Session Management**: Automatic service lifecycle tied to Claude sessions
- **On-Demand Notifications**: Send push notifications via the `notification` skill

### Jenkins Features
- **Event-driven Triggers**: Trigger Jenkins jobs on Claude Code events
- **Parameterized Jobs**: Pass event context as build parameters
- **Pluggable Credential Providers**: Extensible credential system (Keychain, Env, JSON, and more)
- **Configurable Events**: Choose which events trigger jobs

---

## Quick Reference

| What | Where |
|------|-------|
| Pushover full docs | [README-PUSHOVER.md](./README-PUSHOVER.md) |
| Jenkins full docs | [README-JENKINS.md](./README-JENKINS.md) |
| Hooks config | [hooks/hooks.json](./hooks/hooks.json) |
| Escalation control | `scripts/service/escalation_ctl.py` |

---

## Files

```
notifications/
├── .claude-plugin/plugin.json        # Plugin metadata
├── README.md                         # This file
├── README-PUSHOVER.md                # Original Pushover docs
├── README-JENKINS.md                 # Original Jenkins docs
├── hooks/hooks.json                  # Hook configuration
├── scripts/
│   ├── hooks/
│   │   ├── on_session_start.py       # Start escalation service
│   │   ├── on_session_end.py         # Stop escalation service
│   │   ├── on_permission.py          # Add escalation on permission
│   │   ├── on_stop.py                 # Task completion notification
│   │   ├── cancel_escalation.py      # Cancel pending escalation
│   │   └── trigger_jenkins.py        # Trigger Jenkins job
│   └── service/
│       ├── escalation_service.py      # Background escalation manager
│       ├── escalation_client.py       # Client library
│       ├── escalation_ctl.py          # CLI control tool
│       └── __init__.py
├── skills/
│   └── notification/
│       ├── SKILL.md                   # Skill docs
│       └── scripts/notify.sh          # Skill script
└── tools/
    └── pushover-notify/
        ├── README.md                  # Tool docs
        └── po_notify.py               # Pushover API wrapper
```

---

## Getting Started

### Pushover Setup

See [README-PUSHOVER.md](./README-PUSHOVER.md) for full setup.

Quick setup:
```bash
# Store credentials in Keychain
security add-generic-password -U -a "$USER" -s pushover_app_token -w "YOUR_APP_TOKEN"
security add-generic-password -U -a "$USER" -s pushover_iphone_key -w "YOUR_USER_KEY"
```

### Jenkins Setup

See [README-JENKINS.md](./README-JENKINS.md) for full setup.

Quick setup (choose one provider):

**Keychain**:
```bash
security add-generic-password -U -a "$USER" -s jenkins_url -w "https://jenkins.example.com"
security add-generic-password -U -a "$USER" -s jenkins_user -w "your-username"
security add-generic-password -U -a "$USER" -s jenkins_api_token -w "your-api-token"
security add-generic-password -U -a "$USER" -s jenkins_job -w "job-name"
security add-generic-password -U -a "$USER" -s jenkins_trigger_token -w "trigger-token"
```

**Environment variables**:
```bash
export JENKINS_CREDENTIAL_PROVIDER=env
export JENKINS_URL="https://jenkins.example.com"
export JENKINS_USER="your-username"
# ... etc
```

### Enable Features

**No need to edit hooks.json!** Just create marker files to enable features:

```bash
# Enable Pushover (permission reminders)
touch ~/.claude/notifications/pushover-enabled

# Enable Pushover task completion notifications
touch ~/.claude/notifications/pushover-completion

# Enable Jenkins triggers
touch ~/.claude/notifications/jenkins-enabled
```

Disable by deleting the file:
```bash
rm ~/.claude/notifications/pushover-enabled
```

Check current status:
```bash
python3 plugins/notifications/scripts/config.py
```

---

## Manual Control

### Setup Script (Recommended)

Use the setup script for all configuration:

```bash
cd plugins/notifications

# Interactive setup
./setup-service.sh

# Check status
./setup-service.sh status

# Enable/disable features
./setup-service.sh enable pushover
./setup-service.sh enable jenkins
./setup-service.sh disable pushover

# Setup credentials
./setup-service.sh setup-pushover
./setup-service.sh setup-jenkins
```

### Marker Files (Alternative)

If you prefer not to use the setup script:

```bash
# Enable features
touch ~/.claude/notifications/pushover-enabled
touch ~/.claude/notifications/pushover-completion
touch ~/.claude/notifications/jenkins-enabled

# Disable features
rm ~/.claude/notifications/pushover-enabled
rm ~/.claude/notifications/pushover-completion
rm ~/.claude/notifications/jenkins-enabled

# Check status
python3 plugins/notifications/scripts/config.py
```

### Escalation Service

```bash
cd plugins/notifications

# Check status
python3 scripts/service/escalation_ctl.py status

# Cancel escalation
python3 scripts/service/escalation_ctl.py cancel <session-id>

# Stop service
python3 scripts/service/escalation_ctl.py stop
```

### Temporary Disable

```bash
# Disable Pushover escalation (stop service)
python3 scripts/service/escalation_ctl.py stop

# Disable Jenkins triggers
touch ~/.claude/disable-jenkins-trigger

# Re-enable Jenkins triggers
rm ~/.claude/disable-jenkins-trigger
```

---

## Migration from Old Plugins

If you were using the old `pushover` or `jenkins` plugins:

1. **Keep your credentials** - they're still in Keychain
2. **Update your hooks** - edit `plugins/notifications/hooks/hooks.json` instead
3. **Update paths** - use `${CLAUDE_PLUGIN_ROOT}` pointing to `notifications` plugin

The functionality is identical, just merged into one plugin.

---

## Migrating to the New Framework

If you were using the old version of this plugin:

- **Existing Keychain credentials are reused** - no need to re-enter them
- **Escalation service is preserved** - still used for permission waits
- **New router handles all other notifications** - more flexible and configurable
- **Config file is optional** - defaults work if you don't need multiple backends

To use the new features:
1. Copy `config.example.toml` to `~/.claude/notifications/config.toml`
2. Edit the config to enable/disable backends and set up routing
3. The old marker files (pushover-enabled, etc.) still work for basic functionality
