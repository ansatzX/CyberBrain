---
name: grok
description: Use when the user asks to run Grok Build (`grok`) for code analysis, review, or authorized workspace changes.
---

# Grok Build

Before invoking Grok Build, follow `../_shared/agent-cli.md`.

## Verify the installed interface

```text
grok version
grok --help
```

Use the installed help for headless prompt, sandbox, output-format, and resume
syntax. The official CLI uses `grok` and supports headless prompts with `-p`;
do not assume an unverified flag is available in the installed version.

## Model and execution boundary

Omit `--model` / `-m` unless the user explicitly selected a model. Do not use
`--always-approve` / `--yolo` unless the user explicitly authorizes automatic
tool approval. A worktree isolates repository changes but does not grant wider
permissions.

For read-only analysis, verify `--sandbox read-only` in the installed help and
use it for the run. Grok's documented read-only profile still allows writes to
`~/.grok/` and temporary storage; it blocks child network access only on Linux,
and does not block the model API or web tools. If strict immutability is
required, account for these boundaries before launch. For authorized workspace
changes, use the narrowest verified sandbox profile that permits them.

Headless examples, after verifying the flags above:

```bash
# Read-only analysis
grok --cwd "$TARGET_DIR" --sandbox read-only --no-auto-update \
  -p "$PROMPT" --output-format json

# Authorized workspace changes with interactive tool approvals
grok --cwd "$TARGET_DIR" --sandbox workspace --no-auto-update \
  -p "$PROMPT" --output-format json
```

Do not place credentials in prompts or command arguments. Grok stores user
configuration and sessions under `~/.grok/` by default; respect `GROK_HOME` when
it is set. Never request credentials from the user.

## Resume and completion

Use only the resume syntax shown by the installed `grok --help`. Preserve the
intended session ID and the original execution boundary; do not change model,
sandbox, or approval settings while resuming.

Inspect Grok's final response, changed files, and requested verification. Report
the command, actual exit status, and any boundary that limited the result. A
zero exit code alone does not establish that the requested work succeeded.
