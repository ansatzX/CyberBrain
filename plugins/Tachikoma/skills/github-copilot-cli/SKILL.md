---
name: github-copilot-cli
description: Use when the user asks to run GitHub Copilot CLI in non-interactive mode or references Copilot CLI for AI-assisted coding, file editing, or shell commands.
---

# GitHub Copilot CLI Skill Guide

## Running a Task
1. Verify installation: `command -v copilot`
2. Select the permission level required for the task; default to minimal permissions unless broader access is needed.
3. **Always use `AskUserQuestion` before using `--allow-all`, `--yolo`, or `--allow-all-tools`.**
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
5. **IMPORTANT**: By default, append `2>/dev/null` to all `copilot` commands to suppress stderr noise. Only show stderr if the user explicitly requests it or if debugging is needed.
6. Run the command, capture stdout/stderr (filtered as appropriate), and summarize the outcome for the user.

### Quick Reference
| Use case | Command pattern |
| --- | --- |
| Non-interactive prompt | `copilot -p "your prompt" 2>/dev/null` |
| With auto-approve all | `copilot -p "prompt" --allow-all 2>/dev/null` |
| With auto-approve tools only | `copilot -p "prompt" --allow-all-tools 2>/dev/null` |
| Continue last session | `copilot --continue 2>/dev/null` |
| Resume specific session | `copilot --resume=<session-id> 2>/dev/null` |
| With specific model | `copilot --model <model> -p "prompt" 2>/dev/null` |
| With specific effort | `copilot --effort high -p "prompt" 2>/dev/null` |
| Add directory | `copilot --add-dir /path -p "prompt" 2>/dev/null` |
| JSON output (silent) | `copilot -p "prompt" --output-format json -s 2>/dev/null` |

### Permission Levels
| Option | Permissions | Use Case |
| --- | --- | --- |
| (none) | Ask for confirmation | General use, safest |
| `--allow-all-tools` | Auto-approve all tools | Making changes |
| `--allow-all-paths` | Access any path | Full file system access |
| `--allow-all` / `--yolo` | All permissions enabled | Full access, no confirmation |

### Example Commands

```bash
# Non-interactive with a prompt
copilot -p "Fix the bug in src/main.js" 2>/dev/null

# Non-interactive with auto-approve all permissions
copilot -p "Refactor the utils module" --allow-all 2>/dev/null

# Non-interactive with auto-approve tools only
copilot -p "Update dependencies" --allow-all-tools 2>/dev/null

# Continue last session
copilot --continue 2>/dev/null

# With specific reasoning effort
copilot --effort high -p "Analyze this codebase" 2>/dev/null

# If redirection fails, wrap in bash -lc
bash -lc 'copilot -p "prompt" 2>/dev/null'
```

## Following Up
- After every `copilot` command, immediately use `AskUserQuestion` to confirm next steps, collect clarifications, or decide whether to resume with `--continue`.
- When resuming, the session automatically uses the same model and permissions from the original session.
- Restate the chosen model and permissions when proposing follow-up actions.

## Error Handling
- Stop and report failures whenever `copilot --version` or a `copilot` command exits non-zero; request direction before retrying.
- Before you use high-impact flags (`--allow-all`, `--yolo`, `--allow-all-tools`) ask the user for permission using AskUserQuestion unless it was already given.
- When output includes warnings or partial results, summarize them and ask how to adjust using `AskUserQuestion`.
- Always validate Copilot's output and any generated shell commands for security vulnerabilities (XSS, injection) before execution.
