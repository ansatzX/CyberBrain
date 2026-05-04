---
name: cline-cli
description: Use when the user asks to run Cline CLI in non-interactive mode or references Cline for AI-assisted coding or task-based development.
---

# Cline CLI Skill Guide

## Running a Task
1. Verify installation: `command -v cline`
2. Select the mode required for the task; default to normal mode unless plan-only or auto-approval is needed.
3. **Always use `AskUserQuestion` before using `-y, --yolo` or `--auto-approve-all`.**
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
5. **IMPORTANT**: By default, append `2>/dev/null` to all `cline` commands to suppress stderr noise. Only show stderr if the user explicitly requests it or if debugging is needed.
6. Run the command, capture stdout/stderr (filtered as appropriate), and summarize the outcome for the user.

### Quick Reference
| Use case | Command pattern |
| --- | --- |
| Run task directly | `cline "your prompt" 2>/dev/null` |
| Plan mode only (read-only) | `cline -p "your prompt" 2>/dev/null` |
| Act mode | `cline -a "your prompt" 2>/dev/null` |
| Yolo mode (auto-approve) | `cline -y "prompt" 2>/dev/null` |
| Continue most recent task | `cline --continue 2>/dev/null` |
| Resume specific task | `cline --taskId <id> 2>/dev/null` |
| List task history | `cline history` |
| Use specific model | `cline -m <model> "prompt" 2>/dev/null` |

### Modes
| Mode | Description | Use Case |
| --- | --- | --- |
| `-p, --plan` | Read-only, no changes | Planning, analysis |
| `-a, --act` | Act mode | Making changes |
| `-y, --yolo` | Auto-approve all actions | Full access, no confirmation |

### Example Commands

```bash
# Run a task directly
cline "Fix the login bug" 2>/dev/null

# Plan only mode
cline -p "Design the new API endpoint" 2>/dev/null

# Yolo mode with auto-approve
cline -y "Refactor the utils module" 2>/dev/null

# Continue most recent task
cline --continue 2>/dev/null

# If redirection fails, wrap in bash -lc
bash -lc 'cline "prompt" 2>/dev/null'
```

## Following Up
- After every `cline` command, immediately use `AskUserQuestion` to confirm next steps, collect clarifications, or decide whether to resume with `--continue`.
- When resuming, the session automatically uses the same model and mode from the original task.
- Restate the chosen model, reasoning effort, and mode when proposing follow-up actions.

## Error Handling
- Stop and report failures whenever `cline --version` or a `cline` command exits non-zero; request direction before retrying.
- Before you use high-impact flags (`--yolo`, `--auto-approve-all`) ask the user for permission using AskUserQuestion unless it was already given.
- When output includes warnings or partial results, summarize them and ask how to adjust using `AskUserQuestion`.
- Always validate Cline's output for security vulnerabilities (XSS, injection) before using.
