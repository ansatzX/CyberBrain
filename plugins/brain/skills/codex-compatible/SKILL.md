---
name: codex-compatible
description: "Use when the task involves `exec_command` escalation, `prefix_rule`, sandbox permissions, writable roots, or Codex platform-specific operational patterns."
---

# Codex Compatible

> Operational knowledge for working within Codex's sandbox and permission model.

This skill covers Codex platform patterns that are not domain-specific but are essential for correct agent behavior: `exec_command` escalation, `prefix_rule` selection, sandbox writable roots, and tool cache directories.

## `exec_command` `prefix_rule` Escalation

When `exec_command` fails sandboxing and requires escalation (`sandbox_permissions="require_escalated"`), provide a `prefix_rule` that captures the reusable command pattern — **not** the full command with specific arguments. See [prefix_rule_mechanism.md](/Users/ansatz/data/code/Cyberbrain/prefix_rule_mechanism.md) for the full reference.

**Core rule: strip specific arguments, keep the tool prefix.**

| Full Command | Correct prefix_rule | Wrong prefix_rule |
|---|---|---|
| `uv run pytest tests/test_x.py -q` | `["uv", "run", "pytest"]` | `["uv", "run", "pytest", "tests/test_x.py", "-q"]` |
| `uv run python script.py --flag` | `["uv", "run", "python"]` | `["uv", "run", "python", "script.py", "--flag"]` |
| `git push origin main` | `["git", "push"]` | `["git", "push", "origin", "main"]` |

**Shell segmentation:** Commands split at `&&`, `||`, `;`, `|` into independent segments. The `prefix_rule` applies to the segment that needs escalation:

```
cd /project && uv run pytest -q
→ segments: ["cd /project", "uv run pytest -q"]
→ prefix_rule: ["uv", "run", "pytest"]   # only the escalatable segment
```

**`justification` mirrors `prefix_rule`:**

```
justification: "Do you want to allow `uv run pytest` in this project?"
prefix_rule: ["uv", "run", "pytest"]
```

**Approved rules accumulate.** Check the "Approved command prefixes" section in the system prompt before proposing a new prefix. Start narrow and broaden organically.

**Banned patterns:**
- `["python3"]` / `["python"]` — too broad
- Heredocs (`<<`), herestrings (`<<<`)
- Destructive commands (`rm`, `rmdir`) unless the user explicitly asks

**Checklist before calling exec_command with escalation:**

1. [ ] Is the command failing due to sandboxing (network, filesystem)?
2. [ ] Is there an existing approved prefix rule that already covers it?
3. [ ] Does the `prefix_rule` capture the reusable tool prefix, not specific arguments?
4. [ ] Is the `justification` a clear question describing what will be allowed?
5. [ ] Is the `prefix_rule` free of heredocs, herestrings, and destructive commands?

## Sandbox Writable Roots

See [codex_permissions_instructions.md](/Users/ansatz/data/code/Cyberbrain/codex_permissions_instructions.md) for the full reference.

Codex sandbox uses `workspace_write` mode by default. Writes are only permitted to:

| Source | Path | Controllable? |
|---|---|---|
| cwd | Current working directory | Automatic |
| writable_roots | From `~/.codex/config.toml` | Yes |
| $TMPDIR | OS temp directory | Can exclude via `exclude_tmpdir_env_var` |
| /tmp | `/tmp` | Can exclude via `exclude_slash_tmp` |
| Memories | `~/.codex/memories` | Always writable |

### Tool Cache Directories

Many tools write to cache or data directories outside cwd (e.g., `~/.cache/uv`, `~/.cargo`, `~/.npm`). These are blocked by the sandbox and cause repeated escalations.

**Pattern:** identify the tool's cache directory → add it to `writable_roots`:

```toml
# ~/.codex/config.toml
[sandbox_workspace_write]
writable_roots = ["/Users/ansatz/.cache/uv"]
```

After this, writes to that directory succeed inside the sandbox without escalation. The per-project `CACHE_DIR=./.cache/...` workaround is no longer needed.

**Common tool cache paths:**

| Tool | Typical cache dir |
|---|---|
| `uv` | `~/.cache/uv` |
| `pip` | `~/Library/Caches/pip` (macOS) |
| `cargo` | `~/.cargo` |
| `npm` | `~/.npm` |
| `conda` | `~/miniconda3/pkgs` |

### writable_roots vs prefix_rule

| Mechanism | Controls | Scope |
|---|---|---|
| `writable_roots` | Which directories can be written to | Filesystem sandbox |
| `prefix_rule` | Which commands run without approval | Command execution |

They are complementary. Adding a directory to `writable_roots` removes the filesystem restriction; a `prefix_rule` removes the command-approval gate.
