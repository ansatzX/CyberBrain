# Cyberbrain Pi Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Cyberbrain the single source of truth for its Codex and pi configuration, with a local `cyberbrain-pi` package and a safe migration/doctor/uninstall workflow.

**Architecture:** Keep existing Codex plugins unchanged and add a self-contained `pi/` host adapter. Pi extensions live in `pi/extensions`, pure logic and tests live in `pi/lib` and `pi/test`, while all existing Cyberbrain skills remain single-source under `plugins/*/skills` and are referenced from the pi package manifest. `tools/manage-pi.sh` owns migration of legacy files and registration of the local package, but never manages credentials, user preferences, sessions, cache, or goals.

**Tech Stack:** TypeScript/Node 24 (`node:test`), Pi extension/package APIs, POSIX shell, JSON manifests, jq 1.8.1+, Git.

## Global Constraints

- Preserve all existing Codex marketplace/plugin/agent-installer behavior.
- Do not modify or commit secrets: `auth.json`, API keys, sessions, cache, goals, shell env files.
- Do not manage pi theme, thinking level, default model/provider, or enabled-model preferences.
- Provider IDs remain `aihubmix` and `deepseek-responses`; only the extension entry is named `third-party-all-in-one`.
- DeepSeek hosted web search is enabled by default and disabled only by `CYBERBRAIN_DEEPSEEK_WEB_SEARCH=0`.
- Package slash definitions load before `~/.pi/agent/slashes`; home definitions override identical `namespace:name` entries with one warning.
- Pi package/extensions support macOS, Linux, and Windows; `tools/manage-pi.sh` supports macOS/Linux only.
- Keep external third-party resources (Superpowers, Lark, etc.) outside Cyberbrain ownership.
- Follow TDD: every behavior change starts with a failing test and is followed by the smallest passing implementation.
- Cyberbrain has existing untracked `AGENTS.md` and `CODEX_PLUGIN_SYSTEM.md`; preserve their contents, intentionally add the updated files only when Task 7 is reached.

---

## File Map

```text
pi/package.json                              package manifest
pi/README.md                                 package developer guide
pi/extensions/goal.ts                       goal command/tool/lifecycle adapter
pi/extensions/slash-framework.ts             slash registration + scope lifecycle
pi/extensions/utility-commands.ts            /ansatz:diff and /ansatz:status
pi/extensions/third-party-all-in-one.ts       provider extension entry
pi/lib/goal-core.ts                          goal state machine + storage
pi/lib/slash-core.ts                         slash parsing/merge/message helpers
pi/lib/third-party/aihubmix.ts               AIHubMix provider and discovery cache
pi/lib/third-party/deepseek-responses.ts      DeepSeek provider + hosted web search
pi/slashes/python.md                         session-scoped Python mode
pi/slashes/review.md                         once-scoped review mode
pi/skills/pi-extension-dev/**                pi extension development skill
pi/test/goal-core.test.ts                     goal tests
pi/test/slash-core.test.ts                    slash and override tests
pi/test/third-party-all-in-one.test.ts        provider/web-search tests
pi/test/package-manifest.test.ts              package manifest/shared-skill tests
tools/manage-pi.sh                            public lifecycle installer
tools/manage-pi.py                            manifest-safe implementation
pi/test/manage-pi.test.sh                     installer integration tests
PI_SUPPORT.md                                 user-facing pi guide
README.md                                     dual-host entry page
AGENTS.md                                     shared + host-boundary instructions
CODEX_PLUGIN_SYSTEM.md                        Codex-adapter-scoped documentation
```

---

### Task 1: Establish the Pi package manifest and shared-skill contract

**Files:**
- Create: `pi/package.json`
- Create: `pi/test/package-manifest.test.ts`
- Create: `pi/README.md`

**Interfaces:**
- Produces package name `cyberbrain-pi`.
- Exposes `extensions/*.ts`, `skills/pi-extension-dev`, and the existing Brain/Tachikoma/Awesome Agent Select skill roots.
- Later tasks may add files under the declared resource paths without changing manifest shape.

- [ ] **Step 1: Write the failing package-manifest test**

Create `pi/test/package-manifest.test.ts`:

```typescript
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const piRoot = resolve(testDir, "..");
const repoRoot = resolve(piRoot, "..");
const pkg = JSON.parse(readFileSync(resolve(piRoot, "package.json"), "utf8"));

test("manifest defines the local cyberbrain-pi package", () => {
  assert.equal(pkg.name, "cyberbrain-pi");
  assert.equal(pkg.private, true);
  assert.ok(pkg.keywords.includes("pi-package"));
  assert.deepEqual(pkg.pi.extensions, ["./extensions/*.ts"]);
});

test("manifest exposes every approved Cyberbrain skill root from one source", () => {
  assert.deepEqual(pkg.pi.skills, [
    "./skills",
    "../plugins/brain/skills",
    "../plugins/tachikoma/skills",
    "../plugins/awesome-agent-select/skills",
  ]);
  for (const relativePath of pkg.pi.skills) {
    assert.equal(existsSync(resolve(piRoot, relativePath)), true, relativePath);
  }
  assert.equal(existsSync(resolve(repoRoot, "plugins/brain/skills/codex-compatible/SKILL.md")), true);
  assert.equal(existsSync(resolve(repoRoot, "plugins/awesome-agent-select/skills/team-leader/SKILL.md")), true);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
cd /Users/ansatz/data/code/Cyberbrain
node --test pi/test/package-manifest.test.ts
```

Expected: FAIL because `pi/package.json` does not exist.

- [ ] **Step 3: Create the package manifest**

Create `pi/package.json`:

```json
{
  "name": "cyberbrain-pi",
  "version": "0.1.0",
  "private": true,
  "description": "Cyberbrain personal configuration adapter for Pi",
  "keywords": ["pi-package", "coding-agent", "personal-config"],
  "pi": {
    "extensions": ["./extensions/*.ts"],
    "skills": [
      "./skills",
      "../plugins/brain/skills",
      "../plugins/tachikoma/skills",
      "../plugins/awesome-agent-select/skills"
    ]
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*"
  }
}
```

- [ ] **Step 4: Create the package developer README**

Create `pi/README.md` with these exact sections and commands:

