---
name: codex
description: Use when the user asks to run Codex CLI (`codex exec` or `codex exec resume`) or explicitly requests OpenAI Codex code analysis, review, or editing.
---

# Codex CLI

Before invoking Codex, follow `../_shared/agent-cli.md`.

## Verify the installed interface

```text
codex --version
codex exec --help
codex exec resume --help       # only when resuming
```

The current help output is authoritative. Do not use removed flags such as `--full-auto`.

## Model, profile, and reasoning

By default omit `--model`, `--profile`, and `--config model_reasoning_effort=...`. This preserves the user's configured Codex model, profile, and reasoning level. Add one only when the user explicitly requests it and the installed configuration supports it. Do not impose profile-specific model rules in this skill.

## Command patterns

Use the smallest sandbox consistent with the confirmed task:

```bash
# Analysis only
codex exec --sandbox read-only "<prompt>"

# User-authorized changes in the selected writable workspace
codex exec --sandbox workspace-write "<prompt>"

# Resume the most recent matching session without changing its model or policy
printf '%s\n' '<follow-up prompt>' | codex exec resume --last -
```

Use `-C <directory>` only for an explicitly selected target. Use `--skip-git-repo-check` only when the target is known not to be a Git repository and the user accepts that reduced safeguard. `danger-full-access` requires explicit approval and a stated reason.

## Completion

Inspect Codex's final response, changed files, and requested verification. Report what was actually verified; a zero exit code alone is not a successful review or implementation.
