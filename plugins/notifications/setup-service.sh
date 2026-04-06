#!/usr/bin/env bash
#
# Notifications Plugin Setup Script
#
# Setup and configure Pushover and Jenkins integrations.
#
# Usage:
#   ./setup-service.sh              # Interactive setup
#   ./setup-service.sh status       # Show current config
#   ./setup-service.sh enable pushover
#   ./setup-service.sh disable jenkins
#

set -euo pipefail

# Configuration directory
CONFIG_DIR="$HOME/.claude/notifications"

# Plugin directory (relative to this script)
PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure config directory exists
mkdir -p "$CONFIG_DIR"

# =============================================================================
# Helper functions
# =============================================================================

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Notifications Plugin Setup${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

is_feature_enabled() {
    local feature="$1"
    [[ -f "$CONFIG_DIR/${feature}-enabled" ]]
}

enable_feature() {
    local feature="$1"
    touch "$CONFIG_DIR/${feature}-enabled"
    print_success "Enabled $feature"
}

disable_feature() {
    local feature="$1"
    rm -f "$CONFIG_DIR/${feature}-enabled"
    print_success "Disabled $feature"
}

prompt_yn() {
    local prompt="$1"
    local default="$2"
    local yn

    while true; do
        read -p "$prompt " yn
        case "${yn:-$default}" in
            [Yy]*) return 0 ;;
            [Nn]*) return 1 ;;
            *) echo "Please answer y or n." ;;
        esac
    done
}

prompt_input() {
    local prompt="$1"
    local default="$2"
    local input

    read -p "$prompt " input
    echo "${input:-$default}"
}

set_keychain_password() {
    local service="$1"
    local value="$2"
    local account="${3:-$USER}"

    if security add-generic-password -U -a "$account" -s "$service" -w "$value" 2>/dev/null; then
        print_success "Stored $service in Keychain"
    else
        print_error "Failed to store $service in Keychain"
        return 1
    fi
}

get_keychain_password() {
    local service="$1"
    local account="${2:-$USER}"

    security find-generic-password -s "$service" -w 2>/dev/null || true
}

# =============================================================================
# Feature: Status
# =============================================================================

show_status() {
    print_header
    echo "Current Configuration"
    echo

    # Features
    echo "Features:"
    for feature in pushover pushover-completion jenkins; do
        if is_feature_enabled "$feature"; then
            print_success "  $feature"
        else
            echo -e "  ${RED}✗${NC} $feature"
        fi
    done
    echo

    # Pushover credentials
    echo "Pushover Credentials:"
    if [[ -n "$(get_keychain_password pushover_app_token)" ]]; then
        print_success "  pushover_app_token"
    else
        echo -e "  ${RED}✗${NC} pushover_app_token"
    fi
    if [[ -n "$(get_keychain_password pushover_iphone_key)" ]]; then
        print_success "  pushover_iphone_key"
    else
        echo -e "  ${RED}✗${NC} pushover_iphone_key"
    fi
    echo

    # Jenkins credentials
    echo "Jenkins Credentials:"
    for key in jenkins_url jenkins_user jenkins_api_token jenkins_job jenkins_trigger_token; do
        if [[ -n "$(get_keychain_password "$key")" ]]; then
            print_success "  $key"
        else
            echo -e "  ${RED}✗${NC} $key"
        fi
    done
    echo

    # Quick commands
    echo "Quick Commands:"
    echo "  $0 status                # Show this status"
    echo "  $0 enable pushover       # Enable Pushover"
    echo "  $0 enable jenkins        # Enable Jenkins"
    echo "  $0 disable pushover      # Disable Pushover"
    echo "  $0 setup-pushover        # Setup Pushover credentials"
    echo "  $0 setup-jenkins         # Setup Jenkins credentials"
    echo
}

# =============================================================================
# Feature: Enable/Disable
# =============================================================================

enable_disable_feature() {
    local action="$1"
    local feature="$2"

    case "$feature" in
        pushover|pushover-completion|jenkins)
            if [[ "$action" == "enable" ]]; then
                enable_feature "$feature"
            else
                disable_feature "$feature"
            fi
            ;;
        *)
            print_error "Unknown feature: $feature"
            echo "Available features: pushover, pushover-completion, jenkins"
            exit 1
            ;;
    esac
}

# =============================================================================
# Feature: Setup Pushover
# =============================================================================

setup_pushover() {
    print_header
    echo "Pushover Setup"
    echo
    print_info "Get your credentials from https://pushover.net/"
    echo

    # App Token
    local current_token="$(get_keychain_password pushover_app_token)"
    local token
    if [[ -n "$current_token" ]]; then
        token="$(prompt_input "Pushover App Token [press Enter to keep current]:" "$current_token")"
    else
        token="$(prompt_input "Pushover App Token:")"
    fi
    if [[ -z "$token" ]]; then
        print_error "App Token cannot be empty"
        exit 1
    fi
    set_keychain_password pushover_app_token "$token"

    # User Key
    local current_key="$(get_keychain_password pushover_iphone_key)"
    local user_key
    if [[ -n "$current_key" ]]; then
        user_key="$(prompt_input "Pushover User Key [press Enter to keep current]:" "$current_key")"
    else
        user_key="$(prompt_input "Pushover User Key:")"
    fi
    if [[ -z "$user_key" ]]; then
        print_error "User Key cannot be empty"
        exit 1
    fi
    set_keychain_password pushover_iphone_key "$user_key"

    echo
    if prompt_yn "Enable Pushover now? (y/n):" "y"; then
        enable_feature pushover
    fi
    if prompt_yn "Enable task completion notifications? (y/n):" "n"; then
        enable_feature pushover-completion
    fi

    echo
    print_success "Pushover setup complete!"
}

