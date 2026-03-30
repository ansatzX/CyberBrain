---
name: aider
description: Use when the user asks to run Aider CLI or references Aider for AI pair programming, code editing, or git-integrated development
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---

# Aider Skill Guide (v0.86.2)

## When to Use Aider

| Use Case | Why Aider |
| --- | --- |
| AI pair programming | Interactive chat with git integration |
| Git-integrated edits | Automatic commits with meaningful messages |
| Multi-file changes | Coordinated edits across multiple files |
| Model flexibility | Support for Claude, GPT, and other models |
| Quick model shortcuts | `--opus`, `--sonnet`, `--haiku`, etc. |

**When NOT to use**: Simple quick tasks (overhead not worth it), trivial one-line changes where you don't want git commits.

## Running a Task

1. Verify installation: `command -v aider`
2. Check if we're in a git repository (Aider works best with git).
3. Select the mode required for the task; default to interactive mode unless batch mode is needed.
4. **Always use `AskUserQuestion` before using `--yes-always`.**
5. Assemble the command with the appropriate options:
   - `--model <MODEL>` - Model to use (or use shortcuts: `--opus`, `--sonnet`, `--haiku`, `--4o`, `--mini`)
   - `--message "prompt"` - Run with a specific message/command
   - `--dry-run` - Preview changes without applying
   - `--yes-always` - Auto-approve all changes (use with caution)
   - `--edit-format <diff|whole>` - Edit format preference
   - `--no-git` - Disable git integration
   - `--no-auto-commits` - Disable automatic commits
   - Files to edit can be specified as arguments
6. **Important**: By default, append `2>/dev/null` to all `aider` commands to suppress thinking tokens (stderr). Only show stderr if the user explicitly requests to see thinking tokens or if debugging is needed.

### Quick Reference

| Use case | Mode | Command pattern |
| --- | --- | --- |
| Interactive edit with files | interactive | `aider file1.py file2.js 2>/dev/null` |
| Batch edit with prompt | batch | `aider --message "prompt" file.py 2>/dev/null` |
| Claude Opus | opus | `aider --opus --message "prompt" 2>/dev/null` |
| Claude Sonnet | sonnet | `aider --sonnet --message "prompt" 2>/dev/null` |
| Claude Haiku | haiku | `aider --haiku --message "prompt" 2>/dev/null` |
| Dry run (preview) | dry-run | `aider --dry-run --message "prompt" 2>/dev/null` |
| Show repo map | info | `aider --show-repo-map 2>/dev/null` |

### Example Commands

```bash
# Interactive mode with specific files
aider src/main.py tests/test_main.py

# Batch mode with a prompt
aider --message "Add error handling to the API endpoint" src/api.py 2>/dev/null

# Use Claude Opus
aider --opus --message "Refactor the utils module" src/utils.py 2>/dev/null

# Dry run to preview changes
aider --dry-run --message "Fix the bug" src/app.py 2>/dev/null

# If redirection fails, wrap in bash -lc
bash -lc 'aider --message "prompt" file.py 2>/dev/null'
```

## Following Up

- After every `aider` command, immediately use `AskUserQuestion` to confirm next steps, collect clarifications, or decide whether to continue.
- If you need to continue the conversation, you can run aider again with the same files.
- Check git history to see what changes were made: `git diff HEAD^ HEAD`
- Restate the chosen model when proposing follow-up actions.

## Error Handling

- Stop and report failures whenever `aider --version` or an `aider` command exits non-zero; request direction before retrying.
- Before you use high-impact flags (`--yes-always`) ask the user for permission using AskUserQuestion unless it was already given.
- When output includes warnings or partial results, summarize them and ask how to adjust using `AskUserQuestion`.
- Always review the git commits created by Aider for security vulnerabilities (XSS, injection) before pushing.
