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

# Stable session handle: opens an existing project session by exact id,
# or creates it with that id on first use — the resume handle for loops
pi --session-id <stable-id> --print "<message>"

# Continue the most recent session for this project
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

`--resume` (`-r`) always opens an interactive TUI session picker; never use it
inside a non-interactive run. For scripted continuation use `--session-id` or
`--continue` instead. `--tools` is an allowlist: `--tools read` disables every
other tool (bash, edit, write, and custom tools). If the task must be read-only
and a bare read allowlist is too narrow, say so instead of weakening the
allowlist.

## Iterative resume loop

Pi is the default coding agent in tachikoma. One `--print` run is one turn of a
longer collaboration; do not assume a task finishes in one run. Loop until the
task is done, the run fails, or parent judgment is required:

1. **Allocate a stable session id** before the first run, for example
   `tachikoma-<task-slug>`. Pass it as `--session-id` on every round. The id is
   the conversation handle: pi keeps its own context in the session file, not
   in this context.
2. **Instruct, run, exit.** Each round is `pi --session-id <id> --print
   "<next instruction>"`. The run stops when it finishes its turn; stdout is
   the reply to read.
3. **Read staged results.** Inspect the final response and the artifacts pi
   wrote to the workspace (files, diffs, checkpoints). The workspace is the
   shared ground truth between pi and this agent. Maintain the task record per
   the shared protocol §6: append this round's output to `session.log` behind a
   `===== round N <timestamp> =====` separator, and rewrite `summary.md` with a
   round number and timestamp header — then deliver it by cating it into the
   command stdout; the summary is the only file that may enter this context in
   full.
4. **Judge, then instruct.** Done → report. More work → send the next focused
   instruction through the same session id. Stuck, failed, or needs a decision
   this agent cannot make → stop and report instead of guessing.
5. **Bound the loop.** Track rounds; after a small budget with no convergence,
   stop and report the exact state. Never silently restart with a new session
   to "retry from scratch" unless the user or parent says so.

Communication contract: pi's concise final response and the workspace artifacts
are the only channels read; never replay pi's raw transcript into this context.
Report the session id so the parent can resume the same conversation later.

## Completion

Inspect Pi's final response, changed files, and requested verification. Report what was actually verified; a zero exit code alone is not a successful review or implementation.
