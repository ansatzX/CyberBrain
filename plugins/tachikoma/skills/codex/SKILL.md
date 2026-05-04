---
name: codex
description: Use when the user asks to run Codex CLI (codex exec, codex resume) or references OpenAI Codex for code analysis, code review, or automated editing
---

# Codex Skill Guide

## Running a Task
1. Ask the user (via `AskUserQuestion`) which profile, model, and reasoning effort to run in a **single prompt**.
   - Profile flag: use `-p <profile_name>` only when the user requests a non-default profile. When omitted, Codex uses the default profile.
   - Default profile: use `gpt-5.4` with `high` or `gpt-5.5` with `high`. Default to `gpt-5.3-codex` if the user has no model preference.
   - `-p llm_router`: only use `deepseek-v4-pro` with `xhigh`.
   - `-p aihubmix`: only use `gpt-5.4` with `high` or `gpt-5.5` with `high`.
2. Select the sandbox mode required for the task; default to `--sandbox read-only` unless edits or network access are necessary.
3. Assemble the command with the appropriate options:
   - `-p, --profile <profile_name>`
   - `-m, --model <MODEL>`
   - `--config model_reasoning_effort="<xhigh|high|medium>"`
   - `--sandbox <read-only|workspace-write|danger-full-access>`
   - `--full-auto`
   - `-C, --cd <DIR>`
   - `--skip-git-repo-check`
4. Always use --skip-git-repo-check.
5. When continuing a previous session, use `codex exec --skip-git-repo-check resume --last` via stdin. When resuming don't use any configuration flags unless explicitly requested by the user e.g. if he specifies the profile, model, or reasoning effort when requesting to resume a session. Resume syntax: `echo "your prompt here" | codex exec --skip-git-repo-check resume --last 2>/dev/null`. All flags have to be inserted between `exec` and `resume`.
6. When reviewing uncommitted changes, use `(echo "Review the following uncommitted diff."; git diff) | codex exec --skip-git-repo-check - 2>/dev/null` and other flags as needed between `exec` and `--skip-git-repo-check`.
7. **IMPORTANT**: By default, append `2>/dev/null` to all `codex exec` commands to suppress thinking tokens (stderr). Only show stderr if the user explicitly requests to see thinking tokens or if debugging is needed.
8. Run the command, capture stdout/stderr (filtered as appropriate), and summarize the outcome for the user.
9. **After Codex completes**, inform the user: "You can resume this Codex session at any time by saying 'codex resume' or asking me to continue with additional analysis or changes."

### Quick Reference
| Use case | Sandbox mode | Key flags |
| --- | --- | --- |
| Read-only review or analysis | `read-only` | `--sandbox read-only 2>/dev/null` |
| Apply local edits | `workspace-write` | `--sandbox workspace-write --full-auto 2>/dev/null` |
| Permit network or broad access | `danger-full-access` | `--sandbox danger-full-access --full-auto 2>/dev/null` |
| Resume recent session | Inherited from original | `echo "prompt" \| codex exec --skip-git-repo-check resume --last 2>/dev/null` (no flags allowed) |
| Run from another directory | Match task needs | `-C <DIR>` plus other flags `2>/dev/null` |
| Use a named profile | Match task needs | `-p <profile_name>` before model/sandbox flags |
| `llm_router` profile | Match task needs | `-p llm_router -m deepseek-v4-pro --config model_reasoning_effort="xhigh"` |
| `aihubmix` profile | Match task needs | `-p aihubmix -m <gpt-5.4|gpt-5.5> --config model_reasoning_effort="high"` |

## Following Up
- After every `codex` command, immediately use `AskUserQuestion` to confirm next steps, collect clarifications, or decide whether to resume with `codex exec resume --last`.
- When resuming, pipe the new prompt via stdin: `echo "new prompt" | codex exec resume --last 2>/dev/null`. The resumed session automatically uses the same profile, model, reasoning effort, and sandbox mode from the original session.
- Restate the chosen profile, model, reasoning effort, and sandbox mode when proposing follow-up actions.

## Error Handling
- Stop and report failures whenever `codex --version` or a `codex exec` command exits non-zero; request direction before retrying.
- Before you use high-impact flags (`--full-auto`, `--sandbox danger-full-access`, `--skip-git-repo-check`) ask the user for permission using AskUserQuestion unless it was already given.
- When output includes warnings or partial results, summarize them and ask how to adjust using `AskUserQuestion`.
