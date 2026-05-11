# Collaborative Multi-Agent Fix

You must fix `$ARGUMENTS` using **codex**, **gemini-cli**, and an independent subagent. If the user explicitly asks for other CLI agents such as opencode, qwen, cline-cli, aider, github-copilot-cli, kiro-cli, or kimi-cli, include them as well.

## Requirements

- Required skills: `tachikoma:codex`, `tachikoma:gemini-cli`, and the relevant CLI skills for any extra tools requested by the user.
- Required collaboration: one independent code-review or analysis subagent.
- First expand `$ARGUMENTS` into a clear shared problem statement without changing its meaning. Copy the user's text verbatim inside that statement.
- Use the shared Tachikoma agent CLI protocol at `plugins/tachikoma/skills/_shared/agent-cli.md`: every CLI run must produce `full.md` and `summary.md`.

## Permissions And Worktrees

- After expanding the shared problem statement, use `superpowers:using-git-worktrees` to create a fresh collaboration worktree before launching CLI agents.
- Run all external CLI agents from that collaboration worktree, including read-only analysis and review commands, so every agent sees the same isolated filesystem state.
- Analysis and review CLI runs must use read-only, plan, dry-run, or equivalent safe modes.
- If any external CLI agent will modify code or workspace state, enable write-capable flags only inside the collaboration worktree.
- Do not grant write-capable CLI permissions in the main working tree.
- The main agent implements or integrates the selected fix in the collaboration worktree unless the user explicitly asks to apply it elsewhere.
- Do not commit unless the user asks.

## Asynchronous Execution

- When launching more than one CLI agent, start every CLI command asynchronously in the background.
- Do not start one CLI, wait for it, then start the next.
- After all CLI commands and subagents are launched, wait for every one of them to finish before comparing results.
- Treat each phase as launch-all-then-wait-all: analysis, optional implementation delegation, and review.
- In Claude Code-style hosts, use background Bash and `TaskOutput` or the host equivalent.
- In Codex-style hosts, use `exec_command` with a yielded/background shell session where available, then `write_stdin` or the host equivalent to poll completion.
- Capture stdout and stderr for each background command according to `_shared/agent-cli.md`; do not use `2>/dev/null`.

## Workflow

1. Create the collaboration worktree with `superpowers:using-git-worktrees`; use it as the working directory for all following CLI runs.
2. Ask CLI agents and the subagent to analyze the shared problem statement and propose fix plans.
   - All CLI analysis commands run in read-only/safe mode.
   - All CLI commands start asynchronously before waiting.
   - Every CLI prompt must include the required summary section from `_shared/agent-cli.md`.
   - Example command shapes:
     - codex: `echo "<analysis prompt>" | codex exec --skip-git-repo-check --sandbox read-only -`
     - gemini-cli: `gemini "<analysis prompt>" -o json`
     - opencode: `opencode run --agent plan "<analysis prompt>"`
     - qwen: `qwen "<analysis prompt>" --approval-mode plan`
     - cline-cli: `cline -p "<analysis prompt>"`
     - aider: `aider --dry-run --message "<analysis prompt>"`
     - github-copilot-cli: `copilot -p "<analysis prompt>"`
     - kiro-cli: `kiro-cli chat "<analysis prompt>" --no-interactive`
     - kimi-cli: `kimi --print --prompt "<analysis prompt>"`
3. Wait for all background CLI runs and the subagent to finish.
4. Read every `summary.md` and inspect relevant sections of `full.md`.
5. Compare plans, summarize tradeoffs, and ask only necessary user questions.
6. Implement the selected fix in the collaboration worktree, or delegate implementation to an external CLI agent only with write-capable flags inside that same worktree.
7. Ask CLI agents and the subagent to review the uncommitted diff from the collaboration worktree.
   - Review commands are read-only/safe and asynchronous.
   - Example command shapes:
     - codex: `(echo "Review the following uncommitted diff."; git diff) | codex exec --skip-git-repo-check --sandbox read-only -`
     - gemini-cli: `(echo "Review the following uncommitted diff."; git diff) | gemini -o json`
     - opencode: `(echo "Review the following uncommitted diff."; git diff) | opencode run --agent plan -`
     - qwen: `(echo "Review the following uncommitted diff."; git diff) | qwen --approval-mode plan -`
     - cline-cli: `(echo "Review the following uncommitted diff."; git diff) | cline -p -`
     - aider: `aider --dry-run --message "Review the following uncommitted diff." $(git diff --name-only)`
     - github-copilot-cli: `(echo "Review the following uncommitted diff."; git diff) | copilot -p -`
     - kiro-cli: `(echo "Review the following uncommitted diff."; git diff) | kiro-cli chat --no-interactive -`
     - kimi-cli: `(echo "Review the following uncommitted diff."; git diff) | kimi --print --prompt -`
8. Read all review summaries and full logs, then address valid findings.
9. Repeat implementation and review until reviewers are satisfied or 5 rounds are reached.
10. If no consensus after 5 rounds, report the disputed points, evidence, and remaining risk.
