# Pushover Notification Service for macOS

Send real push notifications to your iPhone/iPad/Android from the command line. Uses macOS Keychain for secure credential storage.

## Why Pushover?

- **Real push notifications** - native iOS/Android alerts, not SMS
- **No UI automation** - pure API, no AppleScript hacks
- **Secure** - credentials stored in Keychain, never in plaintext
- **Reliable** - works even when your Mac is locked

## Setup (5 minutes)

### 1. Create Pushover Account

1. Go to [pushover.net](https://pushover.net) and create an account
2. Install the Pushover app on your iPhone/Android
3. Note your **User Key** (shown on the dashboard after login)

### 2. Create an Application Token

1. Go to [pushover.net/apps/build](https://pushover.net/apps/build)
2. Create a new application (name it anything, e.g., "MacOS Agent")
3. Note your **API Token/Key**

### 3. Store Credentials in Keychain

```bash
# Store your API token (from step 2)
security add-generic-password -U -a "$USER" -s pushover_app_token -w "YOUR_API_TOKEN"

# Store your User Key (from step 1)
security add-generic-password -U -a "$USER" -s pushover_iphone_key -w "YOUR_USER_KEY"
```

**Verify they're stored:**

```bash
security find-generic-password -s pushover_app_token -w
security find-generic-password -s pushover_iphone_key -w
```

### 4. Install the Script

```bash
# Create bin directory if needed
mkdir -p ~/bin

# Copy script
cp po_notify.py ~/bin/po_notify
chmod +x ~/bin/po_notify

# Add to PATH (if not already)
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### 5. Test

```bash
po_notify "Test" "Hello from macOS"
```

You should receive a push notification on your phone!

## Usage

```bash
# Basic notification
po_notify "Title" "Your message here"

# With priority (high - bypasses quiet hours)
po_notify "Alert" "Server down!" --priority 1

# Emergency (repeats until acknowledged)
po_notify "Critical" "Database offline!" --priority 2 --retry 60 --expire 1800

# Include a URL
po_notify "Link" "Check this out" --url "https://example.com"
```

### Priority Levels

| Priority | Description |
|----------|-------------|
| -2 | Lowest - no notification, just logs |
| -1 | Low - quiet notification |
| 0 | Normal (default) |
| 1 | High - bypasses quiet hours |
| 2 | Emergency - repeats until acknowledged |

## Syncing Credentials to Another Mac

The credentials are stored in your **login keychain** (not iCloud Keychain), so they won't auto-sync. Here are your options:

### Option A: Manual Copy (Recommended)

On your new Mac, run the same commands:

```bash
security add-generic-password -U -a "$USER" -s pushover_app_token -w "YOUR_API_TOKEN"
security add-generic-password -U -a "$USER" -s pushover_iphone_key -w "YOUR_USER_KEY"
```

### Option B: Export/Import Keychain Item

```bash
# On source Mac - show the values
security find-generic-password -s pushover_app_token -w
security find-generic-password -s pushover_iphone_key -w

# Copy these values to your new Mac and run add-generic-password there
```

### Option C: Use a Password Manager

Store your Pushover credentials in 1Password/Bitwarden, then retrieve and add to Keychain on each Mac.

### Why Not iCloud Keychain?

iCloud Keychain only syncs Safari passwords and system credentials. Generic passwords added via `security` CLI go to the login keychain. This is actually **more secure** for API tokens since they stay local to each machine.

## Troubleshooting

### "Could not find 'pushover_app_token' in Keychain"

You haven't stored the credentials yet. Run:

```bash
security add-generic-password -U -a "$USER" -s pushover_app_token -w "YOUR_TOKEN"
```

### HTTP Error 400: Bad Request

Usually means invalid token or user key. Verify:

```bash
# Check stored values
security find-generic-password -s pushover_app_token -w
security find-generic-password -s pushover_iphone_key -w
```

Make sure they match exactly what Pushover shows in your dashboard.

### "User key is invalid"

You might have stored the wrong value. The **User Key** is:
- Found on your Pushover dashboard (after login)
- Looks like: `uQiRzpo4DXghDmr9QzzfQu27cmVRsG`
- **Not** your email or password

### Permission Denied

```bash
chmod +x ~/bin/po_notify
```

## Use Cases

- **CI/CD notifications** - alert when builds complete or fail
- **Server monitoring** - get notified of downtime
- **AI agent alerts** - let your agent notify you of completed tasks
- **Cron job completion** - know when long-running jobs finish
- **Security alerts** - immediate notification of suspicious activity

## Bash Wrapper (Alternative)

If you prefer a bash wrapper around the Python script:

```bash
cat > ~/bin/po_notify_bash <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
python3 ~/bin/po_notify "$@"
EOF
chmod +x ~/bin/po_notify_bash
```

## License

MIT - use freely.
