---
name: qwen
description: Use when the user asks to run Qwen Code in non-interactive mode for analysis, review, or authorized coding work.
---

# Qwen Code

Before invoking Qwen, follow `../_shared/agent-cli.md`.

## Verify the installed interface

```text
qwen --version
qwen --help
```

Use the installed help to select non-interactive syntax. At verification on 2026-09-07, positional prompts and `--approval-mode plan` are supported; `-p` is deprecated. Verify again before running, since releases differ. Plan mode is documented as analysis without file edits or command execution. Automatic modes (`auto-edit`, `auto`, `yolo`) require the execution authority described in the shared protocol.

## Model and execution boundary

Omit `--model` and `--fallback-model` unless the user explicitly requested supported values. Fallback models change which system receives the task, so they require the same explicit model-selection decision as a primary model.

`--sandbox` means only what the currently installed Qwen documentation says. It is not, by itself, a guarantee of read-only execution. If no installed Qwen feature establishes a read-only non-interactive boundary, state that limitation and obtain direction before running an agent against a workspace that must remain unchanged.

## Command patterns

```bash
# Read-only analysis after verifying plan mode in installed help
qwen --approval-mode plan "<prompt>"

# Non-interactive run within an established execution boundary
qwen "<prompt>"

# Structured output when needed
qwen "<prompt>" --output-format json

# Continue the most recent session for the current project
qwen --continue "<follow-up prompt>"

# Resume an identified session
qwen --resume <session-id> "<follow-up prompt>"
```

Use `--sandbox` only after explaining the installed behavior and confirming that it matches the requested boundary.

## Completion

Inspect Qwen's final response and requested verification. Do not retry with a fallback model, sandbox change, or broader access after a failure unless the user directs it.
