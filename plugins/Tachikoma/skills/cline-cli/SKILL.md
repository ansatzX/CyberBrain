---
name: cline-cli
description: Use when the user asks to run Cline CLI or references Cline for AI-assisted coding, kanban, or task-based development
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---

# Cline CLI Skill Guide (v2.11.0)

## When to Use Cline

| Use Case | Why Cline |
| --- | --- |
| Kanban project management | Visual task tracking with `cline kanban` |
| AI-assisted coding | Task-based development with planning |
| Complex feature implementation | Plan mode (`--plan`) and act mode (`--act`) |
| Task history management | Resume tasks with `--continue` or `--taskId` |
| Multi-file operations | Coordinated changes across files |

**When NOT to use**: Simple quick tasks (overhead not worth it), trivial one-line changes.

## Running a Task

1. Verify installation: `command -v cline`
2. Select the mode required for the task; default to kanban mode unless immediate task execution is needed.
3. **Always use `AskUserQuestion` before using `-y, --yolo` or `--auto-approve-all`.**
4. Assemble the command with the appropriate options:
   - `-m, --model <model>` - Model to use for the task
   - `-p, --plan` - Run in plan mode
   - `-a, --act` - Run in act mode
   - `-y, --yolo` - Enable yolo mode (auto-approve actions)
   - `--auto-approve-all` - Enable auto-approve all actions while keeping interactive mode
   - `--reasoning-effort <none|low|medium|high|xhigh>` - Reasoning effort
   - `-c, --cwd <path>` - Working directory
   - `--continue` - Resume the most recent task
   - `-T, --taskId <id>` - Resume an existing task by ID
   - `cline history` - List task history
5. **Important**: By default, append `2>/dev/null` to all `cline` commands to suppress thinking tokens (stderr). Only show stderr if the user explicitly requests to see thinking tokens or if debugging is needed.

### Quick Reference

| Use case | Mode | Command pattern |
| --- | --- | --- |
| Kanban mode | kanban | `cline kanban` |
| Run task | task | `cline task "your prompt" 2>/dev/null` |
| Plan mode only | plan | `cline --plan "your prompt" 2>/dev/null` |
| Act mode | act | `cline --act "your prompt" 2>/dev/null` |
| Yolo mode (auto-approve) | yolo | `cline --yolo "prompt" 2>/dev/null` |
| Continue task | resume | `cline --continue 2>/dev/null` |
| Task history | history | `cline history` |

### Example Commands

```bash
# Kanban mode
cline kanban

# Run a task
cline task "Fix the login bug" 2>/dev/null

# Plan only mode
cline --plan "Design the new API endpoint" 2>/dev/null

# Yolo mode with auto-approve
cline --yolo "Refactor the utils module" 2>/dev/null

# If redirection fails, wrap in bash -lc
bash -lc 'cline task "prompt" 2>/dev/null'
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
