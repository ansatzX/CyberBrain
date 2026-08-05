#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
installer="$project_root/plugins/brain/skills/tame-dev-workflows/scripts/install-vendor.sh"

extract_assignment() {
  local name="$1"
  sed -n "s/^${name}=\"\(.*\)\"$/\1/p" "$installer"
}

assert_equal() {
  local name="$1"
  local expected="$2"
  local actual="$3"

  if [ "$actual" != "$expected" ]; then
    echo "FAIL: $name expected '$expected', got '$actual'" >&2
    return 1
  fi
}

status=0
assert_equal "Superpowers" "6.1.1" "$(extract_assignment superpowers_version)" || status=1
assert_equal "Spec Kit" "git+https://github.com/github/spec-kit.git@v0.12.18" "$(extract_assignment spec_kit_package)" || status=1
assert_equal "OpenSpec" "@fission-ai/openspec@1.5.0" "$(extract_assignment openspec_package)" || status=1

if [ "$status" -ne 0 ]; then
  exit "$status"
fi

echo "PASS: vendor workflow versions are locked to the expected releases"
