---
name: pi
description: Use when the user asks to run Pi CLI non-interactively (`pi --print` or `pi --continue`) for code analysis, review, or authorized workspace work.
---

# Pi CLI

Before invoking Pi, follow `../_shared/agent-cli.md`.

## Verify the installed interface

```text
pi --version
pi --help
```

The current help output is authoritative. Pi has no sandbox or permission-mode flag: `--approve` / `--no-approve` only control whether project-local files are trusted for this run; they are not a permission boundary.

## Model, thinking, and extension context

Omit `--model`, `--provider`, and `--thinking` by default. They inherit the current Pi configuration or resumed session. Add one only when the user explicitly requests it and the installed interface supports the value. `--model` accepts a `provider/id` pattern with an optional `:<thinking>` suffix.

Pi loads the user's ambient packages, extensions, and skills by default, which can include model providers (for example Cyberbrain's `deepseek-responses`). Use `--no-extensions` / `--no-skills` only when an isolated run is explicitly wanted, and state that it drops those providers.

## Command patterns

```bash
# Non-interactive run with configured model settings
pi --print "<prompt>"

# Structured output for parsing
pi --print --mode json "<prompt>"

# Continue the most recent session
pi --continue --print "<follow-up prompt>"

# Target an explicit existing session (path or partial UUID)
pi --session <path|id> --print "<prompt>"

# Fork a session without touching the original
pi --fork <path|id> --print "<prompt>"

# Strongest read-only boundary: only the read tool stays enabled
pi --print --tools read "<prompt>"

# Ephemeral run that saves no session
pi --no-session --print "<prompt>"
```

`--resume` opens an interactive session picker; do not use it in a non-interactive run. `--tools` is an allowlist: `--tools read` disables every other tool (bash, edit, write, and custom tools). If the task must be read-only and a bare read allowlist is too narrow, say so instead of weakening the allowlist.

## Completion

Inspect Pi's final response, changed files, and requested verification. Report what was actually verified; a zero exit code alone is not a successful review or implementation.