```markdown
# cyberbrain-pi

Pi host adapter for the Cyberbrain personal agent configuration repository.

## Development

```bash
node --test pi/test/*.test.ts
for file in pi/extensions/*.ts pi/lib/*.ts pi/lib/third-party/*.ts; do node --check "$file"; done
```

## Local install

```bash
bash tools/manage-pi.sh install
bash tools/manage-pi.sh doctor
```

The package does not manage credentials, sessions, goals, model preferences, themes, or thinking settings.
```

- [ ] **Step 5: Run the test and verify GREEN**

Run: `node --test pi/test/package-manifest.test.ts`
Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add pi/package.json pi/README.md pi/test/package-manifest.test.ts
git commit -m "feat(pi): add cyberbrain-pi package manifest"
```

---

### Task 2: Move goal, utility commands, and tests into the package

**Files:**
- Create from current tested source: `pi/extensions/goal.ts`
- Create from current tested source: `pi/extensions/utility-commands.ts`
- Create from current tested source: `pi/lib/goal-core.ts`
- Create from current tested source: `pi/test/goal-core.test.ts`
- Delete after installer migration, not in this task: files under `~/.pi/agent`

**Interfaces:**
- `goal-core.ts` exports `GoalState`, `getSessionThreadId`, storage/state functions, prompts, and tool wrappers.
- `goal.ts` registers `/ansatz:goal`, `create_goal`, `get_goal`, `update_goal`, and immediate `agent_settled` continuation.
- `utility-commands.ts` registers `/ansatz:diff` and `/ansatz:status` and imports only from `../lib/goal-core.ts`.

- [ ] **Step 1: Copy the current passing goal test into the package**

```bash
mkdir -p pi/test pi/lib pi/extensions
cp ~/.pi/agent/lib/goal-core.test.ts pi/test/goal-core.test.ts
```

Adjust its import from `./goal-core.ts` to `../lib/goal-core.ts`:

```bash
python3 - <<'PY'
from pathlib import Path
path = Path("pi/test/goal-core.test.ts")
text = path.read_text()
old = 'from "./goal-core.ts";'
new = 'from "../lib/goal-core.ts";'
if old not in text:
    raise SystemExit("goal-core test import not found")
path.write_text(text.replace(old, new, 1))
PY
```

- [ ] **Step 2: Run the package test and verify RED**

Run: `node --test pi/test/goal-core.test.ts`
Expected: FAIL because `pi/lib/goal-core.ts` does not exist.

- [ ] **Step 3: Copy the current passing core implementation**

```bash
cp ~/.pi/agent/lib/goal-core.ts pi/lib/goal-core.ts
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node --test pi/test/goal-core.test.ts`
Expected: all goal tests pass, including JSON migration, distinct-turn blocked audit, pause/resume, and blocked replacement rejection.

- [ ] **Step 5: Copy and adapt the goal extension**

```bash
cp ~/.pi/agent/extensions/goal.ts pi/extensions/goal.ts
```

Ensure imports remain package-relative:

```typescript
from "../lib/goal-core.ts";
```

- [ ] **Step 6: Create utility-commands.ts from the current harness commands**

Copy `~/.pi/agent/extensions/codex-slash.ts` to `pi/extensions/utility-commands.ts`, then apply exact naming edits:

```bash
cp ~/.pi/agent/extensions/codex-slash.ts pi/extensions/utility-commands.ts
python3 - <<'PY'
from pathlib import Path
path = Path("pi/extensions/utility-commands.ts")
text = path.read_text()
text = text.replace("Codex-like slash commands for pi", "Cyberbrain Pi utility commands")
text = text.replace("export default function codexSlash", "export default function utilityCommands")
if "export default function utilityCommands" not in text:
    raise SystemExit("utility command export rename failed")
path.write_text(text)
PY
```

Verify the import remains exactly:

```typescript
import { getSessionThreadId, loadGoal } from "../lib/goal-core.ts";
```

- [ ] **Step 7: Syntax-check both extension entries**

```bash
node --check pi/extensions/goal.ts
node --check pi/extensions/utility-commands.ts
node --check pi/lib/goal-core.ts
```

Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add pi/extensions/goal.ts pi/extensions/utility-commands.ts pi/lib/goal-core.ts pi/test/goal-core.test.ts
git commit -m "feat(pi): package persistent goal and utility commands"
```

---

### Task 3: Package slash defaults with home override and lifecycle scope

**Files:**
- Create: `pi/lib/slash-core.ts`
- Create: `pi/extensions/slash-framework.ts`
- Create: `pi/slashes/python.md`
- Create: `pi/slashes/review.md`
- Create: `pi/test/slash-core.test.ts`

**Interfaces:**
- `loadSlashDefinitions(directory)` parses one source directory.
- New `mergeSlashDefinitions(packageDefinitions, homeDefinitions, warn)` returns deterministic definitions keyed by `namespace:name`, home wins, warning once per override.
- `slash-framework.ts` derives the package slash directory from `import.meta.url`, then merges home overrides.

- [ ] **Step 1: Copy current slash tests and add the failing override test**

```bash
cp ~/.pi/agent/lib/slash-core.test.ts pi/test/slash-core.test.ts
```

Change imports to `../lib/slash-core.ts` and append:

```typescript
import { mergeSlashDefinitions } from "../lib/slash-core.ts";

test("home slash overrides package definition with one warning", () => {
  const warnings: string[] = [];
  const packageDef = { name: "review", namespace: "ansatz", description: "package", prompt: "package", scope: "once" as const };
  const homeDef = { ...packageDef, description: "home", prompt: "home" };
  const merged = mergeSlashDefinitions([packageDef], [homeDef], (message) => warnings.push(message));
  assert.equal(merged.length, 1);
  assert.equal(merged[0].prompt, "home");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /ansatz:review/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test pi/test/slash-core.test.ts`
Expected: FAIL because `pi/lib/slash-core.ts`/`mergeSlashDefinitions` is missing.

- [ ] **Step 3: Copy slash-core and implement merge**

```bash
cp ~/.pi/agent/lib/slash-core.ts pi/lib/slash-core.ts
```

Append:

```typescript
export function mergeSlashDefinitions(
  packageDefinitions: SlashDef[],
  homeDefinitions: SlashDef[],
  warn: (message: string) => void,
): SlashDef[] {
  const merged = new Map<string, SlashDef>();
  for (const definition of packageDefinitions) {
    merged.set(`${definition.namespace}:${definition.name}`, definition);
  }
  for (const definition of homeDefinitions) {
    const key = `${definition.namespace}:${definition.name}`;
    if (merged.has(key)) warn(`Home slash override replaces Cyberbrain /${key}`);
    merged.set(key, definition);
  }
  return [...merged.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, definition]) => definition);
}
```

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test pi/test/slash-core.test.ts`
Expected: all slash tests pass.

- [ ] **Step 5: Copy package slash definitions**

```bash
mkdir -p pi/slashes
cp ~/.pi/agent/slashes/python.md pi/slashes/python.md
cp ~/.pi/agent/slashes/review.md pi/slashes/review.md
```

- [ ] **Step 6: Copy and adapt slash-framework.ts**

```bash
cp ~/.pi/agent/extensions/slash-framework.ts pi/extensions/slash-framework.ts
```

Replace its single directory load with:

```typescript
const packageSlashesDir = resolve(dirname(fileURLToPath(import.meta.url)), "../slashes");
const homeSlashesDir = join(homedir(), ".pi", "agent", "slashes");
const definitions = mergeSlashDefinitions(
  loadSlashDefinitions(packageSlashesDir),
  loadSlashDefinitions(homeSlashesDir),
  (message) => console.warn(message),
);
```

Imports must include:

```typescript
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeSlashDefinitions } from "../lib/slash-core.ts";
```

- [ ] **Step 7: Verify**

```bash
node --test pi/test/slash-core.test.ts
node --check pi/extensions/slash-framework.ts
```

- [ ] **Step 8: Commit**

```bash
git add pi/extensions/slash-framework.ts pi/lib/slash-core.ts pi/slashes pi/test/slash-core.test.ts
git commit -m "feat(pi): package namespaced slash modes with home override"
```

---

### Task 4: Build third-party-all-in-one providers

**Files:**
- Create: `pi/extensions/third-party-all-in-one.ts`
- Create: `pi/lib/third-party/aihubmix.ts`
- Create: `pi/lib/third-party/deepseek-responses.ts`
- Create: `pi/test/third-party-all-in-one.test.ts`

**Interfaces:**
- `registerAIHubMix(pi, env, deps)` preserves the current tested API.
- `registerDeepSeekResponses(pi, env)` registers provider ID `deepseek-responses`.
- `installDeepSeekWebSearch(pi, env)` injects `{ type: "web_search" }` only for that provider and unless `CYBERBRAIN_DEEPSEEK_WEB_SEARCH=0`.
- `third-party-all-in-one.ts` is the only extension entry for both providers.

- [ ] **Step 1: Copy the current AIHubMix implementation and tests as the test baseline**

```bash
mkdir -p pi/lib/third-party pi/test
cp /Users/ansatz/tmp/pi/aihubmix.ts pi/lib/third-party/aihubmix.ts
cp /Users/ansatz/tmp/pi/test/aihubmix.test.ts pi/test/third-party-all-in-one.test.ts
cp /Users/ansatz/tmp/pi/test/fixtures.ts pi/test/fixtures.ts
```

Update imports in the copied test:

```typescript
from "../lib/third-party/aihubmix.ts";
```

- [ ] **Step 2: Append failing DeepSeek tests**

Append to `pi/test/third-party-all-in-one.test.ts`:

```typescript
import { installDeepSeekWebSearch, registerDeepSeekResponses } from "../lib/third-party/deepseek-responses.ts";

test("registerDeepSeekResponses registers the Responses provider", () => {
  const registrations: Array<{ name: string; config: Record<string, unknown> }> = [];
  registerDeepSeekResponses({ registerProvider: (name, config) => registrations.push({ name, config }) }, {});
  assert.equal(registrations[0].name, "deepseek-responses");
  assert.equal(registrations[0].config.api, "openai-responses");
  assert.equal(registrations[0].config.apiKey, "$DEEPSEEK_API_KEY");
});

test("DeepSeek web search is default-on and can be disabled", () => {
  const handlers: Array<(event: any, ctx: any) => unknown> = [];
  installDeepSeekWebSearch({ on: (_event, handler) => handlers.push(handler) }, {});
  const payload = { model: "deepseek-v4-flash", input: [], tools: [] };
  const enabled = handlers[0]({ payload }, { model: { provider: "deepseek-responses" } });
  assert.deepEqual(enabled.tools, [{ type: "web_search" }]);

  const disabled: unknown[] = [];
  installDeepSeekWebSearch({ on: (_event, handler) => disabled.push(handler) }, { CYBERBRAIN_DEEPSEEK_WEB_SEARCH: "0" });
  assert.equal(disabled.length, 0);
});

test("DeepSeek web search ignores every other provider", () => {
  const handlers: Array<(event: any, ctx: any) => unknown> = [];
  installDeepSeekWebSearch({ on: (_event, handler) => handlers.push(handler) }, {});
  const payload = { model: "gpt-5.6-sol", input: [], tools: [] };
  assert.equal(handlers[0]({ payload }, { model: { provider: "aihubmix" } }), undefined);
});
```

- [ ] **Step 3: Run and verify RED**

Run: `node --test pi/test/third-party-all-in-one.test.ts`
Expected: FAIL because `deepseek-responses.ts` is missing.

- [ ] **Step 4: Implement DeepSeek provider + web search**

Create `pi/lib/third-party/deepseek-responses.ts`:

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Registrar = Pick<ExtensionAPI, "registerProvider">;
type HookRegistrar = Pick<ExtensionAPI, "on">;
type Env = Record<string, string | undefined>;

export function registerDeepSeekResponses(pi: Registrar, _env: Env = process.env): void {
  pi.registerProvider("deepseek-responses", {
    name: "DeepSeek (Responses API)",
    baseUrl: "https://api.deepseek.com",
    api: "openai-responses",
    apiKey: "$DEEPSEEK_API_KEY",
    models: [{
      id: "deepseek-v4-flash",
      name: "deepseek-v4-flash-response",
      reasoning: true,
      input: ["text"],
      contextWindow: 131072,
      maxTokens: 8192,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
    }]
  });
}

export function installDeepSeekWebSearch(pi: HookRegistrar, env: Env = process.env): void {
  if (env.CYBERBRAIN_DEEPSEEK_WEB_SEARCH === "0") return;
  pi.on("before_provider_request", (event, ctx) => {
    const payload = event.payload as { input?: unknown; tools?: Array<{ type?: string }>; [key: string]: unknown };
    if (!ctx.model || ctx.model.provider !== "deepseek-responses" || !Array.isArray(payload.input)) return undefined;
    const tools = Array.isArray(payload.tools) ? payload.tools : [];
    if (tools.some((tool) => tool.type === "web_search")) return undefined;
    return { ...payload, tools: [...tools, { type: "web_search" }] };
  });
}
```

- [ ] **Step 5: Create the single extension entry**

Create `pi/extensions/third-party-all-in-one.ts`:

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerAIHubMix } from "../lib/third-party/aihubmix.ts";
import { installDeepSeekWebSearch, registerDeepSeekResponses } from "../lib/third-party/deepseek-responses.ts";

export default async function thirdPartyAllInOne(pi: ExtensionAPI): Promise<void> {
  await registerAIHubMix(pi);
  registerDeepSeekResponses(pi);
  installDeepSeekWebSearch(pi);
}
```

- [ ] **Step 6: Run full provider tests and syntax checks**

```bash
node --test pi/test/third-party-all-in-one.test.ts
node --check pi/extensions/third-party-all-in-one.ts
node --check pi/lib/third-party/*.ts
```

Expected: AIHubMix tests plus all DeepSeek/web-search tests pass.

- [ ] **Step 7: Commit**

```bash
git add pi/extensions/third-party-all-in-one.ts pi/lib/third-party pi/test/third-party-all-in-one.test.ts pi/test/fixtures.ts
git commit -m "feat(pi): add third-party all-in-one providers"
```

---

### Task 5: Package pi-extension-dev and validate package loading

**Files:**
- Create: `pi/skills/pi-extension-dev/**` from current skill
- Modify: `pi/test/package-manifest.test.ts`

**Interfaces:**
- Skill references package paths, not `~/.pi/agent` source paths except where documenting runtime state/override directories.
- Package manifest test proves external skill paths and package-local skill are visible.

- [ ] **Step 1: Add failing package-local skill assertions**

Append to `pi/test/package-manifest.test.ts`:

```typescript
test("pi-extension-dev is packaged with valid relative references", () => {
  const skillRoot = resolve(piRoot, "skills/pi-extension-dev");
  const skill = readFileSync(resolve(skillRoot, "SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: pi-extension-dev/m);
  for (const file of ["docs/api-reference.md", "docs/events.md", "docs/pitfalls.md", "docs/verification.md", "examples/namespaced-command.ts"]) {
    assert.equal(existsSync(resolve(skillRoot, file)), true, file);
  }
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test pi/test/package-manifest.test.ts`
Expected: FAIL because `pi/skills/pi-extension-dev` is missing.

- [ ] **Step 3: Copy and normalize the skill**

```bash
mkdir -p pi/skills
cp -R ~/.pi/agent/skills/pi-extension-dev pi/skills/pi-extension-dev
```

Update `SKILL.md` source-of-truth references with this exact transformation:

```bash
python3 - <<'PY'
from pathlib import Path
path = Path("pi/skills/pi-extension-dev/SKILL.md")
text = path.read_text()
text = text.replace("~/.pi/agent/extensions/goal.ts", "Cyberbrain/pi/extensions/goal.ts")
text = text.replace("~/.pi/agent/extensions/slash-framework.ts", "Cyberbrain/pi/extensions/slash-framework.ts")
text = text.replace("~/.pi/agent/slashes/python.md", "Cyberbrain/pi/slashes/python.md")
text = text.replace("~/.pi/agent/lib/goal-core.ts", "Cyberbrain/pi/lib/goal-core.ts")
path.write_text(text)
PY
```

Runtime path `~/.pi/agent/slashes` remains only where the skill documents home overrides.

- [ ] **Step 4: Run and verify GREEN**

```bash
node --test pi/test/package-manifest.test.ts
rg -n "~/.pi/agent/extensions|~/.pi/agent/lib" pi/skills/pi-extension-dev
```

Expected: tests pass; the grep returns only intentionally documented runtime locations, not source-of-truth claims.

- [ ] **Step 5: Commit**

```bash
git add pi/skills/pi-extension-dev pi/test/package-manifest.test.ts
git commit -m "feat(pi): package extension development skill"
```

---

### Task 6: Implement the managed Pi installer

**Files:**
- Create: `tools/manage-pi.sh`
- Create: `tools/manage-pi.py`
- Create: `pi/test/manage-pi.test.sh`

**Interfaces:**
- Public CLI: `install`, `update`, `doctor`, `uninstall`; flags `--dry-run`, `--restore-legacy`, `--pi-home`, `--pi-bin`, `--repo-root`.
- Manifest: `${PI_HOME}/.cyberbrain-pi.manifest.json`.
- Backup root: `${PI_HOME}/backups/cyberbrain-pi/<timestamp>`.
- Python implementation accepts the same CLI; shell wrapper only locates Python and forwards arguments.

- [ ] **Step 1: Write the failing installer integration test**

Create `pi/test/manage-pi.test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PI_HOME="$TMP/home/.pi/agent"
FAKE_LOG="$TMP/pi.log"
mkdir -p "$PI_HOME/extensions" "$PI_HOME/lib" "$PI_HOME/slashes" "$PI_HOME/skills/pi-extension-dev" "$TMP/bin"
printf 'legacy' > "$PI_HOME/extensions/goal.ts"
printf '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$FAKE_PI_LOG"\n' > "$TMP/bin/pi"
chmod +x "$TMP/bin/pi"

run() {
  FAKE_PI_LOG="$FAKE_LOG" bash "$REPO_ROOT/tools/manage-pi.sh" "$@" \
    --pi-home "$PI_HOME" --pi-bin "$TMP/bin/pi" --repo-root "$REPO_ROOT"
}

run install --dry-run
test ! -f "$PI_HOME/.cyberbrain-pi.manifest.json"
test -f "$PI_HOME/extensions/goal.ts"

# Unknown content must block a real install.
if run install 2>"$TMP/conflict.err"; then
  echo "expected unmanaged conflict" >&2
  exit 1
fi
grep -q "unmanaged conflict" "$TMP/conflict.err"

# Known legacy content is migratable.
cp "$REPO_ROOT/pi/extensions/goal.ts" "$PI_HOME/extensions/goal.ts"
run install
test -f "$PI_HOME/.cyberbrain-pi.manifest.json"
test ! -e "$PI_HOME/extensions/goal.ts"
grep -q "install $REPO_ROOT/pi" "$FAKE_LOG"
run doctor
run uninstall
grep -q "remove $REPO_ROOT/pi" "$FAKE_LOG"

echo "manage-pi integration tests passed"
```

- [ ] **Step 2: Run and verify RED**

```bash
chmod +x pi/test/manage-pi.test.sh
bash pi/test/manage-pi.test.sh
```

Expected: FAIL because `tools/manage-pi.sh` is missing.

- [ ] **Step 3: Create the shell wrapper**

Create `tools/manage-pi.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec python3 "$SCRIPT_DIR/manage-pi.py" "$@"
```

- [ ] **Step 4: Implement manage-pi.py**

Create `tools/manage-pi.py` with this complete reference implementation (the Task 1-5 package files must exist first):

```python
#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

MANIFEST_VERSION = 1
LEGACY_MAP = {
    "extensions/aihubmix.ts": "lib/third-party/aihubmix.ts",
    "extensions/codex-slash.ts": "extensions/utility-commands.ts",
    "extensions/goal.ts": "extensions/goal.ts",
    "extensions/slash-framework.ts": "extensions/slash-framework.ts",
    "extensions/web-search.ts": None,
    "lib/goal-core.ts": "lib/goal-core.ts",
    "lib/goal-core.test.ts": "test/goal-core.test.ts",
    "lib/slash-core.ts": "lib/slash-core.ts",
    "lib/slash-core.test.ts": "test/slash-core.test.ts",
    "lib/web-search-core.ts": None,
    "lib/web-search-core.test.ts": None,
    "slashes/python.md": "slashes/python.md",
    "slashes/review.md": "slashes/review.md",
    "skills/pi-extension-dev": "skills/pi-extension-dev",
}
KNOWN_LEGACY_SHA256 = {
    "extensions/aihubmix.ts": "c2f5849af2b3e7fa7489f746e440673d020f04a9d06584c497777ccf57f45ba7",
    "extensions/codex-slash.ts": "8901bc9d0af46652373be9da602761ca7c36f4d87d43cff5479c5931b8dcb025",
    "extensions/goal.ts": "4320157395dea6ec708fe8728043d100b746f9ce53e0c8df15496a95869062ac",
    "extensions/slash-framework.ts": "d55f532e71f29a9db617e594f02e04559e98179eb2d244bba25d0757dbd1a5ef",
    "extensions/web-search.ts": "7c5df87b728ad6f735df56d56d853edfc7cf13aad7f8e6fcbbfa550e53c3b78c",
    "lib/goal-core.ts": "7dc24472ca470fa1d09cdc75b6d21e590fb6611f6de4220e790be27ac2c914b3",
    "lib/goal-core.test.ts": "bb3681a508d7d01de7e3269d2a58dacdb9cfa9eaa3b7594990be03d08ed44b46",
    "lib/slash-core.ts": "b774f0094090f1e134bd3a5d002a15efdc673f7d5a392d4dcb6430f1e679b540",
    "lib/slash-core.test.ts": "f4b1e2842b677dde0c551d0c1417c3ce73c974a02e65bd26d27424e047863f81",
    "lib/web-search-core.ts": "816029a2bdc70b8337402097985a84a5333ee5760a7755370f7dd98da5dba18f",
    "lib/web-search-core.test.ts": "6b80647ad0ba2e0f1abf29d4d7fee695d2d61f197be98ea88313ecc9e7a6917e",
    "slashes/python.md": "270f63e0613ad51f19172df5ad8eb7840c05af1373e2f5ba4dac2e4154fcfcf0",
    "slashes/review.md": "a6c90e9e20ee369d4a42c2e0730ed2812cc890ee26437a2e363f3c6ce0316112",
    "skills/pi-extension-dev/SKILL.md": "c6f47a741e0f941b6795ece214119a31d9f5fe062c2eb10fec163781cd33eb1e",
    "skills/pi-extension-dev/docs/api-reference.md": "2d5b6b24df916ec52738a4752551c612d24832dfad152041afd99378c1ce251d",
    "skills/pi-extension-dev/docs/events.md": "4636318869ac9a873e19cf5dbaf70270645b8017ea3519e35b24f756a2459e0d",
    "skills/pi-extension-dev/docs/pitfalls.md": "439e5b75df482513ee323c03bd3abab6dddb8f35772722938860666fa2b7e693",
    "skills/pi-extension-dev/docs/verification.md": "57f436656aa0c81104346ac0af7b11c71209cb4bf491a6fb6df3a56d272547ed",
    "skills/pi-extension-dev/examples/namespaced-command.ts": "52701e1a1e48174050334302218a43f449f6fe708ddae290c122fe391ccf6686",
}


def fail(message: str) -> None:
    raise SystemExit(f"Error: {message}")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative_files(path: Path) -> list[Path]:
    if path.is_file() or path.is_symlink():
        return [Path(path.name)]
    return sorted(item.relative_to(path) for item in path.rglob("*") if item.is_file())


def load_manifest(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        fail(f"invalid installer manifest {path}: {error}")
    if not isinstance(value, dict) or value.get("version") != MANIFEST_VERSION:
        fail(f"unsupported installer manifest: {path}")
    return value


def package_source(repo_root: Path) -> str:
    return str((repo_root / "pi").resolve())


def package_target(package_root: Path, legacy_relative: str, nested: Path | None = None) -> Path | None:
    mapped = LEGACY_MAP[legacy_relative]
    if mapped is None:
        return None
    base = package_root / mapped
    return base / nested if nested is not None and base.is_dir() else base


def recognized_file(
    pi_home: Path,
    package_root: Path,
    legacy_root: str,
    nested: Path,
    previous_hashes: dict[str, str],
) -> bool:
    source = pi_home / legacy_root
    source_file = source if source.is_file() or source.is_symlink() else source / nested
    key = str(Path(legacy_root) / nested) if source.is_dir() else legacy_root
    digest = sha256_file(source_file)
    target = package_target(package_root, legacy_root, nested if source.is_dir() else None)
    if target is not None and target.is_file() and source_file.read_bytes() == target.read_bytes():
        return True
    return digest in {KNOWN_LEGACY_SHA256.get(key), previous_hashes.get(key)}


def planned_legacy_migrations(pi_home: Path, repo_root: Path, manifest: dict | None) -> list[dict]:
    package_root = repo_root / "pi"
    previous_hashes = (manifest or {}).get("legacy_hashes", {})
    planned: list[dict] = []
    conflicts: list[str] = []
    for relative in LEGACY_MAP:
        source = pi_home / relative
        if not source.exists() and not source.is_symlink():
            continue
        nested_files = relative_files(source)
        if all(recognized_file(pi_home, package_root, relative, nested, previous_hashes) for nested in nested_files):
            hashes = {}
            for nested in nested_files:
                source_file = source if source.is_file() or source.is_symlink() else source / nested
                key = str(Path(relative) / nested) if source.is_dir() else relative
                hashes[key] = sha256_file(source_file)
            planned.append({"relative": relative, "hashes": hashes})
        else:
            conflicts.append(str(source))
    if conflicts:
        fail("unmanaged conflict: " + ", ".join(conflicts))
    return planned


def atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    os.close(fd)
    temporary_path = Path(temporary)
    try:
        temporary_path.write_text(json.dumps(value, indent=2) + "\n")
        os.chmod(temporary_path, 0o600)
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)


def run_pi(pi_bin: str, args: list[str], dry_run: bool) -> None:
    print("PI " + " ".join(args))
    if dry_run:
        return
    subprocess.run([pi_bin, *args], check=True)


def backup_and_remove(pi_home: Path, backup_root: Path, planned: list[dict], dry_run: bool) -> None:
    for item in planned:
        source = pi_home / item["relative"]
        target = backup_root / item["relative"]
        print(f"BACKUP {source} -> {target}")
        print(f"REMOVE {source}")
        if dry_run:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.is_dir() and not source.is_symlink():
            shutil.copytree(source, target)
            shutil.rmtree(source)
        else:
            shutil.copy2(source, target, follow_symlinks=False)
            source.unlink()


def settings_contains_source(pi_home: Path, source: str) -> bool:
    path = pi_home / "settings.json"
    if not path.exists():
        return False
    try:
        packages = json.loads(path.read_text()).get("packages", [])
    except (OSError, json.JSONDecodeError):
        return False
    values = [item if isinstance(item, str) else item.get("source") for item in packages]
    return source in values


def install(args: argparse.Namespace) -> None:
    repo_root = Path(args.repo_root).resolve()
    pi_home = Path(args.pi_home).expanduser().resolve()
    source = package_source(repo_root)
    manifest_path = pi_home / ".cyberbrain-pi.manifest.json"
    old_manifest = load_manifest(manifest_path)
    planned = planned_legacy_migrations(pi_home, repo_root, old_manifest)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_root = pi_home / "backups" / "cyberbrain-pi" / timestamp
    backup_and_remove(pi_home, backup_root, planned, args.dry_run)
    run_pi(args.pi_bin, ["install", source], args.dry_run)
    if args.dry_run:
        return
    legacy_hashes = dict((old_manifest or {}).get("legacy_hashes", {}))
    for item in planned:
        legacy_hashes.update(item["hashes"])
    atomic_json(manifest_path, {
        "version": MANIFEST_VERSION,
        "source": source,
        "installed_at": datetime.now(timezone.utc).isoformat(),
        "backup_dir": str(backup_root) if planned else None,
        "migrated": [item["relative"] for item in planned],
        "legacy_hashes": legacy_hashes,
    })


def update(args: argparse.Namespace) -> None:
    repo_root = Path(args.repo_root).resolve()
    pi_home = Path(args.pi_home).expanduser().resolve()
    source = package_source(repo_root)
    manifest = load_manifest(pi_home / ".cyberbrain-pi.manifest.json")
    if not manifest or manifest.get("source") != source:
        fail("installer manifest source does not match this Cyberbrain clone")
    planned = planned_legacy_migrations(pi_home, repo_root, manifest)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_root = pi_home / "backups" / "cyberbrain-pi" / timestamp
    backup_and_remove(pi_home, backup_root, planned, args.dry_run)
    if args.dry_run:
        run_pi(args.pi_bin, ["update", "--extension", source], True)
        return
    try:
        run_pi(args.pi_bin, ["update", "--extension", source], False)
    except subprocess.CalledProcessError:
        run_pi(args.pi_bin, ["install", source], False)
    if planned:
        manifest["backup_dir"] = str(backup_root)
        manifest["migrated"] = sorted(set(manifest.get("migrated", [])) | {item["relative"] for item in planned})
        for item in planned:
            manifest.setdefault("legacy_hashes", {}).update(item["hashes"])
    manifest["updated_at"] = datetime.now(timezone.utc).isoformat()
    atomic_json(pi_home / ".cyberbrain-pi.manifest.json", manifest)


def doctor(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo_root).resolve()
    pi_home = Path(args.pi_home).expanduser().resolve()
    source = package_source(repo_root)
    manifest = load_manifest(pi_home / ".cyberbrain-pi.manifest.json")
    issues: list[str] = []
    if not manifest:
        issues.append("installer manifest missing")
    elif manifest.get("source") != source:
        issues.append("installer manifest points to a different Cyberbrain clone")
    if not settings_contains_source(pi_home, source):
        issues.append("cyberbrain-pi local package is not registered in settings.json")
    for relative in LEGACY_MAP:
        path = pi_home / relative
        if path.exists() or path.is_symlink():
            if relative.startswith("slashes/"):
                print(f"OVERRIDE {path}")
            else:
                issues.append(f"legacy resource still present: {path}")
    for variable in ("AIHUBMIX_API_KEY", "DEEPSEEK_API_KEY"):
        if not os.environ.get(variable):
            issues.append(f"environment variable is not set: {variable}")
    commands = [
        ["node", "--test", *sorted(str(path) for path in (repo_root / "pi/test").glob("*.test.ts"))],
    ]
    commands.extend([["node", "--check", str(path)] for path in sorted((repo_root / "pi").glob("extensions/*.ts"))])
    commands.extend([["node", "--check", str(path)] for path in sorted((repo_root / "pi").glob("lib/**/*.ts"))])
    for command in commands:
        result = subprocess.run(command)
        if result.returncode != 0:
            issues.append("verification failed: " + " ".join(command))
    for issue in issues:
        print(f"Warning: {issue}", file=sys.stderr)
    if issues:
        print(f"Doctor found {len(issues)} issue(s)", file=sys.stderr)
        return 1
    print(f"Doctor OK: cyberbrain-pi is installed from {source}")
    return 0


