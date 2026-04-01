---
name: qwen
description: Use when the user asks to run Qwen CLI in non-interactive mode or references Qwen Code for AI-assisted coding tasks.
---

# Qwen Code Skill Guide

## Running a Task
1. Verify installation: `command -v qwen`
2. Select the approval mode required for the task; default to `default` unless read-only or auto-approval is needed.
3. **Always use `AskUserQuestion` before using `-y, --yolo` or `--approval-mode yolo`.**
4. Assemble the command with the appropriate options:
   - `-m, --model <model>` - Model to use
   - `-y, --yolo` - Automatically accept all actions
   - `--approval-mode <plan|default|auto-edit|yolo>` - Approval mode
   - `-c, --continue` - Resume most recent session
   - `-r, --resume <session-id>` - Resume specific session
   - `-o, --output-format <text|json|stream-json>` - Output format
   - `--sandbox` - Run in sandbox
5. **IMPORTANT**: By default, append `2>/dev/null` to all `qwen` commands to suppress stderr noise. Only show stderr if the user explicitly requests it or if debugging is needed.
6. Run the command, capture stdout/stderr (filtered as appropriate), and summarize the outcome for the user.

### Quick Reference
| Use case | Command pattern |
| --- | --- |
| One-shot prompt | `qwen "your prompt here" 2>/dev/null` |
| Plan only (read-only) | `qwen "prompt" --approval-mode plan 2>/dev/null` |
| Auto-edit mode | `qwen "prompt" --approval-mode auto-edit 2>/dev/null` |
| Yolo mode (auto-approve all) | `qwen "prompt" --yolo 2>/dev/null` |
| Continue last session | `qwen --continue "follow-up" 2>/dev/null` |
| Use specific model | `qwen --model <model> "prompt" 2>/dev/null` |
| JSON output | `qwen "prompt" -o json 2>/dev/null` |
| Sandbox mode | `qwen "prompt" --sandbox 2>/dev/null` |

### Approval Modes
| Mode | Permissions | Use Case |
| --- | --- | --- |
| `plan` | Read-only, no edits | Code analysis, planning |
| `default` | Ask for approval | General use |
| `auto-edit` | Auto-approve edit tools | Making code changes |
| `yolo` | Auto-approve all tools | Full access, no confirmation |

### Example Commands

```bash
# One-shot prompt
qwen "Review src/ for bugs" 2>/dev/null

# Plan only mode
qwen "Analyze the codebase architecture" --approval-mode plan 2>/dev/null

# Yolo mode (auto-approve everything)
qwen "Fix bug in file.py. Apply now." --yolo 2>/dev/null

# Continue last session
qwen --continue "What else can you improve?" 2>/dev/null

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
