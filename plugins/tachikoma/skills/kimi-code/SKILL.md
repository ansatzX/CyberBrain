---
name: kimi-code
description: Use when the user asks to run Kimi Code in non-interactive mode for code analysis, review, or authorized agent work.
---

# Kimi Code

Before invoking Kimi, follow `../_shared/agent-cli.md`.

## Verify the installed interface

```text
kimi --version
kimi --help
```

Use `-p` / `--prompt` for the current non-interactive mode. Do not use undocumented flags such as `--print`, `--quiet`, `--yes`, or `--work-dir`.

## Model, agent, and permission selection

Omit `--model` and `--agent` by default. A requested agent must be compatible with the requested session operation: the installed CLI documents that `--agent` cannot be combined with `--session` or `--continue`.

- `--yolo` auto-approves regular tool calls but may still ask questions.
- `--auto` is fully autonomous and does not ask questions.

Neither flag is required for prompt mode. Use either only after explicit approval of its exact behavior and execution boundary.

## Command patterns

```bash
# Non-interactive run with the configured model and normal permission behavior
kimi -p "<prompt>"

# User-authorized automatic tool approval
kimi -p "<prompt>" --yolo

# Continue the previous session for this working directory
kimi --continue -p "<follow-up prompt>"

# Resume an identified session
kimi --session <id> -p "<follow-up prompt>"
```

Use `--add-dir` only for directories the user has authorized Kimi to access.

## Completion

Inspect the final response and requested verification. If Kimi cannot proceed without an interaction or permission that was not authorized, stop and report it.
