#!/usr/bin/env bash
set -euo pipefail

PLUGIN_NAME="awesome-agent-select"
MANIFEST_BASENAME=".awesome-agent-select.manifest"

usage() {
    cat <<'EOF'
Usage:
  bash plugins/awesome-agent-select/tools/manage-codex-agents.sh install [--codex-home PATH] [--source-dir PATH]
  bash plugins/awesome-agent-select/tools/manage-codex-agents.sh sync [--bootstrap] [--codex-home PATH] [--source-dir PATH]
  bash plugins/awesome-agent-select/tools/manage-codex-agents.sh uninstall [--codex-home PATH]
  bash plugins/awesome-agent-select/tools/manage-codex-agents.sh doctor [--codex-home PATH] [--source-dir PATH]

Commands:
  install    Explicitly install Codex agent TOML files into ~/.codex/agents
  sync       Refresh files already owned by this installer; used by SessionStart hooks
  uninstall  Remove files owned by this installer and legacy awesome-agent-select symlinks
  doctor     Check managed files, conflicts, and legacy symlinks
EOF
}

log() {
    [ "${QUIET_MODE:-0}" -eq 0 ] || return 0
    printf '%s\n' "$*"
}

warn() {
    printf 'Warning: %s\n' "$*" >&2
}

fail() {
    printf 'Error: %s\n' "$*" >&2
    exit 1
}

script_dir() {
    CDPATH= cd -- "$(dirname -- "$0")" && pwd
}

default_source_dir() {
    if [ -n "${PLUGIN_ROOT:-}" ] && [ -d "${PLUGIN_ROOT}/agents" ]; then
        printf '%s\n' "${PLUGIN_ROOT}"
        return
    fi

    local dir
    dir="$(script_dir)"
    CDPATH= cd -- "${dir}/.." && pwd
}

