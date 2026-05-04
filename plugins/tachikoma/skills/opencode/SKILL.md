---
name: opencode
description: Use when the user asks to run OpenCode CLI in non-interactive mode (opencode run) or references OpenCode for AI-assisted coding tasks.
---

# OpenCode Skill Guide

## Running a Task
1. Verify installation: `command -v opencode`
2. Select the agent required for the task; default to `build` agent unless read-only analysis is needed.
3. **Always use `AskUserQuestion` before using the `build` agent for write operations.**
4. Assemble the command with the appropriate options:
   - `-m, --model <provider/model>` - Model to use
   - `-c, --continue` - Continue the last session
   - `-s, --session <id>` - Session ID to continue
   - `--agent <agent>` - Agent to use (`build` for full access, `plan` for read-only)
   - `-f, --file <files...>` - File(s) to attach
5. **IMPORTANT**: By default, append `2>/dev/null` to all `opencode run` commands to suppress stderr noise. Only show stderr if the user explicitly requests it or if debugging is needed.
6. Run the command, capture stdout/stderr (filtered as appropriate), and summarize the outcome for the user.

### Quick Reference
| Use case | Command pattern |
| --- | --- |
| Full access (write/edit/bash) | `opencode run --agent build "prompt" 2>/dev/null` |
| Read-only analysis | `opencode run --agent plan "prompt" 2>/dev/null` |
| Continue last session | `opencode run --continue "follow-up" 2>/dev/null` |
| Continue specific session | `opencode run --session <id> "prompt" 2>/dev/null` |
| Use specific model | `opencode run --model anthropic/claude-sonnet-4-20250514 "prompt" 2>/dev/null` |
| Attach files | `opencode run -f file.py "prompt" 2>/dev/null` |
| List models | `opencode models` |
| List sessions | `opencode session list` |
| List available agents | `opencode agent list` |

### Agents
| Agent | Permissions | Use Case |
| --- | --- | --- |
| `build` | Full access: write, edit, bash | Active development, making changes |
| `plan` | Read-only: no write/edit, bash asks first | Code analysis, planning, exploration |

### Example Commands

```bash
# Read-only analysis with plan agent
opencode run --agent plan "Analyze the codebase architecture" 2>/dev/null

# Full access with build agent
opencode run --agent build "Fix the bug in main.py" 2>/dev/null

# Continue last session
opencode run --continue "What else can you improve?" 2>/dev/null

# Use specific model
opencode run --model anthropic/claude-sonnet-4-20250514 "Refactor this code" 2>/dev/null

# If redirection fails, wrap in bash -lc
bash -lc 'opencode run --agent build "prompt" 2>/dev/null'
```

## Following Up
- After every `opencode run` command, immediately use `AskUserQuestion` to confirm next steps, collect clarifications, or decide whether to resume with `--continue`.
- When resuming, the session automatically uses the same model and agent from the original session.
- Restate the chosen model and agent when proposing follow-up actions.

## Error Handling
- Stop and report failures whenever `opencode --version` or an `opencode` command exits non-zero; request direction before retrying.
- Use `opencode debug` for troubleshooting if needed.
- Always validate OpenCode's output for security vulnerabilities (XSS, injection) before using.
