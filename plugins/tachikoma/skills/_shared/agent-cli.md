# Shared Agent CLI Protocol

Use this protocol for every non-interactive coding-agent CLI run.

## Host-Agent Compatibility

These skills must work in both Claude Code-style and Codex-style hosts. When instructions mention a host tool name, map it to the current host.

| Intent | Claude Code-style name | Codex equivalent |
| --- | --- | --- |
| Ask the user a question | `AskUserQuestion` | `request_user_input` when that Codex tool is available and appropriate; otherwise ask directly in the assistant response. If an action needs execution approval, use `exec_command` with `sandbox_permissions="require_escalated"` and a `justification`. |
| Run shell command | `Bash` | `exec_command`; use `write_stdin` for yielded interactive sessions. |
| Read/search files | `Read`, `Glob`, `Grep` | `exec_command` with `sed`, `rg --files`, `rg`; use MCP/document tools for binary files when available. |
| Edit files | `Edit`, `MultiEdit`, `Write` | `apply_patch` for manual edits; approved formatters or bulk tools for mechanical rewrites. |
| Track tasks | `TodoWrite` | `update_plan`. |
| Invoke skill | `Skill` | Skills load natively; read the relevant `SKILL.md` only when required by the host's skill rules. |
| Spawn subagent | `Task` | `spawn_agent`; then `wait_agent`; use `close_agent` when done. |
| Continue spawned agent | Task follow-up | `send_input`. |

Do not write a skill that only names one host's tools when the action is generic.

## Durable Output

Do not discard stderr with `2>/dev/null`. Capture stdout and stderr into a full-run Markdown log, and require the agent prompt to produce a separate compressed summary Markdown file.

Default artifact directory inside the current working directory:

```text
./.tachikoma/runs/<tool>-<YYYYMMDD-HHMMSS>/
```

Required artifacts:

```text
full.md      # command, cwd, flags, prompt, stdout, stderr, exit code
summary.md   # concise agent-written summary requested in the prompt
```

If the CLI can write files, instruct it in the prompt to write `summary.md` itself. If it cannot, create `summary.md` from captured output after the run.

## Prompt Suffix

Append this section to every agent prompt:

```text
## Required Summary

At the end of the run, write a Markdown summary to:
<SUMMARY_PATH>

The summary must include:
- Objective
- Files inspected
- Files changed
- Commands run
- Result
- Verification performed
- Open issues or follow-up
```

## Capture Pattern

Use shell capture that preserves both streams. Do not hide stderr.

```text
<command> > <run_dir>/stdout.log 2> <run_dir>/stderr.log
```

Then assemble `full.md` with the command, prompt, stdout, stderr, and exit code. If a command must be streamed live, also tee both streams into files.

## Write Permissions And Isolation

For coding-agent CLIs, default to read-only or planning mode when the CLI supports it.

When the user asks an external CLI agent to modify code or workspace state, first use `superpowers:using-git-worktrees` to create a fresh git worktree. Run the CLI from that worktree, then enable the CLI's write-capable sandbox or permission mode inside that isolated worktree.

Do not grant write permissions to external CLI agents in the main working tree. The worktree is the safety boundary for write-capable external agents.

For analysis-only tasks, keep read-only or planning modes.

When a command coordinates multiple external CLI agents for a coding fix, create the collaboration worktree before launching the agents. Run read-only analysis and review commands from that worktree too, so every agent sees the same isolated filesystem state.

Write-capable examples in individual skills are valid only after the fresh worktree exists and the command is running from that worktree.

## Asynchronous Multi-Agent Runs

When launching multiple CLI agents for the same collaboration phase, start all commands first and wait only after every command has been launched. Do not serialize by waiting for one CLI result before starting the next.

Each background run still needs its own run directory with `full.md` and `summary.md`.

## CLI Flags

When exact options matter, inspect the current CLI help before constructing the final command:

```text
<tool> --help
<tool> <subcommand> --help
```

Use web/network information only when the task requires current external details and network access is available or approved.

## Completion

After the CLI exits:

1. Check the exit code.
2. Inspect `summary.md` and relevant parts of `full.md`.
3. Report the result to the user with links or paths to both artifacts.
4. Do not claim the agent succeeded solely because the process exited successfully.
