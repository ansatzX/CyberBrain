---
name: aider
description: Use when the user asks to run Aider CLI in non-interactive mode or references Aider for AI pair programming, code editing, or git-integrated development.
---

# Aider Skill Guide

## Running a Task
1. Verify installation: `command -v aider`
2. Check if we're in a git repository (Aider works best with git).
3. **Always use `AskUserQuestion` before using `--yes-always`.**
4. Assemble the command with the appropriate options:
   - `--model <MODEL>` - Model to use (or use shortcuts: `--opus`, `--sonnet`, `--haiku`, `--4o`, `--mini`)
   - `--message "prompt"` - Run with a specific message/command (required for non-interactive)
   - `--dry-run` - Preview changes without applying
   - `--yes-always` - Auto-approve all changes (use with caution)
   - `--edit-format <diff|whole>` - Edit format preference
   - `--no-git` - Disable git integration
   - `--no-auto-commits` - Disable automatic commits
   - Files to edit can be specified as arguments
5. **IMPORTANT**: By default, append `2>/dev/null` to all `aider` commands to suppress stderr noise. Only show stderr if the user explicitly requests it or if debugging is needed.
6. Run the command, capture stdout/stderr (filtered as appropriate), and summarize the outcome for the user.

### Quick Reference
| Use case | Command pattern |
| --- | --- |
| Batch edit with prompt | `aider --message "prompt" [file.py] 2>/dev/null` |
| Claude Opus | `aider --opus --message "prompt" 2>/dev/null` |
| Claude Sonnet | `aider --sonnet --message "prompt" 2>/dev/null` |
| Claude Haiku | `aider --haiku --message "prompt" 2>/dev/null` |
| GPT-4o | `aider --4o --message "prompt" 2>/dev/null` |
| Dry run (preview) | `aider --dry-run --message "prompt" 2>/dev/null` |
| Auto-approve all | `aider --yes-always --message "prompt" 2>/dev/null` |
| Show repo map | `aider --show-repo-map 2>/dev/null` |

### Model Shortcuts
| Shortcut | Model |
| --- | --- |
| `--opus` | Claude Opus |
| `--sonnet` | Claude Sonnet |
| `--haiku` | Claude Haiku |
| `--4o` | GPT-4o |
| `--mini` | GPT-4o Mini |

### Example Commands

```bash
# Batch mode with a prompt
aider --message "Add error handling to the API endpoint" src/api.py 2>/dev/null

# Use Claude Opus
aider --opus --message "Refactor the utils module" src/utils.py 2>/dev/null

# Dry run to preview changes
aider --dry-run --message "Fix the bug" src/app.py 2>/dev/null

# Auto-approve all changes
aider --yes-always --message "Update dependencies" 2>/dev/null

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