# =============================================================================
# Feature: Setup Jenkins
# =============================================================================

setup_jenkins() {
    print_header
    echo "Jenkins Setup"
    echo

    # URL
    local current_url="$(get_keychain_password jenkins_url)"
    local url
    if [[ -n "$current_url" ]]; then
        url="$(prompt_input "Jenkins URL [press Enter to keep current]:" "$current_url")"
    else
        url="$(prompt_input "Jenkins URL (e.g., https://jenkins.example.com):")"
    fi
    if [[ -z "$url" ]]; then
        print_error "URL cannot be empty"
        exit 1
    fi
    set_keychain_password jenkins_url "$url"

    # Username
    local current_user="$(get_keychain_password jenkins_user)"
    local user
    if [[ -n "$current_user" ]]; then
        user="$(prompt_input "Jenkins Username [press Enter to keep current]:" "$current_user")"
    else
        user="$(prompt_input "Jenkins Username:")"
    fi
    if [[ -z "$user" ]]; then
        print_error "Username cannot be empty"
        exit 1
    fi
    set_keychain_password jenkins_user "$user"

    # API Token
    local current_api="$(get_keychain_password jenkins_api_token)"
    local api_token
    echo
    print_info "Get your API token from Jenkins → Your Profile → Configure → API Token"
    echo
    if [[ -n "$current_api" ]]; then
        api_token="$(prompt_input "Jenkins API Token [press Enter to keep current]:" "$current_api")"
    else
        api_token="$(prompt_input "Jenkins API Token:")"
    fi
    if [[ -z "$api_token" ]]; then
        print_error "API Token cannot be empty"
        exit 1
    fi
    set_keychain_password jenkins_api_token "$api_token"

    # Job Name
    local current_job="$(get_keychain_password jenkins_job)"
    local job
    echo
    if [[ -n "$current_job" ]]; then
        job="$(prompt_input "Jenkins Job Name [press Enter to keep current]:" "$current_job")"
    else
        job="$(prompt_input "Jenkins Job Name:")"
    fi
    if [[ -z "$job" ]]; then
        print_error "Job Name cannot be empty"
        exit 1
    fi
    set_keychain_password jenkins_job "$job"

    # Trigger Token
    local current_trigger="$(get_keychain_password jenkins_trigger_token)"
    local trigger_token
    echo
    print_info "Get your trigger token from Jenkins Job → Configure → Build Triggers → Trigger builds remotely"
    echo
    if [[ -n "$current_trigger" ]]; then
        trigger_token="$(prompt_input "Jenkins Trigger Token [press Enter to keep current]:" "$current_trigger")"
    else
        trigger_token="$(prompt_input "Jenkins Trigger Token:")"
    fi
    if [[ -z "$trigger_token" ]]; then
        print_error "Trigger Token cannot be empty"
        exit 1
    fi
    set_keychain_password jenkins_trigger_token "$trigger_token"

    echo
    if prompt_yn "Enable Jenkins now? (y/n):" "y"; then
        enable_feature jenkins
    fi

    echo
    print_success "Jenkins setup complete!"
}

# =============================================================================
# Feature: Setup Config File
# =============================================================================

setup_config() {
    print_header
    echo "Config File Setup"
    echo

    local config_dir="$HOME/.claude/notifications"
    local config_file="$config_dir/config.toml"
    local example_file="$PLUGIN_DIR/config.example.toml"

    mkdir -p "$config_dir"

    if [[ -f "$config_file" ]]; then
        print_warning "Config file already exists: $config_file"
        if prompt_yn "Overwrite with example? (y/n):" "n"; then
            cp "$example_file" "$config_file"
            print_success "Config file created: $config_file"
            echo "Edit it to configure your notification routing."
        fi
    else
        if prompt_yn "Create config file from example? (y/n):" "y"; then
            cp "$example_file" "$config_file"
            print_success "Config file created: $config_file"
            echo "Edit it to configure your notification routing."
        fi
    fi
}

# =============================================================================
# Feature: Interactive Setup
# =============================================================================

interactive_setup() {
    print_header

    echo "Welcome to the Notifications Plugin setup!"
    echo

    if prompt_yn "Would you like to set up Pushover? (y/n):" "y"; then
        setup_pushover
        echo
    fi

    if prompt_yn "Would you like to set up Jenkins? (y/n):" "n"; then
        setup_jenkins
        echo
    fi

    if prompt_yn "Would you like to set up the config file? (y/n):" "n"; then
        setup_config
        echo
    fi

    print_success "Setup complete! Run '$0 status' to check your configuration."
}

# =============================================================================
# Main
# =============================================================================

case "${1:-}" in
    status)
        show_status
        ;;
    enable)
        enable_disable_feature enable "${2:-}"
        ;;
    disable)
        enable_disable_feature disable "${2:-}"
        ;;
    setup-pushover)
        setup_pushover
        ;;
    setup-jenkins)
        setup_jenkins
        ;;
    setup-config)
        setup_config
        ;;
    "")
        interactive_setup
        ;;
    *)
        echo "Usage: $0 [command]"
        echo
        echo "Commands:"
        echo "  (no command)    Interactive setup"
        echo "  status          Show current configuration"
        echo "  enable <feat>   Enable a feature (pushover, pushover-completion, jenkins)"
        echo "  disable <feat>  Disable a feature"
        echo "  setup-pushover  Setup Pushover credentials"
        echo "  setup-jenkins   Setup Jenkins credentials"
        echo "  setup-config    Setup config file"
        echo
        exit 1
        ;;
esac
