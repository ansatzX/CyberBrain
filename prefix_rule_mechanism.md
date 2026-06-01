# `prefix_rule` Mechanism in `exec_command`

> How Codex agents should use `prefix_rule` when escalating sandbox permissions.

## What `prefix_rule` Is

When `exec_command` needs to run outside the sandbox (`sandbox_permissions="require_escalated"`), the agent provides a `prefix_rule` — an array of strings that forms a reusable command prefix. The user approves this prefix once, and all future commands starting with that prefix run without further escalation.

```
exec_command(
    cmd="uv run pytest tests/ -q",
    sandbox_permissions="require_escalated",
    justification="Do you want to allow `uv run pytest` in this project?",
    prefix_rule=["uv", "run", "pytest"]   # ← THE REUSABLE PREFIX
)
```

After approval, any command starting with `uv run pytest` (e.g., `uv run pytest tests/ -x`, `uv run pytest --cov`) runs without further escalation.

## Core Principle

**`prefix_rule` captures the reusable command pattern — not specific arguments.**

This is the single most important rule. The prefix should be general enough to be useful across related commands, but narrow enough to be safe.

## Shell Segmentation

Commands are split at shell control operators (`&&`, `||`, `;`, `|`, subshells) into independent segments. Each segment is evaluated separately against approved prefix rules.

```
Command:  cd /project && uv run pytest -q && echo "done"
Segments: ["cd /project", "uv run pytest -q", "echo done"]
```

If `["uv", "run"]` is approved, segment 2 matches. Segments 1 and 3 may need separate approval or may already be sandbox-safe.

## Rules of Thumb

### 1. Strip specific arguments — keep the tool prefix

| Full Command | prefix_rule |
|---|---|
| `uv run pytest tests/agent/test_factory.py -q` | `["uv", "run", "pytest"]` |
| `uv run python my_script.py --flag value` | `["uv", "run", "python"]` |
| `git push origin feature-branch` | `["git", "push"]` |
| `npm run dev --port 3000` | `["npm", "run", "dev"]` |
| `cargo test --lib -- --nocapture` | `["cargo", "test"]` |

### 2. For project-scoped operations, anchor to the project directory

When a command is tightly coupled to a specific project (running tests, dev servers, project scripts), include enough path context to be safe:

```
cd /Users/ansatz/data/code/AIE_Brainiac && uv run pytest -q
→ prefix_rule: ["uv", "run", "pytest"]
→ justification: "Do you want to allow `uv run pytest` in AIE_Brainiac?"
```

But if the command *itself* changes directory via the shell, the `cd` part is a separate segment. The `prefix_rule` applies to the segment that needs escalation — typically the `uv run ...` part.

### 3. For `uv run` specifically

`uv run` is the most common escalation pattern in scientific Python projects. The approved prefix rules accumulate organically:

```
# First time running tests:
["uv", "run", "pytest"]

# Later, running a script:
["uv", "run", "python"]

# Even later, running ruff:
["uv", "run", "ruff"]
```

Alternatively, a broader `["uv", "run"]` prefix covers all of these at once. Which to choose depends on the user's security posture.

### 4. Multi-segment commands: extract the pattern

For `cd /project && uv run pytest -q`, shell splitting produces two segments:
- `cd /project` (likely sandbox-safe)
- `uv run pytest -q` (needs escalation)

The prefix_rule goes on the segment that needs escalation: `["uv", "run", "pytest"]`.

### 5. Never include heredocs, herestrings, or shell redirections

The `prefix_rule` banned list includes heredocs and herestrings. Also avoid redirections (`>`, `>>`, `<`, `2>&1`) and pipes (`|`) in prefix_rules — these are evaluated differently by the shell splitter.

**Bad:**
```
["/opt/homebrew/bin/bash", "-lc", "uv run pytest 2>&1 | tail -30"]
```

**Good:** Prefer simpler prefixes and let shell redirections be handled at the command level, not the rule level.

## `justification` vs `prefix_rule`

- **`justification`**: Human-readable question shown to the user. Describes *what* the command does and *why* it needs escalation.
- **`prefix_rule`**: Machine-readable array for pattern matching. Defines *which future commands* will be allowed.

The two should be consistent. The justification should describe the pattern the prefix_rule captures:

```
justification: "Do you want to allow `uv run pytest` in this project?"
prefix_rule: ["uv", "run", "pytest"]
```

```
justification: "Do you want to allow `uv run` commands?"
prefix_rule: ["uv", "run"]
```

## Practical Workflow

1. Agent encounters a command that fails sandboxing
2. Agent re-runs with `sandbox_permissions="require_escalated"`
3. Agent selects a `prefix_rule` that captures the reusable pattern
4. Agent writes a `justification` describing what's being allowed
5. User approves → rule persists for future commands
6. Agent optionally suggests a `prefix_rule` that could be broader if the user runs similar commands

## Common Patterns

| Domain | Commands | Suggested prefix_rule |
|---|---|---|
| Python testing | `uv run pytest ...` | `["uv", "run", "pytest"]` |
| Python scripts | `uv run python script.py` | `["uv", "run", "python"]` |
| Python linting | `uv run ruff check ...` | `["uv", "run", "ruff"]` |
| Git operations | `git push ...` | `["git", "push"]` |
| Dev servers | `npm run dev` | `["npm", "run", "dev"]` |
| Build tools | `cargo build`, `cargo test` | `["cargo", "build"]` or `["cargo", "test"]` |
| Package install | `uv pip install ...` | `["uv", "pip", "install"]` |
| SSH access | `ssh user@host` | `["ssh"]` |

## Banned Prefix Rules

Never propose these as prefix_rules:
- `["python3"]` or `["python"]` — too broad, allows arbitrary scripting
- Any prefix containing heredocs (`<<`) or herestrings (`<<<`)
- Destructive commands: `rm`, `rmdir`, `git reset --hard` (unless user explicitly asks)

## Accumulation

Prefix rules accumulate over time. The system prompt shows an "Approved command prefixes" section listing all previously approved rules. Check this list before proposing a new prefix — the user may have already approved a matching rule.

This also means you should **not propose overly broad prefixes** initially. Start narrow (`["uv", "run", "pytest"]`) and let the user broaden organically (`["uv", "run"]`) as their workflow demands.