manifest_contains_name() {
    local needle="$1"
    local i
    for ((i = 0; i < ${#MANIFEST_FILES[@]}; i++)); do
        if [ "${MANIFEST_FILES[$i]}" = "$needle" ]; then
            return 0
        fi
    done
    return 1
}

source_contains_name() {
    local needle="$1"
    local i
    for ((i = 0; i < ${#SOURCE_BASENAMES[@]}; i++)); do
        if [ "${SOURCE_BASENAMES[$i]}" = "$needle" ]; then
            return 0
        fi
    done
    return 1
}

legacy_symlink_matches() {
    local target_path="$1"
    local basename="$2"

    [ -L "$target_path" ] || return 1

    local link_target
    link_target="$(readlink "$target_path" || true)"
    case "$link_target" in
        *"/awesome-agent-select/agents/${basename}")
            return 0
            ;;
        "${SOURCE_DIR}/${basename}")
            return 0
            ;;
    esac

    return 1
}

load_manifest() {
    MANIFEST_FILES=()

    [ -f "$MANIFEST_PATH" ] || return 0

    while IFS= read -r line; do
        case "$line" in
            file=*)
                MANIFEST_FILES+=("${line#file=}")
                ;;
        esac
    done < "$MANIFEST_PATH"
}

write_manifest() {
    local tmp_path
    tmp_path="${MANIFEST_PATH}.tmp"

    {
        printf 'plugin=%s\n' "$PLUGIN_NAME"
        printf 'source_dir=%s\n' "$SOURCE_DIR"
        printf 'updated_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        local i
        for ((i = 0; i < ${#OWNED_FILES[@]}; i++)); do
            printf 'file=%s\n' "${OWNED_FILES[$i]}"
        done
    } > "$tmp_path"

    mv "$tmp_path" "$MANIFEST_PATH"
}

collect_source_files() {
    SOURCE_FILES=()
    SOURCE_BASENAMES=()

    local file_path
    for file_path in "$SOURCE_DIR"/*.toml; do
        [ -f "$file_path" ] || continue
        SOURCE_FILES+=("$file_path")
        SOURCE_BASENAMES+=("$(basename "$file_path")")
    done

    [ "${#SOURCE_FILES[@]}" -gt 0 ] || fail "No .toml agent files found in ${SOURCE_DIR}"
}

validate_source_files() {
    local file_path
    for file_path in "${SOURCE_FILES[@]}"; do
        grep -Eq '^name[[:space:]]*=' "$file_path" || fail "Missing name field: ${file_path}"
        grep -Eq '^description[[:space:]]*=' "$file_path" || fail "Missing description field: ${file_path}"
        grep -Eq '^developer_instructions[[:space:]]*=' "$file_path" || fail "Missing developer_instructions field: ${file_path}"
    done
}

copy_into_place() {
    local source_path="$1"
    local target_path="$2"

    if [ -L "$target_path" ]; then
        rm "$target_path"
    fi

    cp "$source_path" "$target_path"
}

remove_stale_owned_files() {
    local removed=0
    local i
    for ((i = 0; i < ${#MANIFEST_FILES[@]}; i++)); do
        local managed_name
        managed_name="${MANIFEST_FILES[$i]}"
        if source_contains_name "$managed_name"; then
            continue
        fi

        local target_path
        target_path="${AGENTS_DIR}/${managed_name}"
        if [ -e "$target_path" ] || [ -L "$target_path" ]; then
            rm -f "$target_path"
            log "Removed stale managed agent: ${managed_name}"
            removed=$((removed + 1))
        fi
    done

    return "$removed"
}

run_install_like() {
    local mode="$1"

    mkdir -p "$AGENTS_DIR"
    collect_source_files
    validate_source_files
    load_manifest

    OWNED_FILES=()
    local installed=0
    local updated=0
    local adopted_symlinks=0
    local restored=0
    local skipped_conflicts=0
    local file_path

    remove_stale_owned_files || true

    for file_path in "${SOURCE_FILES[@]}"; do
        local basename
        basename="$(basename "$file_path")"
        local target_path
        target_path="${AGENTS_DIR}/${basename}"

        if [ -e "$target_path" ] || [ -L "$target_path" ]; then
            if manifest_contains_name "$basename"; then
                copy_into_place "$file_path" "$target_path"
                updated=$((updated + 1))
                OWNED_FILES+=("$basename")
                continue
            fi

            if legacy_symlink_matches "$target_path" "$basename"; then
                copy_into_place "$file_path" "$target_path"
                adopted_symlinks=$((adopted_symlinks + 1))
                OWNED_FILES+=("$basename")
                continue
            fi

            skipped_conflicts=$((skipped_conflicts + 1))
            warn "Skipped unmanaged file: ${target_path}"
            continue
        fi

        if [ "$mode" = "sync" ]; then
            if manifest_contains_name "$basename"; then
                copy_into_place "$file_path" "$target_path"
                restored=$((restored + 1))
                OWNED_FILES+=("$basename")
            fi
            continue
        fi

        copy_into_place "$file_path" "$target_path"
        installed=$((installed + 1))
        OWNED_FILES+=("$basename")
    done

    if [ "${#OWNED_FILES[@]}" -eq 0 ]; then
        if [ "$mode" = "install" ]; then
            fail "No agents installed because every target conflicted with an unmanaged file"
        fi
        [ "$skipped_conflicts" -gt 0 ] && warn "Skipped ${skipped_conflicts} unmanaged conflict(s) during sync"
        return 0
    fi

    write_manifest

    if [ "$mode" = "install" ]; then
        log "Installed ${#OWNED_FILES[@]} managed agent files into ${AGENTS_DIR}"
        [ "$installed" -gt 0 ] && log "New files copied: ${installed}"
        [ "$updated" -gt 0 ] && log "Previously managed files refreshed: ${updated}"
        [ "$adopted_symlinks" -gt 0 ] && log "Legacy symlinks migrated to managed copies: ${adopted_symlinks}"
        [ "$skipped_conflicts" -gt 0 ] && warn "Unmanaged conflicts left untouched: ${skipped_conflicts}"
        log "Start a new Codex session to load newly installed agent roles."
    else
        [ "$updated" -gt 0 ] && log "Synced ${updated} managed agent files"
        [ "$restored" -gt 0 ] && log "Restored ${restored} missing managed agent file(s)"
        [ "$adopted_symlinks" -gt 0 ] && log "Migrated ${adopted_symlinks} legacy symlink(s) to managed copies"
        [ "$skipped_conflicts" -gt 0 ] && warn "Skipped ${skipped_conflicts} unmanaged conflict(s) during sync"
    fi

    return 0
}

run_uninstall() {
    mkdir -p "$AGENTS_DIR"
    load_manifest

    local removed=0
    local i
    for ((i = 0; i < ${#MANIFEST_FILES[@]}; i++)); do
        local managed_name
        managed_name="${MANIFEST_FILES[$i]}"
        local target_path
        target_path="${AGENTS_DIR}/${managed_name}"
        if [ -e "$target_path" ] || [ -L "$target_path" ]; then
            rm -f "$target_path"
            log "Removed managed agent: ${managed_name}"
            removed=$((removed + 1))
        fi
    done

    local target_path
    for target_path in "$AGENTS_DIR"/*.toml; do
        [ -L "$target_path" ] || continue
        if legacy_symlink_matches "$target_path" "$(basename "$target_path")"; then
            rm -f "$target_path"
            log "Removed legacy symlink: $(basename "$target_path")"
            removed=$((removed + 1))
        fi
    done

    rm -f "$MANIFEST_PATH"
    log "Removed ${removed} awesome-agent-select agent file(s) from ${AGENTS_DIR}"
}

run_doctor() {
    mkdir -p "$AGENTS_DIR"
    collect_source_files
    validate_source_files
    load_manifest

    local issues=0
    local file_path
    for file_path in "${SOURCE_FILES[@]}"; do
        local basename
        basename="$(basename "$file_path")"
        local target_path
        target_path="${AGENTS_DIR}/${basename}"

        if [ ! -e "$target_path" ] && [ ! -L "$target_path" ]; then
            warn "Missing agent file: ${target_path}"
            issues=$((issues + 1))
            continue
        fi

        if legacy_symlink_matches "$target_path" "$basename"; then
            warn "Legacy symlink still present: ${target_path}"
            issues=$((issues + 1))
            continue
        fi

        if ! manifest_contains_name "$basename"; then
            warn "Unmanaged file present at target path: ${target_path}"
            issues=$((issues + 1))
            continue
        fi

        if ! cmp -s "$file_path" "$target_path"; then
            warn "Managed file drift detected: ${target_path}"
            issues=$((issues + 1))
            continue
        fi
    done

    if [ ! -f "$MANIFEST_PATH" ]; then
        warn "Manifest not found: ${MANIFEST_PATH}"
        issues=$((issues + 1))
    fi

    if [ "$issues" -eq 0 ]; then
        log "Doctor OK: awesome-agent-select agents are installed and up to date in ${AGENTS_DIR}"
        return 0
    fi

    warn "Doctor found ${issues} issue(s)"
    return 1
}

COMMAND="${1:-install}"
shift || true

CODEX_HOME="${CODEX_HOME:-${HOME}/.codex}"
SOURCE_DIR=""
QUIET_MODE=0

while [ "$#" -gt 0 ]; do
    case "$1" in
        --codex-home)
            [ "$#" -ge 2 ] || fail "--codex-home requires a value"
            CODEX_HOME="$2"
            shift 2
            ;;
        --source-dir)
            [ "$#" -ge 2 ] || fail "--source-dir requires a value"
            SOURCE_DIR="$2"
            shift 2
            ;;
        --bootstrap)
            QUIET_MODE=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            fail "Unknown argument: $1"
            ;;
    esac
done

if [ -z "$SOURCE_DIR" ] && [ "$COMMAND" != "uninstall" ]; then
    SOURCE_DIR="$(default_source_dir)/agents"
fi

AGENTS_DIR="${CODEX_HOME}/agents"
MANIFEST_PATH="${AGENTS_DIR}/${MANIFEST_BASENAME}"

case "$COMMAND" in
    install)
        run_install_like "install"
        ;;
    sync)
        run_install_like "sync"
        ;;
    uninstall)
        run_uninstall
        ;;
    doctor)
        run_doctor
        ;;
    *)
        usage
        fail "Unknown command: ${COMMAND}"
        ;;
esac
