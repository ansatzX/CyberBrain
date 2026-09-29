#!/usr/bin/env bash
set -euo pipefail

project_root="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
vendor_root="$project_root/.brain/vendor"
uv_cache_dir="$project_root/.cache/uv"

codex_home="${CODEX_HOME:-$HOME/.codex}"
superpowers_version="6.4.1"
superpowers_source_dir="${SUPERPOWERS_PLUGIN_ROOT:-$codex_home/plugins/cache/openai-curated-remote/superpowers/$superpowers_version}"
superpowers_dir="$vendor_root/superpowers"
spec_kit_dir="$vendor_root/spec-kit"
openspec_dir="$vendor_root/openspec"

spec_kit_package="git+https://github.com/github/spec-kit.git@v1.0.8"
openspec_package="@fission-ai/openspec@1.13.1"

mkdir -p "$vendor_root/_tools/openspec-npm" "$uv_cache_dir"

download_dir=""
trap 'if [ -n "$download_dir" ]; then rm -rf -- "$download_dir"; fi' EXIT

if [ -z "${SUPERPOWERS_PLUGIN_ROOT:-}" ] &&
  ! jq -e --arg version "$superpowers_version" '.version == $version' \
    "$superpowers_source_dir/.codex-plugin/plugin.json" >/dev/null 2>&1; then
  download_dir="$(mktemp -d "$vendor_root/_tools/superpowers-download.XXXXXXXX")"
  echo "Downloading official Superpowers v$superpowers_version from GitHub..."
  git clone --depth 1 --branch "v$superpowers_version" \
    https://github.com/obra/superpowers.git "$download_dir/source"
  superpowers_source_dir="$download_dir/source"
fi

if [ ! -f "$superpowers_source_dir/.codex-plugin/plugin.json" ]; then
  echo "ERROR: missing Superpowers Codex plugin manifest at $superpowers_source_dir" >&2
  exit 1
fi

installed_superpowers_version="$(jq -r '.version // empty' "$superpowers_source_dir/.codex-plugin/plugin.json")"
if [ "$installed_superpowers_version" != "$superpowers_version" ]; then
  echo "ERROR: expected Superpowers $superpowers_version, found $installed_superpowers_version" >&2
  exit 1
fi

rm -rf "$superpowers_dir"
mkdir -p "$superpowers_dir"
cp -a "$superpowers_source_dir/." "$superpowers_dir/"

UV_CACHE_DIR="$uv_cache_dir" uv tool install specify-cli --from "$spec_kit_package"
specify_bin="$(UV_CACHE_DIR="$uv_cache_dir" uv tool dir --bin)/specify"
# Keep the old snapshot recoverable, but never merge it into a new installation.
if [ -e "$spec_kit_dir" ] || [ -L "$spec_kit_dir" ]; then
  mkdir -p "$project_root/.brain/backups"
  spec_kit_backup="$(mktemp -d "$project_root/.brain/backups/spec-kit.XXXXXXXX")"
  mv -- "$spec_kit_dir" "$spec_kit_backup/spec-kit"
  echo "Previous Spec Kit snapshot saved at $spec_kit_backup/spec-kit"
fi
mkdir -p "$spec_kit_dir"
(cd "$spec_kit_dir" && "$specify_bin" init --here --non-interactive --ignore-agent-tools --integration codex --integration-options="--skills" --script sh)

npm install --prefix "$vendor_root/_tools/openspec-npm" "$openspec_package"
rm -rf "$openspec_dir"
mkdir -p "$openspec_dir"
HOME="$openspec_dir/.home" CODEX_HOME="$openspec_dir/.codex-home" OPENSPEC_TELEMETRY=0 "$vendor_root/_tools/openspec-npm/node_modules/.bin/openspec" init --tools codex --profile core "$openspec_dir"
