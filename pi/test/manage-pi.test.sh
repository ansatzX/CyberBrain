#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PI_HOME="$TMP/home/.pi/agent"
FAKE_LOG="$TMP/pi.log"
mkdir -p "$PI_HOME/extensions" "$PI_HOME/lib" "$PI_HOME/slashes" "$PI_HOME/skills/pi-extension-dev" "$TMP/bin"
cp "$REPO_ROOT/pi/extensions/goal.ts" "$PI_HOME/extensions/goal.ts"
cp "$REPO_ROOT/pi/skills/pi-extension-dev/SKILL.md" "$PI_HOME/skills/pi-extension-dev/SKILL.md"
cat > "$TMP/bin/pi" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$FAKE_PI_LOG"
case "${1:-}" in
  install)
    python3 - "$PI_CODING_AGENT_DIR/settings.json" "$2" <<'PY'
import json, os, sys
from pathlib import Path
path=Path(sys.argv[1]); source=sys.argv[2]
path.parent.mkdir(parents=True, exist_ok=True)
data=json.loads(path.read_text()) if path.exists() else {}
packages=data.setdefault('packages', [])
stored=os.path.relpath(source, path.parent.resolve())
if stored not in packages: packages.append(stored)
path.write_text(json.dumps(data, indent=2)+'\n')
PY
    ;;
  remove)
    python3 - "$PI_CODING_AGENT_DIR/settings.json" "$2" <<'PY'
import json, sys
from pathlib import Path
path=Path(sys.argv[1]); source=sys.argv[2]
data=json.loads(path.read_text()) if path.exists() else {}
data['packages']=[item for item in data.get('packages', []) if (path.parent / item).resolve() != Path(source).resolve()]
path.write_text(json.dumps(data, indent=2)+'\n')
PY
    ;;
esac
EOF
chmod +x "$TMP/bin/pi"

run() {
  FAKE_PI_LOG="$FAKE_LOG" AIHUBMIX_API_KEY=test DEEPSEEK_API_KEY=test \
    bash "$REPO_ROOT/tools/manage-pi.sh" "$@" \
    --pi-home "$PI_HOME" --pi-bin "$TMP/bin/pi" --repo-root "$REPO_ROOT"
}

run install --dry-run
test ! -f "$PI_HOME/.cyberbrain-pi.manifest.json"
test -f "$PI_HOME/extensions/goal.ts"

printf 'unmanaged' > "$PI_HOME/extensions/goal.ts"
if run install 2>"$TMP/conflict.err"; then
  echo "expected unmanaged conflict" >&2
  exit 1
fi
grep -q "unmanaged conflict" "$TMP/conflict.err"

cp "$REPO_ROOT/pi/extensions/goal.ts" "$PI_HOME/extensions/goal.ts"
run install
test -f "$PI_HOME/.cyberbrain-pi.manifest.json"
test ! -e "$PI_HOME/extensions/goal.ts"
grep -q "install $REPO_ROOT/pi" "$FAKE_LOG"
run doctor
run install
run doctor
run uninstall --restore-legacy
grep -q "remove $REPO_ROOT/pi" "$FAKE_LOG"
test -e "$PI_HOME/extensions/goal.ts"
grep -q '"packages": \[\]' "$PI_HOME/settings.json"

echo "manage-pi integration tests passed"
