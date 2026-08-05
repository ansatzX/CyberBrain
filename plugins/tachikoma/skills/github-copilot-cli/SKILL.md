---
name: github-copilot-cli
description: Use when the user asks to run GitHub Copilot CLI in non-interactive mode for code analysis, review, or authorized workspace changes.
---

# GitHub Copilot CLI

Before invoking Copilot, follow `../_shared/agent-cli.md`.

## Verify the installed interface

```text
copilot --version
copilot --help
```

Use `-p` / `--prompt` for a non-interactive run. Current Copilot help states that prompt mode requires automatic tool permission. Therefore do **not** call a plain non-interactive run “read-only” unless the installed CLI's permission documentation and an explicit tool allowlist prove that no write-capable tool is available.

## Model and permission selection

Omit `--model` and `--effort` unless the user explicitly selected supported values.

- `--allow-all-tools` auto-approves tools; it may permit workspace changes.
- `--allow-all` / `--yolo` additionally remove path and URL restrictions. Do not use either by default.
- `--available-tools`, `--allow-tool`, `--deny-tool`, and URL/path policies can narrow what Copilot receives, but do not override the documented requirement for automatic tool permission in prompt mode.
- Therefore, with the currently installed CLI, safe non-interactive analysis is unavailable. Ask whether the user authorizes the proposed tool boundary; otherwise use a different verified read-only workflow.

## Command pattern

```bash
# Only after the user authorizes prompt-mode automatic tool permission
copilot -p "<prompt>" --allow-all-tools
```

For continuation, use the currently documented `--continue` or `--resume[=<session-id>]` syntax and preserve the original permission boundary unless the user changes it.

## Completion

Inspect the final response and repository state. Validate generated commands and code before executing or accepting them.
