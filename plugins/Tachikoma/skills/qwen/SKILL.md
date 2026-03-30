---
name: qwen
description: Use when the user asks to run Qwen CLI or references Qwen Code for AI-assisted coding, MCP servers, or interactive development
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---

# Qwen Code Skill Guide (v0.13.2)

## When to Use Qwen

| Use Case | Why Qwen |
| --- | --- |
| AI-assisted coding | Interactive CLI with Qwen models |
| Code generation and editing | Direct file modification with approval modes |
| MCP integration | Built-in MCP server management |
| Session resumption | Continue previous work with `--continue` |
| Extension support | Custom extensions via `extensions` command |

**When NOT to use**: Simple quick tasks (overhead not worth it), interactive refinement where immediate feedback is needed.

## Running a Task

1. Verify installation: `command -v qwen`
2. Select the mode required for the task; default to interactive unless non-interactive is needed.
3. **Always use `AskUserQuestion` before using `-y, --yolo` or `--approval-mode yolo`.**
4. Assemble the command with the appropriate options:
   - `-m, --model <model>` - Model selection
   - `-y, --yolo` - Automatically accept all actions (aka YOLO mode)
   - `--approval-mode <plan|default|auto-edit|yolo>` - Set approval mode
   - `-c, --continue` - Resume most recent session
   - `-r, --resume <session-id>` - Resume specific session
   - `-o, --output-format <text|json|stream-json>` - Output format
   - `--sandbox` - Run in sandbox
5. **Important**: By default, append `2>/dev/null` to all `qwen` commands to suppress thinking tokens (stderr). Only show stderr if the user explicitly requests to see thinking tokens or if debugging is needed.

### Quick Reference

| Use case | Mode | Command pattern |
| --- | --- | --- |
| Interactive mode | interactive | `qwen 2>/dev/null` |
| One-shot prompt | oneshot | `qwen "your prompt here" 2>/dev/null` |
| Continue session | resume | `qwen --continue 2>/dev/null` |
| Yolo mode (auto-approve) | yolo | `qwen "prompt" --yolo 2>/dev/null` |
| JSON output | json | `qwen "prompt" -o json 2>/dev/null | jq -r '.response'` |
| Plan only mode | plan | `qwen "prompt" --approval-mode plan 2>/dev/null` |
| Auto-edit mode | auto-edit | `qwen "prompt" --approval-mode auto-edit 2>/dev/null` |

### Example Commands

```bash
# Interactive mode
qwen

# One-shot prompt
qwen "Review src/ for bugs" 2>/dev/null

# Yolo mode
qwen "Fix bug in file.py. Apply now." --yolo 2>/dev/null

# JSON output with jq
qwen "prompt" -o json 2>/dev/null | jq -r '.response'

# If redirection fails, wrap in bash -lc
bash -lc 'qwen "prompt" 2>/dev/null'
```

## Following Up

- After every `qwen` command, immediately use `AskUserQuestion` to confirm next steps, collect clarifications, or decide whether to resume with `--continue`.
- When resuming, the session automatically uses the same model and approval mode from the original session.
- Restate the chosen model and approval mode when proposing follow-up actions.

## Error Handling

- Stop and report failures whenever `qwen --version` or a `qwen` command exits non-zero; request direction before retrying.
- Before you use high-impact flags (`--yolo`, `--approval-mode yolo`) ask the user for permission using AskUserQuestion unless it was already given.
- When output includes warnings or partial results, summarize them and ask how to adjust using `AskUserQuestion`.
- Always validate Qwen's output for security vulnerabilities (XSS, injection) before using.
