#!/usr/bin/env bash
set -euo pipefail

project_root="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
vendor_root="$project_root/.brain/vendor"
uv_cache_dir="$project_root/.cache/uv"

codex_home="${CODEX_HOME:-$HOME/.codex}"
superpowers_version="6.1.1"
superpowers_source_dir="${SUPERPOWERS_PLUGIN_ROOT:-$codex_home/plugins/cache/openai-curated-remote/superpowers/$superpowers_version}"
superpowers_dir="$vendor_root/superpowers"
openspec_dir="$vendor_root/openspec"

spec_kit_package="git+https://github.com/github/spec-kit.git@v0.12.18"
openspec_package="@fission-ai/openspec@1.5.0"

mkdir -p "$vendor_root"/{_tools/openspec-npm,spec-kit} "$uv_cache_dir"

if [ ! -f "$superpowers_source_dir/.codex-plugin/plugin.json" ]; then
  echo "ERROR: Superpowers Codex plugin $superpowers_version is not installed at $superpowers_source_dir" >&2
  echo "Install or refresh Superpowers from the official Codex plugin marketplace first." >&2
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
(cd "$vendor_root/spec-kit" && "$specify_bin" init --here --force --ignore-agent-tools --integration codex --integration-options="--skills" --script sh)

npm install --prefix "$vendor_root/_tools/openspec-npm" "$openspec_package"
rm -rf "$openspec_dir"
mkdir -p "$openspec_dir"
HOME="$openspec_dir/.home" CODEX_HOME="$openspec_dir/.codex-home" OPENSPEC_TELEMETRY=0 "$vendor_root/_tools/openspec-npm/node_modules/.bin/openspec" init --tools codex --profile core "$openspec_dir"
