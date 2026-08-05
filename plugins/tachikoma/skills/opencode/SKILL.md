---
name: opencode
description: Use when the user asks to run OpenCode CLI non-interactively (`opencode run`) for analysis, review, or authorized workspace work.
---

# OpenCode CLI

Before invoking OpenCode, follow `../_shared/agent-cli.md`.

## Verify the installed interface

```text
opencode --version
opencode run --help
opencode agent list            # only when selecting an agent
```

`--agent` selects a locally configured agent; its name does not prove read-only or write permission behavior. Do not treat `plan` or `build` as built-in security modes unless the current local agent definition establishes that contract.

## Model and permission selection

Omit `--model`, `--variant`, and `--agent` by default. Preserve configured choices unless the user explicitly requests supported values.

The current `opencode run` interface exposes `--auto` for automatic approval of permissions. It is dangerous and requires explicit approval. If the current installation provides no verified read-only agent or permission mode, say that non-interactive analysis cannot be guaranteed read-only.

## Command patterns

```bash
# Non-interactive run; permission behavior must be established first
opencode run "<prompt>"

# Structured event output
opencode run --format json "<prompt>"

# Continue the latest session
opencode run --continue "<follow-up prompt>"

# User-authorized automatic permission approval
opencode run --auto "<prompt>"
```

Use `--dir` only for an explicitly selected target directory. Use `--session <id>` only for the intended existing session.

## Completion

Inspect the final response, session target, and verification results. Do not infer safety or success from an agent name, a formatted output mode, or an exit code.
