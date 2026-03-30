---
name: kiro-cli
description: Wield Kiro CLI as a powerful auxiliary tool for AI chat, agent management, natural language to shell translation, and MCP integration
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---

# Kiro CLI Skill Guide (v1.28.3)

## When to Use Kiro

| Use Case | Why Kiro |
| --- | --- |
| AI chat assistant | Natural conversation in your terminal |
| AI agent management | Create, configure, and run AI agents |
| Natural language to shell | `translate` command for shell command generation |
| MCP integration | Built-in MCP server management |
| ACP server | Agent Client Protocol support |

**When NOT to use**: Simple quick tasks (overhead not worth it), interactive refinement where immediate feedback is needed.

## Running a Task

1. Verify installation: `command -v kiro-cli`
2. Select the mode required for the task; default to chat mode unless a specific subcommand is needed.
3. **Always use `AskUserQuestion` before executing any generated shell commands from the `translate` subcommand.**
4. Assemble the command with the appropriate options:
   - `--agent <AGENT_NAME>` - Launch chat with specific agent
   - `--tui` - Launch chat in TUI mode
   - `-v, --verbose` - Increase logging verbosity
5. **Important**: For shell translation, always show the generated command to the user for approval before execution.

### Quick Reference

| Use case | Mode | Command pattern |
| --- | --- | --- |
| AI chat (default) | chat | `kiro-cli chat` |
| Chat with specific agent | agent-chat | `kiro-cli --agent <agent-name>` |
| TUI mode | tui | `kiro-cli --tui` |
| Shell translation | translate | `kiro-cli translate "how to list files"` |
| Manage agents | agent | `kiro-cli agent` |
| Manage MCP | mcp | `kiro-cli mcp` |
| Open dashboard | dashboard | `kiro-cli dashboard` |
| Launch desktop app | launch | `kiro-cli launch` |

## Following Up

- After every `kiro-cli` command, immediately use `AskUserQuestion` to confirm next steps, collect clarifications, or decide whether to continue the conversation.
- For shell translation, always confirm execution with the user before running the command.
- If an interactive chat session was started, ask the user if they want to continue.

## Error Handling

- Stop and report failures whenever `kiro-cli --version` or a `kiro-cli` command exits non-zero; request direction before retrying.
- Use `kiro-cli doctor` to debug installation issues if needed.
- Never execute a generated shell command without explicit user approval.
- Always validate Kiro's output for security vulnerabilities (XSS, injection) before using.
