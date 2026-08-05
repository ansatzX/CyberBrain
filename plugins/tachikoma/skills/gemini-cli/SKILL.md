---
name: gemini-cli
description: Use when the user explicitly requests Gemini CLI, or wants Gemini's separate model perspective for code analysis, review, research, or implementation.
---

# Gemini CLI

Before invoking Gemini, follow `../_shared/agent-cli.md`.

## Verify the installed interface

```text
gemini --version
gemini --help
```

Gemini positional text starts an interactive session. Use `-p` / `--prompt` for a non-interactive run. Do not assume a particular built-in search or codebase-investigation tool exists; inspect the installed capability before promising it.

## Model and permission selection

Omit `--model` by default. Preserve the configured model unless the user explicitly requests another supported model.

The installed CLI documents `--approval-mode plan` as read-only. Verify that option before using it. `auto_edit` approves edits, and `yolo` approves all tool actions; each requires the boundary and approval specified in the shared protocol. `--sandbox` is an isolation setting, not evidence that the task is read-only.

## Command patterns

```bash
# Non-interactive, read-only analysis when the installed CLI supports plan mode
gemini --approval-mode plan -p "<prompt>"

# User-authorized editing with automatic edit approval
gemini --approval-mode auto_edit -p "<prompt>"

# Resume the latest Gemini session
gemini --resume latest -p "<follow-up prompt>"
```

Use `--worktree` only when the user requests or approves creation of a new worktree. Do not add `--yolo` merely to avoid prompts.

## Completion

Inspect the final response and requested verification. Treat web-search output as leads that require source inspection, not as verified evidence.
