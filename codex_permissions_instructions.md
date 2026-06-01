# Codex Sandbox Permissions

> How Codex filesystem sandboxing and writable roots work, how to configure them, and how to let `uv` write to `~/.cache/uv` without escalation.

## Sandbox Architecture

Codex runs commands in a sandbox. The sandbox mode is configured via `config.toml`:

```
sandbox_mode = "workspace_write"   # default
```

Three modes exist (defined in [shared.rs](/Users/ansatz/data/code/codex/codex-rs/app-server-protocol/src/protocol/v2/shared.rs:292)):

| Mode | Read | Write | Network |
|---|---|---|---|
| `read_only` | Everywhere | Nowhere | Configurable |
| `workspace_write` | Everywhere | cwd + writable_roots + tmp | Configurable |
| `danger_full_access` | Everywhere | Everywhere | Full |

The current default is `workspace_write`.

## Writable Roots in `workspace_write` Mode

In `workspace_write` mode, writes are permitted to:

1. **`cwd`** — the current working directory (always writable)
2. **`writable_roots`** — user-configured additional paths (from `config.toml`)
3. **`$TMPDIR`** — macOS: `/private/var/folders/.../T/`; included by default
4. **`/tmp`** — included by default (macOS: symlink to `/private/tmp`)
5. **`~/.codex/memories`** — internal Codex memory directory (always writable)

Writes to any other path require escalation (`sandbox_permissions="require_escalated"`).

## Configuration: `sandbox_workspace_write`

The `[sandbox_workspace_write]` section in `~/.codex/config.toml` controls writable roots:

```toml
sandbox_mode = "workspace_write"

[sandbox_workspace_write]
writable_roots = ["/Users/ansatz/.cache/uv"]
network_access = false
exclude_tmpdir_env_var = false
exclude_slash_tmp = false
```

| Field | Type | Default | Description |
|---|---|---|---|
| `writable_roots` | `Vec<PathBuf>` | `[]` | Additional directories to allow writes |
| `network_access` | `bool` | `false` | Allow unrestricted network access |
| `exclude_tmpdir_env_var` | `bool` | `false` | Exclude `$TMPDIR` from writable roots |
| `exclude_slash_tmp` | `bool` | `false` | Exclude `/tmp` from writable roots |

Source: [config.rs:118-127](/Users/ansatz/data/code/codex/codex-rs/app-server-protocol/src/protocol/v2/config.rs:118)

## Why `~/.cache/uv` Is Blocked

`uv` uses `~/.cache/uv` as its package cache directory. Since `~/.cache/uv` is not in the writable roots, any `uv pip install` or `uv run` that needs to populate the cache will fail sandbox checks and require escalation.

This is why the config has many approved `prefix_rule` entries with `UV_CACHE_DIR=./.cache/uv` — each project created its own local `.cache/uv` inside the cwd to work around the sandbox:

```
UV_CACHE_DIR=./.cache/uv uv pip install -e .
```

## The Fix: Add `~/.cache/uv` to Writable Roots

Add to `~/.codex/config.toml`:

```toml
[sandbox_workspace_write]
writable_roots = ["/Users/ansatz/.cache/uv"]
```

After this change, `uv` can write to `~/.cache/uv` without sandbox escalation. The `UV_CACHE_DIR=./.cache/uv` workaround is no longer needed.

### What Gets Easier

Before (without writable root):
```
exec_command(cmd="uv pip install pytest", sandbox_permissions="require_escalated",
    justification="Do you want to allow `uv pip install`?",
    prefix_rule=["uv", "pip", "install"])
```

After (with writable root):
```
exec_command(cmd="uv pip install pytest")   # runs directly, no escalation
```

## Relationship with `prefix_rule`

Writable roots and `prefix_rule` serve different purposes:

| Mechanism | Controls | Scope |
|---|---|---|
| `writable_roots` | Which directories can be **written to** | Filesystem sandbox |
| `prefix_rule` | Which **commands** can run outside sandbox | Command execution |

They are complementary. A `prefix_rule` like `["uv", "pip", "install"]` allows the command to run, but it still runs inside the sandbox — writes outside writable roots still fail. Adding the directory to `writable_roots` removes the filesystem restriction; combined with a `prefix_rule`, the command runs cleanly.

## Escalation Flow

When a command tries to write outside writable roots:

1. Sandbox blocks the write
2. Codex asks the agent to escalate
3. Agent calls `exec_command` with `sandbox_permissions="require_escalated"`
4. Agent provides `prefix_rule` and `justification`
5. User approves → command runs outside sandbox → rule persists

If the directory is in `writable_roots`, step 1 never triggers — the write succeeds inside the sandbox.

## Current Writable Roots (This Session)

From the system prompt's `<permissions instructions>` block:

```
/Users/ansatz/data/code/Cyberbrain                  ← cwd
/private/tmp                                         ← /tmp (macOS)
/private/var/folders/.../T                           ← $TMPDIR
/Users/ansatz/.codex/memories                        ← Codex internal
```

`~/.cache/uv` is **not** in this list — hence the sandbox blocks it.

## Recommended Config

```toml
# ~/.codex/config.toml

sandbox_mode = "workspace_write"

[sandbox_workspace_write]
writable_roots = [
    "/Users/ansatz/.cache/uv",
]
network_access = false
exclude_tmpdir_env_var = false
exclude_slash_tmp = false
```

This keeps the default `workspace_write` policy while adding `uv`'s cache directory as writable.

## Checking Effective Writable Roots

The effective writable roots are shown in the `<permissions instructions>` block at the top of every Codex session. After changing `config.toml`, restart Codex to see the updated list.
