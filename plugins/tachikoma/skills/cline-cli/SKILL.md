---
name: cline-cli
description: Use when the user asks to run Cline CLI in non-interactive mode or references Cline for AI-assisted coding or task-based development.
---

# Cline CLI Skill Guide

Before running Cline, follow the shared logging and summary protocol in `../_shared/agent-cli.md`.

## Running a Task
1. Verify installation: `command -v cline`
2. Select the mode required for the task. Default to plan mode for analysis. For implementation/editing tasks, first use `superpowers:using-git-worktrees` to create a fresh git worktree, then run Cline there with act/yolo modes when approved.
3. **Always use `the current host's user-question or approval mechanism` before using `-y, --yolo` or `--auto-approve-all`.**
4. Assemble the command with the appropriate options:
   - `-m, --model <model>` - Model to use for the task
   - `-p, --plan` - Run in plan mode (read-only)
   - `-a, --act` - Run in act mode
   - `-y, --yolo` - Enable yolo mode (auto-approve actions)
   - `--auto-approve-all` - Enable auto-approve all actions
   - `--reasoning-effort <none|low|medium|high|xhigh>` - Reasoning effort
   - `-c, --cwd <path>` - Working directory
   - `--continue` - Resume the most recent task
   - `-T, --taskId <id>` - Resume an existing task by ID
5. Do not suppress stderr. Capture stdout and stderr into `full.md`, and require the prompt to write `summary.md`.
6. Run the command, inspect the full log and summary, and summarize the outcome for the user.

### Quick Reference
| Use case | Command pattern |
| --- | --- |
| Run task directly | `cline "your prompt"` |
| Plan mode only (read-only) | `cline -p "your prompt"` |
| Act mode in fresh worktree only | `cline -a "your prompt"` |
| Yolo mode in fresh worktree only (auto-approve) | `cline -y "prompt"` |
| Continue most recent task | `cline --continue` |
| Resume specific task | `cline --taskId <id>` |
| List task history | `cline history` |
| Use specific model | `cline -m <model> "prompt"` |

### Modes
| Mode | Description | Use Case |
| --- | --- | --- |
| `-p, --plan` | Read-only, no changes | Planning, analysis |
| `-a, --act` | Act mode | Making changes in a fresh worktree |
| `-y, --yolo` | Auto-approve all actions | Full access in a fresh worktree |

### Example Commands

```bash
# Run a task directly
cline "Fix the login bug"

# Plan only mode
cline -p "Design the new API endpoint"

# Yolo mode with auto-approve in a fresh worktree only
cline -y "Refactor the utils module"

# Continue most recent task
cline --continue

# Capture stdout/stderr according to ../_shared/agent-cli.md
```

## Following Up
- After every `cline` command, immediately use `the current host's user-question or approval mechanism` to confirm next steps, collect clarifications, or decide whether to resume with `--continue`.
- When resuming, the session automatically uses the same model and mode from the original task.
- Restate the chosen model, reasoning effort, and mode when proposing follow-up actions.

## Error Handling
- Stop and report failures whenever `cline --version` or a `cline` command exits non-zero; request direction before retrying.
- Before you use high-impact flags (`--yolo`, `--auto-approve-all`) ask the user for permission using the current host's user-question or approval mechanism unless it was already given.
- When output includes warnings or partial results, summarize them and ask how to adjust using `the current host's user-question or approval mechanism`.
- Always validate Cline's output for security vulnerabilities (XSS, injection) before using.
