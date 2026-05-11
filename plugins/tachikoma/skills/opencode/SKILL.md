---
name: opencode
description: Use when the user asks to run OpenCode CLI in non-interactive mode (opencode run) or references OpenCode for AI-assisted coding tasks.
---

# OpenCode Skill Guide

Before running OpenCode, follow the shared logging and summary protocol in `../_shared/agent-cli.md`.

## Running a Task
1. Verify installation: `command -v opencode`
2. Select the agent required for the task; default to `plan` for read-only analysis. For implementation/editing tasks, first use `superpowers:using-git-worktrees` to create a fresh git worktree, then run OpenCode there with `--agent build` when approved.
3. **Always use `the current host's user-question or approval mechanism` before using the `build` agent for write operations.**
4. Assemble the command with the appropriate options:
   - `-m, --model <provider/model>` - Model to use
   - `-c, --continue` - Continue the last session
   - `-s, --session <id>` - Session ID to continue
   - `--agent <agent>` - Agent to use (`build` for full access, `plan` for read-only)
   - `-f, --file <files...>` - File(s) to attach
5. Do not suppress stderr. Capture stdout and stderr into `full.md`, and require the prompt to write `summary.md`.
6. Run the command, inspect the full log and summary, and summarize the outcome for the user.

### Quick Reference
| Use case | Command pattern |
| --- | --- |
| Full access in fresh worktree only (write/edit/bash) | `opencode run --agent build "prompt"` |
| Read-only analysis | `opencode run --agent plan "prompt"` |
| Continue last session | `opencode run --continue "follow-up"` |
| Continue specific session | `opencode run --session <id> "prompt"` |
| Use specific model | `opencode run --model anthropic/claude-sonnet-4-20250514 "prompt"` |
| Attach files | `opencode run -f file.py "prompt"` |
| List models | `opencode models` |
| List sessions | `opencode session list` |
| List available agents | `opencode agent list` |

### Agents
| Agent | Permissions | Use Case |
| --- | --- | --- |
| `build` | Full access: write, edit, bash | Active development in a fresh worktree |
| `plan` | Read-only: no write/edit, bash asks first | Code analysis, planning, exploration |

### Example Commands

```bash
# Read-only analysis with plan agent
opencode run --agent plan "Analyze the codebase architecture"

# Full access with build agent in a fresh worktree only
opencode run --agent build "Fix the bug in main.py"

# Continue last session
opencode run --continue "What else can you improve?"

# Use specific model
opencode run --model anthropic/claude-sonnet-4-20250514 "Refactor this code"

# Capture stdout/stderr according to ../_shared/agent-cli.md
```

## Following Up
- After every `opencode run` command, immediately use `the current host's user-question or approval mechanism` to confirm next steps, collect clarifications, or decide whether to resume with `--continue`.
- When resuming, the session automatically uses the same model and agent from the original session.
- Restate the chosen model and agent when proposing follow-up actions.

## Error Handling
- Stop and report failures whenever `opencode --version` or an `opencode` command exits non-zero; request direction before retrying.
- Use `opencode debug` for troubleshooting if needed.
- Always validate OpenCode's output for security vulnerabilities (XSS, injection) before using.
