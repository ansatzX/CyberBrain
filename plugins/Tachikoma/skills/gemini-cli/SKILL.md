---
name: gemini-cli
description: Wield Google's Gemini CLI as a powerful auxiliary tool for code generation, review, analysis, and web research. Use when tasks benefit from a second AI perspective, current web information via Google Search, codebase architecture analysis, or parallel code generation. Also use when user explicitly requests Gemini operations.
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
---

# Gemini CLI Skill Guide

## When to Use Gemini

| Use Case | Why Gemini |
| --- | --- |
| Current web information | `google_web_search` - real-time Google Search |
| Codebase architecture analysis | `codebase_investigator` - deep analysis tool |
| Second opinion / code review | Different AI perspective catches different bugs |
| Parallel code generation | Offload tasks while continuing other work |

**When NOT to use**: Simple quick tasks (overhead not worth it), interactive refinement, context already understood.

## Running a Task

1. Verify installation: `command -v gemini`
2. Select the mode required for the task; default to read-only (no `--yolo`) unless edits are necessary.
3. **Always use `AskUserQuestion` before using `--yolo` or `-s` flags.** These modes allow file writes or sandboxed execution - get explicit user approval first.
4. Assemble the command with appropriate options:
   - `-m, --model <MODEL>` - Model selection
   - `-y, --yolo` - Auto-approve all tool calls (enables writes)
   - `-s, --sandbox` - Run in Docker isolation
   - `-o, --output-format <text|json>` - Output format
5. **Important**: `gemini "prompt" -o json 2>/dev/null | jq -r '.response'` to suppress stderr noise and extract the json response, unless specified by the user.

### Critical Note
YOLO mode does NOT prevent planning prompts. Use forceful language: "Apply now", "Start immediately", "Do this without asking for confirmation".

## Quick Reference

| Use case | Mode | Command pattern |
| --- | --- | --- |
| Read-only analysis | read-only | `gemini "..." -o json 2>/dev/null \| jq -r '.response'` |
| Apply local edits | write | `gemini "..." --yolo -o json 2>/dev/null \| jq -r '.response'` |
| Sandboxed write | sandbox | `gemini "..." --yolo --sandbox -o json 2>/dev/null \| jq -r '.response'` |

### Example Commands

```bash
# Read-only
gemini "Review src/ for bugs" -o json 2>/dev/null | jq -r '.response'

# Write mode
gemini "Fix bug in file.py. Apply now." --yolo -o json 2>/dev/null | jq -r '.response'

# If redirection fails, wrap in bash -lc
bash -lc 'gemini "prompt" -o json 2>/dev/null | jq -r ".response"'
```

## Following Up

- Resume: `echo "follow-up" | gemini -r latest -o json 2>/dev/null | jq -r '.response'`
- List sessions: `gemini --list-sessions`

## Error Handling

- **Rate limit**: CLI auto-retries with backoff. Use `-m gemini-2.5-flash` for lower priority tasks.
- **Command failure**: Check with `gemini --version`, use `--debug` for details.
- **Always validate** Gemini's output for security vulnerabilities (XSS, injection) before using.
