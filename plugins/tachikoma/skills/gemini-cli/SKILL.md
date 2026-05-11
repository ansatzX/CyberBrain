---
name: gemini-cli
description: Use when tasks benefit from Gemini CLI for code generation, review, analysis, web research, a second AI perspective, codebase architecture analysis, parallel code generation, or when the user explicitly requests Gemini operations.
---

# Gemini CLI Skill Guide

Before running Gemini, follow the shared logging and summary protocol in `../_shared/agent-cli.md`.

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
2. Select the mode required for the task. Default to read-only. For implementation/editing tasks, first use `superpowers:using-git-worktrees` to create a fresh git worktree, then run Gemini there with write-capable flags such as `--yolo` when approved.
3. **Always use `the current host's user-question or approval mechanism` before using `--yolo` or `-s` flags.** These modes allow file writes or sandboxed execution - get explicit user approval first.
4. Assemble the command with appropriate options:
   - `-m, --model <MODEL>` - Model selection
   - `-y, --yolo` - Auto-approve all tool calls (enables writes)
   - `-s, --sandbox` - Run in Docker isolation
   - `-o, --output-format <text|json>` - Output format
5. Do not suppress stderr. Capture stdout and stderr into `full.md`, and require the prompt to write `summary.md`. Use `-o json` only when structured output is needed; preserve the raw JSON in the full log.

### Critical Note
YOLO mode does NOT prevent planning prompts. Use forceful language: "Apply now", "Start immediately", "Do this without asking for confirmation".

## Quick Reference

| Use case | Mode | Command pattern |
| --- | --- | --- |
| Read-only analysis | read-only | `gemini "..." -o json` |
| Apply edits in fresh worktree only | write | `gemini "..." --yolo -o json` |
| Sandboxed write in fresh worktree only | sandbox | `gemini "..." --yolo --sandbox -o json` |

### Example Commands

```bash
# Read-only
gemini "Review src/ for bugs" -o json

# Write mode in a fresh worktree only
gemini "Fix bug in file.py. Apply now." --yolo -o json

# Capture stdout/stderr according to ../_shared/agent-cli.md
```

## Following Up

- Resume: `echo "follow-up" | gemini -r latest -o json`
- List sessions: `gemini --list-sessions`

## Error Handling

- **Rate limit**: CLI auto-retries with backoff. Use `-m gemini-2.5-flash` for lower priority tasks.
- **Command failure**: Check with `gemini --version`, use `--debug` for details.
- **Always validate** Gemini's output for security vulnerabilities (XSS, injection) before using.
