#!/usr/bin/env bash
set -euo pipefail

project_root="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
vendor_root="$project_root/.brain/vendor"
uv_cache_dir="$project_root/.cache/uv"

superpowers_repo="https://github.com/obra/superpowers.git"
superpowers_ref="v5.1.0"
superpowers_dir="$vendor_root/superpowers"

spec_kit_package="git+https://github.com/github/spec-kit.git@v0.10.2"
openspec_package="@fission-ai/openspec@1.4.1"

mkdir -p "$vendor_root"/{_tools/openspec-npm,spec-kit,openspec} "$uv_cache_dir"

if [ -d "$superpowers_dir/.git" ]; then
  git -C "$superpowers_dir" fetch --depth 1 origin tag "$superpowers_ref"
  git -C "$superpowers_dir" checkout --detach "$superpowers_ref"
elif [ -e "$superpowers_dir" ]; then
  echo "ERROR: $superpowers_dir exists but is not a git repository" >&2
  exit 1
else
  git clone --branch "$superpowers_ref" --depth 1 "$superpowers_repo" "$superpowers_dir"
fi

UV_CACHE_DIR="$uv_cache_dir" uv tool install specify-cli --from "$spec_kit_package"
specify_bin="$(UV_CACHE_DIR="$uv_cache_dir" uv tool dir --bin)/specify"
(cd "$vendor_root/spec-kit" && "$specify_bin" init --here --force --ignore-agent-tools --integration codex --integration-options="--skills" --script sh)

npm install --prefix "$vendor_root/_tools/openspec-npm" "$openspec_package"
HOME="$vendor_root/openspec/.home" CODEX_HOME="$vendor_root/openspec/.codex-home" OPENSPEC_TELEMETRY=0 "$vendor_root/_tools/openspec-npm/node_modules/.bin/openspec" init --tools all --profile core "$vendor_root/openspec"
