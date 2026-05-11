---
name: kiro-cli
description: Use when the user asks to run Kiro CLI in non-interactive mode or references Kiro for AI chat, shell translation, or agent management.
---

# Kiro CLI Skill Guide

Before running Kiro, follow the shared logging and summary protocol in `../_shared/agent-cli.md`.

## Running a Task
1. Verify installation: `command -v kiro-cli`
2. Select the mode required for the task; default to `--no-interactive` mode for non-interactive use. Default to untrusted/read-only-style operation for analysis. For implementation tasks, first use `superpowers:using-git-worktrees` to create a fresh git worktree, then run Kiro there with trusted tools when approved.
3. **Always use `the current host's user-question or approval mechanism` before using `--trust-all-tools` or executing generated shell commands.**
4. Assemble the command with the appropriate options:
   - `--agent <AGENT_NAME>` - Use specific agent
   - `--model <MODEL>` - Model to use
   - `--no-interactive` - Run without user input (required for non-interactive)
   - `-a, --trust-all-tools` - Trust all tools without confirmation
   - `--trust-tools <TOOL_NAMES>` - Trust specific tools only (comma-separated)
   - `-r, --resume` - Resume most recent conversation
5. Do not suppress stderr. Capture stdout and stderr into `full.md`, and require the prompt to write `summary.md`.
6. Run the command, inspect the full log and summary, and summarize the outcome for the user.

### Quick Reference
| Use case | Command pattern |
| --- | --- |
| Non-interactive chat | `kiro-cli chat "your input" --no-interactive` |
| With specific agent | `kiro-cli chat --agent <agent> "input" --no-interactive` |
| Trust all tools in fresh worktree only | `kiro-cli chat "input" --trust-all-tools --no-interactive` |
| Trust write tools in fresh worktree only | `kiro-cli chat "input" --trust-tools=fs_read,fs_write --no-interactive` |
| Resume conversation | `kiro-cli chat --resume --no-interactive` |
| List models | `kiro-cli chat --list-models` |
| List sessions | `kiro-cli chat --list-sessions` |

### Tool Trust Options
| Option | Description | Use Case |
| --- | --- | --- |
| (none) | Ask for confirmation | Safest, general use |
| `--trust-tools <tools>` | Trust specific tools | Controlled access; write tools require a fresh worktree |
| `--trust-all-tools` | Trust all tools | Full access in a fresh worktree |

### Example Commands

```bash
# Non-interactive chat
kiro-cli chat "Explain this code" --no-interactive

# With specific agent and trust all tools in a fresh worktree only
kiro-cli chat --agent builder "Fix the bug" --trust-all-tools --no-interactive

# Resume conversation
kiro-cli chat --resume --no-interactive

# Capture stdout/stderr according to ../_shared/agent-cli.md
```

## Following Up
- After every `kiro-cli` command, immediately use `the current host's user-question or approval mechanism` to confirm next steps, collect clarifications, or decide whether to resume with `--resume`.
- For shell translation, always confirm execution with the user before running the command.
- Restate the chosen agent and tool trust options when proposing follow-up actions.

## Error Handling
- Stop and report failures whenever `kiro-cli --version` or a `kiro-cli` command exits non-zero; request direction before retrying.
- Use `kiro-cli doctor` to debug installation issues if needed.
- Before you use high-impact flags (`--trust-all-tools`) ask the user for permission using the current host's user-question or approval mechanism unless it was already given.
- Never execute a generated shell command without explicit user approval.
- Always validate Kiro's output for security vulnerabilities (XSS, injection) before using.
