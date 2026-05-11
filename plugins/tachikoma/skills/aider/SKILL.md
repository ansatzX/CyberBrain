---
name: aider
description: Use when the user asks to run Aider CLI in non-interactive mode or references Aider for AI pair programming, code editing, or git-integrated development.
---

# Aider Skill Guide

Before running Aider, follow the shared logging and summary protocol in `../_shared/agent-cli.md`.

## Running a Task
1. Verify installation: `command -v aider`
2. Check if we're in a git repository (Aider works best with git).
3. **Always use `the current host's user-question or approval mechanism` before using `--yes-always`.**
4. Assemble the command with the appropriate options:
   - `--model <MODEL>` - Model to use (or use shortcuts: `--opus`, `--sonnet`, `--haiku`, `--4o`, `--mini`)
   - `--message "prompt"` - Run with a specific message/command (required for non-interactive)
   - `--dry-run` - Preview changes without applying
   - `--yes-always` - Auto-approve all changes (use with caution)
   - `--edit-format <diff|whole>` - Edit format preference
   - `--no-git` - Disable git integration
   - `--no-auto-commits` - Disable automatic commits
   - Files to edit can be specified as arguments
5. Default to `--dry-run` for analysis. For implementation tasks, first use `superpowers:using-git-worktrees` to create a fresh git worktree, then run Aider there with editing enabled when approved.
6. Do not suppress stderr. Capture stdout and stderr into `full.md`, and require the prompt to write `summary.md`.
7. Run the command, inspect the full log and summary, and summarize the outcome for the user.

### Quick Reference
| Use case | Command pattern |
| --- | --- |
| Batch edit in fresh worktree only | `aider --message "prompt" [file.py]` |
| Claude Opus | `aider --opus --message "prompt"` |
| Claude Sonnet | `aider --sonnet --message "prompt"` |
| Claude Haiku | `aider --haiku --message "prompt"` |
| GPT-4o | `aider --4o --message "prompt"` |
| Dry run (preview) | `aider --dry-run --message "prompt"` |
| Auto-approve all in fresh worktree only | `aider --yes-always --message "prompt"` |
| Show repo map | `aider --show-repo-map` |

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
# Batch edit in a fresh worktree only
aider --message "Add error handling to the API endpoint" src/api.py

# Use Claude Opus
aider --opus --message "Refactor the utils module" src/utils.py

# Dry run to preview changes
aider --dry-run --message "Fix the bug" src/app.py

# Auto-approve all changes in a fresh worktree only
aider --yes-always --message "Update dependencies"

# Capture stdout/stderr according to ../_shared/agent-cli.md
```

## Following Up
- After every `aider` command, immediately use `the current host's user-question or approval mechanism` to confirm next steps, collect clarifications, or decide whether to continue.
- If you need to continue the conversation, you can run aider again with the same files.
- Check git history to see what changes were made: `git diff HEAD^ HEAD`
- Restate the chosen model when proposing follow-up actions.

## Error Handling
- Stop and report failures whenever `aider --version` or an `aider` command exits non-zero; request direction before retrying.
- Before you use high-impact flags (`--yes-always`) ask the user for permission using the current host's user-question or approval mechanism unless it was already given.
- When output includes warnings or partial results, summarize them and ask how to adjust using `the current host's user-question or approval mechanism`.
- Always review the git commits created by Aider for security vulnerabilities (XSS, injection) before pushing.
