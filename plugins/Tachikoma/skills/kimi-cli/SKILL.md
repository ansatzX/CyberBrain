---
name: kimi-cli
description: Use when the user asks to run Kimi CLI in non-interactive mode or references Kimi for AI-assisted coding or agent tasks.
---

# Kimi CLI Skill Guide

## Running a Task
1. Verify installation: `command -v kimi`
2. Select the mode required for the task; default to `--print` mode for non-interactive use.
3. **Always use `AskUserQuestion` before using `-y, --yolo, --yes` or `--print` modes (they auto-approve actions).**
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
5. **IMPORTANT**: By default, append `2>/dev/null` to all `kimi` commands to suppress stderr noise. Only show stderr if the user explicitly requests it or if debugging is needed.
6. Run the command, capture stdout/stderr (filtered as appropriate), and summarize the outcome for the user.

### Quick Reference
| Use case | Command pattern |
| --- | --- |
| Non-interactive print mode | `kimi --print --prompt "prompt" 2>/dev/null` |
| Quiet mode (final msg only) | `kimi --quiet --prompt "prompt" 2>/dev/null` |
| Continue last session | `kimi --print --continue --prompt "follow-up" 2>/dev/null` |
| Resume specific session | `kimi --print --session <id> --prompt "prompt" 2>/dev/null` |
| Yolo mode (auto-approve) | `kimi --print --yolo --prompt "prompt" 2>/dev/null` |
| With specific model | `kimi --print --model <model> --prompt "prompt" 2>/dev/null` |
| Additional directory | `kimi --print --add-dir /path --prompt "prompt" 2>/dev/null` |
| Okabe agent | `kimi --print --agent okabe --prompt "prompt" 2>/dev/null` |

### Modes
| Mode | Description | Use Case |
| --- | --- | --- |
| `--print` | Non-interactive, auto-approves | Batch operations, scripting |
| `--quiet` | Non-interactive, only final output | Clean output for scripts |
| `--yolo` | Auto-approve all actions | Full access (use with caution) |

### Example Commands

```bash
# Non-interactive print mode (auto-approves)
kimi --print --prompt "Refactor the utils module" 2>/dev/null

# Quiet mode (only final message)
kimi --quiet --prompt "Fix the bug in src/main.py" 2>/dev/null

# Continue last session
kimi --print --continue --prompt "What else can you improve?" 2>/dev/null

# With specific model and okabe agent
kimi --print --agent okabe --model moonshot-v1-auto --prompt "Analyze codebase" 2>/dev/null

# If redirection fails, wrap in bash -lc
bash -lc 'kimi --print --prompt "prompt" 2>/dev/null'
```

## Following Up
- After every `kimi` command, immediately use `AskUserQuestion` to confirm next steps, collect clarifications, or decide whether to resume with `--continue`.
- When resuming, the session automatically uses the same model and agent from the original session.
- Restate the chosen model and agent when proposing follow-up actions.

## Error Handling
- Stop and report failures whenever `kimi --version` or a `kimi` command exits non-zero; request direction before retrying.
- Before you use high-impact flags (`--yolo`, `--yes`, `--print`) ask the user for permission using AskUserQuestion unless it was already given.
- When output includes warnings or partial results, summarize them and ask how to adjust using `AskUserQuestion`.
- Always validate Kimi's output for security vulnerabilities (XSS, injection) before using.