def uninstall(args: argparse.Namespace) -> None:
    repo_root = Path(args.repo_root).resolve()
    pi_home = Path(args.pi_home).expanduser().resolve()
    source = package_source(repo_root)
    manifest_path = pi_home / ".cyberbrain-pi.manifest.json"
    manifest = load_manifest(manifest_path)
    run_pi(args.pi_bin, ["remove", source], args.dry_run)
    if args.restore_legacy and manifest and manifest.get("backup_dir"):
        backup_root = Path(manifest["backup_dir"])
        for relative in manifest.get("migrated", []):
            source_path = backup_root / relative
            target_path = pi_home / relative
            if not source_path.exists() and not source_path.is_symlink():
                continue
            if target_path.exists() or target_path.is_symlink():
                fail(f"restore conflict: {target_path}")
            print(f"RESTORE {source_path} -> {target_path}")
            if args.dry_run:
                continue
            target_path.parent.mkdir(parents=True, exist_ok=True)
            if source_path.is_dir() and not source_path.is_symlink():
                shutil.copytree(source_path, target_path)
            else:
                shutil.copy2(source_path, target_path, follow_symlinks=False)
    if not args.dry_run:
        manifest_path.unlink(missing_ok=True)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser()
    result.add_argument("command", choices=("install", "update", "doctor", "uninstall"))
    result.add_argument("--dry-run", action="store_true")
    result.add_argument("--restore-legacy", action="store_true")
    result.add_argument("--pi-home", default=str(Path.home() / ".pi/agent"))
    result.add_argument("--pi-bin", default="pi")
    result.add_argument("--repo-root", default=str(Path(__file__).resolve().parents[1]))
    return result


