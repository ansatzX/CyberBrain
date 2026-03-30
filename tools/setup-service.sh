#!/bin/bash
# One-time setup for Pushover notification service
# Run this after installing the plugin

set -e

echo "Setting up Pushover notification credentials..."

# Check if credentials already exist
token_exists=$(security find-generic-password -s pushover_app_token -w >/dev/null 2>&1 && echo "yes" || echo "no")
key_exists=$(security find-generic-password -s pushover_iphone_key -w >/dev/null 2>&1 && echo "yes" || echo "no")

if [ "$token_exists" = "yes" ] && [ "$key_exists" = "yes" ]; then
    echo "Pushover credentials already configured in Keychain. Skipping."
else
    echo "(Get these from https://pushover.net/)"
    echo ""

    read -p "Pushover API Token: " api_token
    read -p "Pushover User Key: " user_key

    if [ -n "$api_token" ] && [ -n "$user_key" ]; then
        security add-generic-password -U -a "$USER" -s pushover_app_token -w "$api_token"
        security add-generic-password -U -a "$USER" -s pushover_iphone_key -w "$user_key"
        echo "Credentials saved to Keychain."
    else
        echo "Skipped credential setup. Configure manually later:"
        echo "  security add-generic-password -U -a \"\$USER\" -s pushover_app_token -w \"YOUR_API_TOKEN\""
        echo "  security add-generic-password -U -a \"\$USER\" -s pushover_iphone_key -w \"YOUR_USER_KEY\""
    fi
fi

echo ""
echo "Done! The plugin will handle the escalation service automatically."
