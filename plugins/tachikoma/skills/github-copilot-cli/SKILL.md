---
name: github-copilot-cli
description: Use when the user asks to run GitHub Copilot CLI in non-interactive mode or references Copilot CLI for AI-assisted coding, file editing, or shell commands.
---

# GitHub Copilot CLI Skill Guide

Before running Copilot CLI, follow the shared logging and summary protocol in `../_shared/agent-cli.md`.

## Running a Task
1. Verify installation: `command -v copilot`
2. Select the permission level required for the task. Default to minimal permissions for analysis. For implementation/editing tasks, first use `superpowers:using-git-worktrees` to create a fresh git worktree, then run Copilot there with write-capable permissions when approved.
3. **Always use `the current host's user-question or approval mechanism` before using `--allow-all`, `--yolo`, or `--allow-all-tools`.**
4. Assemble the command with the appropriate options:
   - `-p, --prompt <text>` - Execute prompt in non-interactive mode
   - `--model <model>` - Set the AI model to use
   - `--effort, --reasoning-effort <low|medium|high|xhigh>` - Reasoning effort
   - `--continue` - Resume most recent session
   - `--resume[=sessionId]` - Resume previous session (optionally by ID)
   - `--allow-all` - Enable all permissions (tools, paths, URLs)
   - `--yolo` - Alias for --allow-all
   - `--allow-all-tools` - Allow all tools to run automatically
   - `--allow-all-paths` - Allow access to any path
   - `--add-dir <directory>` - Add directory to allowed list
   - `--allow-tool[=tools...]` - Allow specific tools without confirmation
   - `--output-format <text|json>` - Output format
   - `-s, --silent` - Output only agent response (for scripting)
5. Do not suppress stderr. Capture stdout and stderr into `full.md`, and require the prompt to write `summary.md`.
6. Run the command, inspect the full log and summary, and summarize the outcome for the user.

### Quick Reference
| Use case | Command pattern |
| --- | --- |
| Non-interactive prompt | `copilot -p "your prompt"` |
| Auto-approve all in fresh worktree only | `copilot -p "prompt" --allow-all` |
| Auto-approve tools in fresh worktree only | `copilot -p "prompt" --allow-all-tools` |
| Continue last session | `copilot --continue` |
| Resume specific session | `copilot --resume=<session-id>` |
| With specific model | `copilot --model <model> -p "prompt"` |
| With specific effort | `copilot --effort high -p "prompt"` |
| Add directory | `copilot --add-dir /path -p "prompt"` |
| JSON output (silent) | `copilot -p "prompt" --output-format json -s` |

### Permission Levels
| Option | Permissions | Use Case |
| --- | --- | --- |
| (none) | Ask for confirmation | General use, safest |
| `--allow-all-tools` | Auto-approve all tools | Making changes in a fresh worktree |
| `--allow-all-paths` | Access any path | Avoid unless explicitly required; never use in main tree |
| `--allow-all` / `--yolo` | All permissions enabled | Full access in a fresh worktree |

### Example Commands

```bash
# Non-interactive with a prompt
copilot -p "Fix the bug in src/main.js"

# Non-interactive with auto-approve all permissions in a fresh worktree only
copilot -p "Refactor the utils module" --allow-all

# Non-interactive with auto-approve tools only in a fresh worktree only
copilot -p "Update dependencies" --allow-all-tools

# Continue last session
copilot --continue

# With specific reasoning effort
copilot --effort high -p "Analyze this codebase"

# Capture stdout/stderr according to ../_shared/agent-cli.md
```

## Following Up
- After every `copilot` command, immediately use `the current host's user-question or approval mechanism` to confirm next steps, collect clarifications, or decide whether to resume with `--continue`.
- When resuming, the session automatically uses the same model and permissions from the original session.
- Restate the chosen model and permissions when proposing follow-up actions.

## Error Handling
- Stop and report failures whenever `copilot --version` or a `copilot` command exits non-zero; request direction before retrying.
- Before you use high-impact flags (`--allow-all`, `--yolo`, `--allow-all-tools`) ask the user for permission using the current host's user-question or approval mechanism unless it was already given.
- When output includes warnings or partial results, summarize them and ask how to adjust using `the current host's user-question or approval mechanism`.
- Always validate Copilot's output and any generated shell commands for security vulnerabilities (XSS, injection) before execution.