def main() -> int:
    args = parser().parse_args()
    if args.command == "install":
        install(args)
        return 0
    if args.command == "update":
        update(args)
        return 0
    if args.command == "doctor":
        return doctor(args)
    uninstall(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 5: Run installer test and verify GREEN**

```bash
bash pi/test/manage-pi.test.sh
python3 -m py_compile tools/manage-pi.py
bash -n tools/manage-pi.sh pi/test/manage-pi.test.sh
```

Expected: all pass.

- [ ] **Step 6: Add explicit restore and idempotency cases**

Extend `manage-pi.test.sh`:

```bash
run install
run install
run doctor
run uninstall --restore-legacy
test -e "$PI_HOME/extensions/goal.ts"
```

Run again; expected pass.

- [ ] **Step 7: Commit**

```bash
git add tools/manage-pi.sh tools/manage-pi.py pi/test/manage-pi.test.sh
git commit -m "feat(pi): add managed install and migration lifecycle"
```

---

### Task 7: Update repository identity and host-boundary documentation

**Files:**
- Modify/add: `README.md`
- Add current local file, revised: `AGENTS.md`
- Add current local file, revised: `CODEX_PLUGIN_SYSTEM.md`
- Create: `PI_SUPPORT.md`

**Interfaces:**
- Root docs define Cyberbrain as a personal multi-host agent configuration repository.
- Codex-specific constraints remain scoped to Codex files/plugins.
- Pi documentation points to `tools/manage-pi.sh` and never instructs copying resources manually.

- [ ] **Step 1: Add a failing documentation boundary check**

Create `pi/test/docs-boundary.test.ts`:

```typescript
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("root docs describe both Codex and Pi adapters", () => {
  const readme = read("README.md");
  const agents = read("AGENTS.md");
  assert.match(readme, /Codex Installation/);
  assert.match(readme, /Pi Installation/);
  assert.match(agents, /host adapter/i);
  assert.doesNotMatch(agents, /CyberBrain is a Codex-only plugin marketplace/);
});

test("host-specific docs remain scoped", () => {
  assert.match(read("CODEX_PLUGIN_SYSTEM.md"), /Codex adapter/);
  assert.match(read("PI_SUPPORT.md"), /cyberbrain-pi/);
  assert.match(read("PI_SUPPORT.md"), /manage-pi\.sh doctor/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test pi/test/docs-boundary.test.ts`
Expected: FAIL because the root still says Codex-only and PI_SUPPORT.md is missing.

- [ ] **Step 3: Update README.md**

Replace the opening sentence with:

```markdown
CyberBrain is a personal agent configuration repository with first-class host adapters for OpenAI Codex and Pi. Shared skills remain single-source; each host keeps its native package, extension, and installer mechanisms.
```

Add a `## Pi Installation` section containing:

```bash
git clone https://github.com/ansatzX/CyberBrain.git ~/soft/CyberBrain
cd ~/soft/CyberBrain
bash tools/manage-pi.sh install
bash tools/manage-pi.sh doctor
```

Link `PI_SUPPORT.md`. Preserve all Codex installation/plugin sections.

- [ ] **Step 4: Revise AGENTS.md host boundaries**

Preserve existing Codex packaging rules but replace the Codex-only root identity with:

```markdown
## Repository Role
CyberBrain is a personal multi-host agent configuration repository. Codex and Pi are independent host adapters. Shared skills live under plugins/*/skills; host-specific packaging and runtime code must stay inside its adapter boundary.

## Host Boundaries
- Codex: .agents/plugins, plugins/*/.codex-plugin, Codex agent TOMLs/installers, ~/.codex examples.
- Pi: pi/package.json, pi/extensions, pi/lib, pi/slashes, tools/manage-pi.sh, ~/.pi/agent examples.
- Do not make one host adapter emulate the other's runtime APIs.
```

Move the existing Codex-only prohibitions under a `## Codex Adapter Rules` heading instead of deleting them.

- [ ] **Step 5: Scope CODEX_PLUGIN_SYSTEM.md and create PI_SUPPORT.md**

Add immediately below the Codex document title:

```markdown
> Scope: this document describes only the Cyberbrain Codex adapter. Pi packaging and lifecycle are documented in PI_SUPPORT.md.
```

Create `PI_SUPPORT.md` with sections:

```markdown
# Cyberbrain Pi Support
## Architecture
## Requirements
## Install
## Update
## Doctor
## Uninstall
## Providers and environment variables
## Slash defaults and home overrides
## Shared skills
## Development and tests
## Windows limitation
```

Document `AIHUBMIX_API_KEY`, `DEEPSEEK_API_KEY`, `AIHUBMIX_CACHE_MAX_AGE_MS`, and `CYBERBRAIN_DEEPSEEK_WEB_SEARCH=0` without example secret values.

- [ ] **Step 6: Run and verify GREEN**

```bash
node --test pi/test/docs-boundary.test.ts
rg -n "CyberBrain is a Codex-only plugin marketplace" README.md AGENTS.md
```

Expected: tests pass; grep finds no root identity claim.

- [ ] **Step 7: Commit**

```bash
git add README.md AGENTS.md CODEX_PLUGIN_SYSTEM.md PI_SUPPORT.md pi/test/docs-boundary.test.ts
git commit -m "docs: define Cyberbrain Codex and Pi host adapters"
```

---

### Task 8: End-to-end migration and local-package smoke

**Files:**
- Modify only if failures reveal bugs: files from Tasks 1–7
- Runtime test data: temporary HOME and the real `~/.pi/agent` migration after all isolated tests pass

**Interfaces:**
- Exercises the public installer, package loader, command registration, shared skill discovery, providers, and safe uninstall.

- [ ] **Step 1: Run the complete isolated suite**

```bash
cd /Users/ansatz/data/code/Cyberbrain
node --test pi/test/*.test.ts
bash pi/test/manage-pi.test.sh
for file in pi/extensions/*.ts pi/lib/*.ts pi/lib/third-party/*.ts; do node --check "$file"; done
bash -n tools/manage-pi.sh pi/test/manage-pi.test.sh
python3 -m py_compile tools/manage-pi.py
jq -e . pi/package.json .agents/plugins/marketplace.json plugins/*/.codex-plugin/plugin.json
bash -n plugins/awesome-agent-select/tools/manage-codex-agents.sh
```

Expected: all commands exit 0.

- [ ] **Step 2: Run Codex boundary regression checks**

```bash
rg -n "\.claude-plugin|CLAUDE_PLUGIN_ROOT|CLAUDE_PLUGIN_DATA|AskUserQuestion|~/.claude" README.md AGENTS.md CODEX_PLUGIN_SYSTEM.md plugins .agents -S
```

Expected: no newly introduced unsupported Codex paths; any existing allowed historical reference must be reviewed explicitly.

- [ ] **Step 3: Run installer dry-run against the real home**

```bash
bash tools/manage-pi.sh install --dry-run
```

Expected: lists only approved Cyberbrain legacy files, leaves Superpowers/Lark/auth/settings/models/sessions/cache/goals untouched, and plans `pi install <repo>/pi`.

- [ ] **Step 4: Review dry-run output with the user before destructive migration**

Stop and present the exact BACKUP/REMOVE/PI actions. Do not continue until the user approves the migration list.

- [ ] **Step 5: Perform the real migration**

```bash
bash tools/manage-pi.sh install
bash tools/manage-pi.sh doctor
```

Expected: manifest written, backup created, old Cyberbrain extensions/lib/default slashes/skill removed, local package registered, doctor returns 0.

- [ ] **Step 6: Verify Pi runtime behavior**

Start a fresh pi session, then run:

```text
/ansatz:mode
/ansatz:status
/ansatz:review HEAD~1
/ansatz:goal set smoke goal
/ansatz:goal pause
/ansatz:goal resume
/ansatz:goal clear smoke complete
```

Verify:

- no command has `:1`/`:2` suffix;
- review exits after one agent run;
- Python mode remains session-scoped;
- all shared Cyberbrain skills appear in skill discovery;
- providers `aihubmix` and `deepseek-responses` exist;
- DeepSeek web search is injected by default and disabled by `CYBERBRAIN_DEEPSEEK_WEB_SEARCH=0` in a separate session.

- [ ] **Step 7: Verify uninstall against a temporary HOME, not the real machine**

The isolated installer suite already proves uninstall/restore behavior. Do not uninstall the real active configuration unless the user explicitly requests it.

- [ ] **Step 8: Commit any final integration fixes**

```bash
git add pi tools README.md AGENTS.md CODEX_PLUGIN_SYSTEM.md PI_SUPPORT.md
git commit -m "test(pi): verify Cyberbrain package migration end to end"
```

Skip the commit if no files changed after Step 5.

---

## Self-Review

### Spec coverage

- Single `cyberbrain-pi` package: Task 1.
- Existing skills shared without copying: Task 1 package manifest and test.
- Goal/utility migration: Task 2.
- Package slash + home override + scope: Task 3.
- AIHubMix + DeepSeek + default web search in one extension: Task 4.
- pi-extension-dev ownership: Task 5.
- install/update/doctor/uninstall/dry-run/backups/manifest: Task 6.
- Root multi-host identity and host-specific docs: Task 7.
- Real legacy migration and no-duplicate smoke: Task 8.
- Settings/models/auth/runtime data excluded: Global Constraints, Task 6, Task 8.
- Windows boundary: Global Constraints and Task 7.

### Placeholder scan

No TBD/TODO/"implement later" placeholders. Every task defines concrete files, commands, interfaces, expected failure, and passing verification.

### Type/interface consistency

- `goal.ts` and utility commands import `getSessionThreadId` from `goal-core.ts`.
- Slash framework imports `loadSlashDefinitions`, `mergeSlashDefinitions`, `buildSlashMessage`, and `shouldPersistMode` from `slash-core.ts`.
- `third-party-all-in-one.ts` imports the exact two provider modules defined in Task 4.
- Installer source is always the absolute `repo/pi` path used by install/update/doctor/uninstall.
- Shared skill manifest paths are relative to `pi/package.json` and depend on the approved complete-clone installation mode.
