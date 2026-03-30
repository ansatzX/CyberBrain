---
name: github-copilot-cli
description: Wield GitHub Copilot CLI as a powerful auxiliary tool for AI-assisted coding, file editing, shell commands, and MCP integration
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---

# GitHub Copilot CLI Skill Guide (v1.0.12)

## When to Use GitHub Copilot CLI

| Use Case | Why Copilot CLI |
| --- | --- |
| AI-assisted coding | Interactive CLI with file editing capabilities |
| Shell command generation | Smart shell command creation and execution |
| Codebase exploration | Search and analyze code with AI assistance |
| MCP integration | Built-in MCP server support |
| Session resumption | Continue work with `--continue` or `--resume` |

**When NOT to use**: Simple quick tasks (overhead not worth it), interactive refinement where immediate feedback is needed.

## Running a Task

1. Verify installation: `command -v copilot`
2. Select the mode required for the task; default to interactive unless non-interactive is needed.
3. **Always use `AskUserQuestion` before using `--allow-all`, `--yolo`, or `--allow-all-tools`.**
4. Assemble the command with the appropriate options:
   - `-p, --prompt <text>` - Execute prompt in non-interactive mode
   - `-i, --interactive <prompt>` - Start interactive mode with prompt
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
5. **Important**: By default, append `2>/dev/null` to all `copilot` commands to suppress thinking tokens (stderr). Only show stderr if the user explicitly requests to see thinking tokens or if debugging is needed.

### Quick Reference

| Use case | Mode | Command pattern |
| --- | --- | --- |
| Interactive mode | interactive | `copilot` |
| Non-interactive prompt | non-interactive | `copilot -p "your prompt" 2>/dev/null` |
| Interactive with initial prompt | interactive-prompt | `copilot -i "your prompt"` |
| Continue session | resume | `copilot --continue` |
| Resume specific session | resume-id | `copilot --resume=<session-id>` |
| Non-interactive with auto-approve | auto | `copilot -p "prompt" --allow-all 2>/dev/null` |
| With specific model | model | `copilot --model gpt-5.2 -p "prompt" 2>/dev/null` |
| JSON output for scripting | json | `copilot -p "prompt" --output-format json -s 2>/dev/null` |

### Example Commands

```bash
# Interactive mode
copilot

# Non-interactive with a prompt
copilot -p "Fix the bug in src/main.js" 2>/dev/null

# Non-interactive with auto-approve all permissions
copilot -p "Refactor the utils module" --allow-all 2>/dev/null

# Continue last session
copilot --continue

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
