---
name: kimi-cli
description: Use when the user asks to run Kimi CLI in non-interactive mode or references Kimi for AI-assisted coding or agent tasks.
---

# Kimi CLI Skill Guide

Before running Kimi, follow the shared logging and summary protocol in `../_shared/agent-cli.md`.

## Running a Task
1. Verify installation: `command -v kimi`
2. Select the mode required for the task; default to `--print` mode for non-interactive use. For implementation tasks, first use `superpowers:using-git-worktrees` to create a fresh git worktree, then run Kimi there with write-capable/auto-approve options when approved.
3. **Always use `the current host's user-question or approval mechanism` before using `-y, --yolo, --yes` or `--print` modes (they auto-approve actions).**
4. Assemble the command with the appropriate options:
   - `-p, --prompt, --command <text>` - User prompt to the agent (required for non-interactive)
   - `-C, --continue` - Continue previous session for working directory
   - `-S, --session <id>` - Session ID to resume
   - `-m, --model <model>` - LLM model to use
   - `-y, --yolo, --yes` - Automatically approve all actions (use with caution)
   - `--print` - Run in print mode (non-interactive, implies --yolo)
   - `--quiet` - Alias for --print with text output and final message only
   - `-w, --work-dir <directory>` - Working directory for the agent
   - `--add-dir <directory>` - Add additional directory to workspace scope
   - `--agent <default|okabe>` - Builtin agent specification
5. Do not suppress stderr. Capture stdout and stderr into `full.md`, and require the prompt to write `summary.md`.
6. Run the command, inspect the full log and summary, and summarize the outcome for the user.

### Quick Reference
| Use case | Command pattern |
| --- | --- |
| Non-interactive print mode | `kimi --print --prompt "prompt"` |
| Quiet mode (final msg only) | `kimi --quiet --prompt "prompt"` |
| Continue last session | `kimi --print --continue --prompt "follow-up"` |
| Resume specific session | `kimi --print --session <id> --prompt "prompt"` |
| Yolo mode in fresh worktree only (auto-approve) | `kimi --print --yolo --prompt "prompt"` |
| With specific model | `kimi --print --model <model> --prompt "prompt"` |
| Additional directory | `kimi --print --add-dir /path --prompt "prompt"` |
| Okabe agent | `kimi --print --agent okabe --prompt "prompt"` |

### Modes
| Mode | Description | Use Case |
| --- | --- | --- |
| `--print` | Non-interactive, auto-approves | Analysis only unless running inside a fresh worktree |
| `--quiet` | Non-interactive, only final output | Clean output for scripts |
| `--yolo` | Auto-approve all actions | Full access in a fresh worktree |

### Example Commands

```bash
# Non-interactive print mode; analysis in main tree, writes only in a fresh worktree
kimi --print --prompt "Refactor the utils module"

# Quiet mode (only final message)
kimi --quiet --prompt "Fix the bug in src/main.py"

# Continue last session
kimi --print --continue --prompt "What else can you improve?"

# With specific model and okabe agent
kimi --print --agent okabe --model moonshot-v1-auto --prompt "Analyze codebase"

# Capture stdout/stderr according to ../_shared/agent-cli.md
```

## Following Up
- After every `kimi` command, immediately use `the current host's user-question or approval mechanism` to confirm next steps, collect clarifications, or decide whether to resume with `--continue`.
- When resuming, the session automatically uses the same model and agent from the original session.
- Restate the chosen model and agent when proposing follow-up actions.

## Error Handling
- Stop and report failures whenever `kimi --version` or a `kimi` command exits non-zero; request direction before retrying.
- Before you use high-impact flags (`--yolo`, `--yes`, `--print`) ask the user for permission using the current host's user-question or approval mechanism unless it was already given.
- When output includes warnings or partial results, summarize them and ask how to adjust using `the current host's user-question or approval mechanism`.
- Always validate Kimi's output for security vulnerabilities (XSS, injection) before using.
