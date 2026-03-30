---
name: kimi-cli
description: Wield Kimi CLI as a powerful auxiliary tool for AI-assisted coding, agent tasks, ACP server, and web interface
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---

# Kimi CLI Skill Guide (v1.27.0)

## When to Use Kimi

| Use Case | Why Kimi |
| --- | --- |
| AI-assisted coding | Interactive terminal agent with file editing |
| Session resumption | Continue work with `--continue` or `--session` |
| Non-interactive mode | `--print` for batch operations (implies --yolo) |
| ACP server | `kimi acp` for editor integration |
| Web interface | `kimi web` for browser-based interaction |
| Built-in agents | Default and Okabe agents available |

**When NOT to use**: Simple quick tasks (overhead not worth it), interactive refinement where immediate feedback is needed.

## Running a Task

1. Verify installation: `command -v kimi`
2. Select the mode required for the task; default to interactive unless non-interactive is needed.
3. **Always use `AskUserQuestion` before using `-y, --yolo, --yes` or `--print` modes (they auto-approve actions).**
4. Assemble the command with the appropriate options:
   - `-p, --prompt, --command <text>` - User prompt to the agent
   - `-C, --continue` - Continue previous session for working directory
   - `-S, --session <id>` - Session ID to resume
   - `-m, --model <model>` - LLM model to use
   - `-y, --yolo, --yes` - Automatically approve all actions (use with caution)
   - `--print` - Run in print mode (non-interactive, implies --yolo)
   - `--quiet` - Alias for --print with text output and final message only
   - `-w, --work-dir <directory>` - Working directory for the agent
   - `--add-dir <directory>` - Add additional directory to workspace scope
   - `--agent <default|okabe>` - Builtin agent specification
   - `--thinking, --no-thinking` - Enable/disable thinking mode
   - `kimi acp` - Run as ACP server
   - `kimi web` - Run web interface
   - `kimi mcp` - Manage MCP server configurations
5. **Important**: By default, append `2>/dev/null` to all `kimi` commands to suppress thinking tokens (stderr). Only show stderr if the user explicitly requests to see thinking tokens or if debugging is needed.

### Quick Reference

| Use case | Mode | Command pattern |
| --- | --- | --- |
| Interactive mode | interactive | `kimi` |
| With prompt | prompt | `kimi --prompt "your prompt"` |
| Non-interactive print mode | print | `kimi --print --prompt "prompt" 2>/dev/null` |
| Quiet mode (final msg only) | quiet | `kimi --quiet --prompt "prompt" 2>/dev/null` |
| Continue session | resume | `kimi --continue` |
| Resume specific session | resume-id | `kimi --session <session-id>` |
| Yolo mode (auto-approve) | yolo | `kimi --yolo --prompt "prompt" 2>/dev/null` |
| With specific model | model | `kimi --model <model> --prompt "prompt" 2>/dev/null` |
| Additional directory | add-dir | `kimi --add-dir /path/to/project` |
| Okabe agent | okabe | `kimi --agent okabe` |
| ACP server | acp | `kimi acp` |
| Web interface | web | `kimi web` |

### Example Commands

```bash
# Interactive mode
kimi

# With a prompt
kimi --prompt "Fix the bug in src/main.py"

# Non-interactive print mode (auto-approves)
kimi --print --prompt "Refactor the utils module" 2>/dev/null

# Continue last session
kimi --continue

# With yolo mode (auto-approve everything)
kimi --yolo --prompt "Add tests to the project" 2>/dev/null

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
