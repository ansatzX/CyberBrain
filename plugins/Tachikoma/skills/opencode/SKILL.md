---
name: opencode
description: Use when the user asks to run OpenCode CLI (codex exec, codex resume) or references OpenCode for AI-assisted coding, TUI, or agent-based development
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---

# OpenCode Skill Guide (v1.3.0)

## When to Use OpenCode

| Use Case | Why OpenCode |
| --- | --- |
| AI-assisted coding | Interactive TUI interface for natural coding flow |
| Agent-based development | ACP (Agent Client Protocol) support |
| GitHub PR integration | `opencode pr` for PR review and modification |
| Session management | Resume sessions with `--continue` or `--session` |
| Model switching | Multiple AI providers and models supported |

**When NOT to use**: Simple quick tasks (overhead not worth it), interactive refinement where immediate feedback is needed.

## Running a Task

1. Verify installation: `command -v opencode`
2. Select the mode required for the task; default to interactive TUI unless non-interactive is needed.
3. **Always use `AskUserQuestion` before starting interactive sessions for simple tasks.**
4. Assemble the command with the appropriate options:
   - `-m, --model <provider/model>` - Model selection
   - `-c, --continue` - Continue the last session
   - `-s, --session <id>` - Session id to continue
   - `--prompt <prompt>` - Prompt to use
   - `--agent <agent>` - Agent to use
5. **Important**: For TUI mode, inform the user it will launch an interactive interface.

### Quick Reference

| Use case | Mode | Command pattern |
| --- | --- | --- |
| Interactive TUI | interactive | `opencode [/path/to/project]` |
| Run with prompt | non-interactive | `opencode run "your prompt here"` |
| Continue last session | resume | `opencode --continue` |
| GitHub PR mode | PR | `opencode pr 123` |
| List models | info | `opencode models [provider]` |
| Web interface | web | `opencode web` |

## Following Up

- After every `opencode run` command, immediately use `AskUserQuestion` to confirm next steps, collect clarifications, or decide whether to resume with `--continue`.
- When resuming, restate that the session will continue from where it left off.
- Restate the chosen model and mode when proposing follow-up actions.

## Error Handling

- Stop and report failures whenever `opencode --version` or an `opencode` command exits non-zero; request direction before retrying.
- Use `opencode debug` for troubleshooting if needed.
- Always validate OpenCode's output for security vulnerabilities (XSS, injection) before using.
