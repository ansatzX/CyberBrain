---
name: qwen
description: Use when the user asks to run Qwen CLI in non-interactive mode or references Qwen Code for AI-assisted coding tasks.
---
# Qwen Code Skill Guide

Before running Qwen, follow the shared logging and summary protocol in `../_shared/agent-cli.md`.

## Running a Task

1. Verify installation: `command -v qwen`
2. Select the approval mode required for the task. Default to `plan` for read-only analysis. For implementation/editing tasks, first use `superpowers:using-git-worktrees` to create a fresh git worktree, then run Qwen there with `auto-edit` or `yolo` when approved.
3. **Always use `the current host's user-question or approval mechanism` before using `-y, --yolo` or `--approval-mode yolo`.**
4. Assemble the command with the appropriate options:
   - `-m, --model <model>` - Model to use
   - -p , --prompt Prompt. Appended to input on stdin (if any). will be **deprecated** in the future, but use it first
   - `-y, --yolo` - Automatically accept all actions
   - `--approval-mode <plan|default|auto-edit|yolo>` - Approval mode
   - `-c, --continue` - Resume most recent session
   - `-r, --resume <session-id>` - Resume specific session
   - `-o, --output-format <text|json|stream-json>` - Output format
   - `--sandbox` - Run in sandbox
5. Do not suppress stderr. Capture stdout and stderr into `full.md`, and require the prompt to write `summary.md`.
6. Run the command, inspect the full log and summary, and summarize the outcome for the user.

### Quick Reference

| Use case                     | Command pattern                                         |
| ---------------------------- | ------------------------------------------------------- |
| One-shot prompt              | `qwen "your prompt here"`                 |
| Plan only (read-only)        | `qwen "prompt" --approval-mode plan`      |
| Auto-edit mode in fresh worktree only | `qwen "prompt" --approval-mode auto-edit` |
| Yolo mode in fresh worktree only (auto-approve all) | `qwen "prompt" --yolo`                    |
| Continue last session        | `qwen --continue "follow-up"`             |
| Use specific model           | `qwen --model <model> "prompt"`           |
| JSON output                  | `qwen "prompt" -o json`                   |
| Sandbox mode                 | `qwen "prompt" --sandbox`                 |

### Approval Modes

| Mode          | Permissions             | Use Case                     |
| ------------- | ----------------------- | ---------------------------- |
| `plan`      | Read-only, no edits     | Code analysis, planning      |
| `default`   | Ask for approval        | General use                  |
| `auto-edit` | Auto-approve edit tools | Making code changes in a fresh worktree |
| `yolo`      | Auto-approve all tools  | Full access in a fresh worktree |

### Example Commands

```bash
# One-shot prompt
qwen -p "Review src/ for bugs"

# Plan only mode
qwen -p "Analyze the codebase architecture" --approval-mode plan

# Yolo mode in a fresh worktree only
qwen -p "Fix bug in file.py. Apply now." --yolo

# Continue last session
qwen --continue -p "What else can you improve?"

# Capture stdout/stderr according to ../_shared/agent-cli.md
```

## Following Up

- After every `qwen` command, immediately use `the current host's user-question or approval mechanism` to confirm next steps, collect clarifications, or decide whether to resume with `--continue`.
- When resuming, the session automatically uses the same model and approval mode from the original session.
- Restate the chosen model and approval mode when proposing follow-up actions.

## Error Handling

- Stop and report failures whenever `qwen --version` or a `qwen` command exits non-zero; request direction before retrying.
- Before you use high-impact flags (`--yolo`, `--approval-mode yolo`) ask the user for permission using the current host's user-question or approval mechanism unless it was already given.
- When output includes warnings or partial results, summarize them and ask how to adjust using `the current host's user-question or approval mechanism`.
- Always validate Qwen's output for security vulnerabilities (XSS, injection) before using.
