---
name: pi
description: Use when the user asks to run Pi CLI non-interactively (`pi --print` or `pi --continue`) for code analysis, review, or authorized workspace work.
---

# Pi CLI

Before invoking Pi, follow `../_shared/agent-cli.md`.

## Verify the installed interface

Apply the shared protocol’s same-session reuse rules; these checks are needed
for a new or changed executable, not automatically on each round.

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

# Model-tool restriction: only the read tool stays enabled
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

## Choose single-call or resumable execution

For a bounded one-call task, use a verified command pattern above with the selected
tool restriction. Capture stdout/stderr and exit status as in the shared protocol;
no durable coordinator record is required if the task completes in this session.
Pi may still write its own runtime session state unless the chosen mode disables it.

Use the following loop only when the task needs multiple rounds, background work
or a resumable handoff. Preserve an existing session’s exact tool boundary when
continuing; the helper’s `read-only` preset enables `read,grep,find,ls` and must not
be substituted for a narrower existing allowlist.

## Iterative resume loop

After checking current help and authorization, use the bundled
[round helper](scripts/run-round.sh) when its preset exactly matches the selected
boundary. If an existing session has a narrower allowlist, use its verified direct
resume command with that exact allowlist and the shared protocol’s durable logging
instead. Preserve the exit status and do not widen tools to fit the helper.

For a matching preset:

```bash
bash <skill-dir>/scripts/run-round.sh <target-dir> <log-dir> <session-id> <round> read-only <prompt-file>
# For explicitly authorized edits, select workspace-write on the first round.
```

Resolve placeholders before running. Use `$TACHIKOMA_LOG_DIR` or the default
`<target-dir>/.tachikoma/<task-slug>` for log-dir. The coordinator owns this
directory; do not run simultaneous rounds against the same record. The helper
appends stdout/stderr to session.log and returns Pi's exit status without replaying
the raw output. Inspect a bounded excerpt (for example, the final 80 lines), then
check relevant artifacts and write summary.md. Failure ends this round; do not
retry with broader tools. A changed target/session/boundary is rejected.

Here read-only describes the model tool allowlist. Pi session/log writes and
ambient extension startup are outside that allowlist. Inspect extension side
effects first; strict workspace immutability requires a verified external
boundary or an appropriately isolated configuration. Do not assume --tools
restricts arbitrary extension code. Workspace-write is an authorization label,
not a Pi filesystem sandbox.

Pi is the default coding agent in tachikoma. One `--print` run is one turn of a
longer collaboration; do not assume a task finishes in one run. Loop until the
task is done, the run fails, or parent judgment is required:

1. **Allocate a stable session id** before the first run, for example
   `tachikoma-<task-slug>`. Pass it as `--session-id` on every round. The id is
   the conversation handle: pi keeps its own context in the session file, not
   in this context.
2. **Instruct, run, exit.** Use the matching helper preset or the exact-boundary
   direct invocation above with the same target and session on every round. Inspect the saved final response and
   exit status; stop on failure.
3. **Read staged results.** Inspect the final response and relevant artifacts.
   The helper already appends output to `session.log`; do not append it twice.
   For a direct invocation, the coordinator captures and appends it once.
   Update the durable summary per shared protocol §6 and return its concise
   contents. Use bounded log excerpts for evidence, not transcript replay.
4. **Judge, then instruct.** Done → report. More work → send the next focused
   instruction through the same session id. Stuck, failed, or needs a decision
   this agent cannot make → stop and report instead of guessing.
5. **Bound the loop.** Track rounds; after a small budget with no convergence,
   stop and report the exact state. Never silently restart with a new session
   to "retry from scratch" unless the user or parent says so.

Communication contract: inspect pi's concise final response, relevant workspace
artifacts and bounded log excerpts when needed. Never replay the full transcript
into this context.
For resumable work, report the verified session id. For a completed one-call task,
report a handle only if one is available; do not create one solely for reporting.

## Completion

Inspect Pi's final response, changed files, and requested verification. Report what was actually verified; a zero exit code alone is not a successful review or implementation.
