# TDD Debug Protocol

You must debug `$ARGUMENTS` using **codex**, **gemini-cli**, a test-design subagent, and a code-review subagent. If the user explicitly asks for other CLI agents such as opencode, qwen, cline-cli, aider, github-copilot-cli, kiro-cli, or kimi-cli, include them as well.

## Requirements

- Required skills: `tachikoma:codex`, `tachikoma:gemini-cli`, and the relevant CLI skills for any extra tools requested by the user.
- Required collaboration: one independent test-design subagent and one independent code-review subagent.
- First expand `$ARGUMENTS` into a clear shared bug statement without changing its meaning. Copy the user's text verbatim inside that statement.
- Use the shared Tachikoma agent CLI protocol at `plugins/tachikoma/skills/_shared/agent-cli.md`: every CLI run must produce `full.md` and `summary.md`.
- The reproducing test must fail before the fix and pass after the fix.

## Permissions And Worktrees

- After expanding the shared bug statement, use `superpowers:using-git-worktrees` to create a fresh debugging worktree before launching CLI agents.
- Run all external CLI agents from that debugging worktree, including read-only analysis and review commands, so every agent sees the same isolated filesystem state.
- Analysis, test-design, and review CLI runs must use read-only, plan, dry-run, or equivalent safe modes.
- If any external CLI agent will modify code or workspace state, enable write-capable flags only inside the debugging worktree.
- Do not grant write-capable CLI permissions in the main working tree.
- The main agent implements the selected test and fix in the debugging worktree unless the user explicitly asks to apply it elsewhere.
- Do not commit unless the user asks.

## Asynchronous Execution

- When launching more than one CLI agent in a phase, start every CLI command asynchronously in the background.
- Do not start one CLI, wait for it, then start the next.
- After all CLI commands and subagents for the phase are launched, wait for every one of them to finish before comparing results.
- Treat each phase as launch-all-then-wait-all: test design, fix planning, and review.
- In Claude Code-style hosts, use background Bash and `TaskOutput` or the host equivalent.
- In Codex-style hosts, use `exec_command` with a yielded/background shell session where available, then `write_stdin` or the host equivalent to poll completion.
- Capture stdout and stderr for each background command according to `_shared/agent-cli.md`; do not use `2>/dev/null`.

## Workflow

1. Create the debugging worktree with `superpowers:using-git-worktrees`; use it as the working directory for all following CLI runs.
2. Ask CLI agents and the test-design subagent to propose a reproducing test.
   - All CLI commands run in read-only/safe mode.
   - All CLI commands start asynchronously before waiting.
   - Every CLI prompt must include the required summary section from `_shared/agent-cli.md`.
   - Prompt objective: design a test that fails when the bug exists and passes when fixed; include relevant files, test framework, expected failure, and why the test catches the bug.
   - Example command shapes:
     - codex: `echo "<test-design prompt>" | codex exec --skip-git-repo-check --sandbox read-only -`
     - gemini-cli: `gemini "<test-design prompt>" -o json`
     - opencode: `opencode run --agent plan "<test-design prompt>"`
     - qwen: `qwen "<test-design prompt>" --approval-mode plan`
     - cline-cli: `cline -p "<test-design prompt>"`
     - aider: `aider --dry-run --message "<test-design prompt>"`
     - github-copilot-cli: `copilot -p "<test-design prompt>"`
     - kiro-cli: `kiro-cli chat "<test-design prompt>" --no-interactive`
     - kimi-cli: `kimi --print --prompt "<test-design prompt>"`
3. Wait for all background CLI runs and the test-design subagent to finish.
4. Read every `summary.md` and inspect relevant sections of `full.md`.
5. Compare proposed tests, select the smallest test that directly reproduces the bug, and ask only necessary user questions.
6. Implement the reproducing test in the debugging worktree.
7. Run the reproducing test and confirm it fails for the expected reason.
   - Do not proceed to the fix if the test passes unexpectedly.
   - Do not proceed to the fix if the failure is unrelated to the bug.
   - If the test is invalid, revise it and rerun until it fails for the right reason or report the blocker.
8. Ask CLI agents and the code-review subagent to propose fix plans.
   - All CLI planning commands run in read-only/safe mode and asynchronously.
   - Prompt objective: analyze the bug with the failing test in place; propose a fix that makes that test pass without weakening the test.
   - Use the same command shapes as step 2 with a fix-planning prompt.
9. Wait for all background CLI runs and the code-review subagent to finish.
10. Read every `summary.md` and inspect relevant sections of `full.md`.
11. Compare fix plans and implement the selected fix in the debugging worktree.
12. Run the reproducing test and relevant regression tests.
   - The reproducing test must pass after the fix.
   - If it still fails, inspect the failure and iterate on the fix.
13. Ask CLI agents and the code-review subagent to review the uncommitted diff from the debugging worktree.
   - Review commands are read-only/safe and asynchronous.
   - Prompt objective: verify code correctness, test validity, and regression risk.
   - Example command shapes:
     - codex: `(echo "Review the following uncommitted diff. Verify: 1. the fix is correct, 2. the test fails before and passes after the fix, 3. the test is not weakened or false-positive, 4. no regressions are introduced."; git diff) | codex exec --skip-git-repo-check --sandbox read-only -`
     - gemini-cli: `(echo "Review the following uncommitted diff. Verify fix correctness and test validity."; git diff) | gemini -o json`
     - opencode: `(echo "Review the following uncommitted diff. Verify fix correctness and test validity."; git diff) | opencode run --agent plan -`
     - qwen: `(echo "Review the following uncommitted diff. Verify fix correctness and test validity."; git diff) | qwen --approval-mode plan -`
     - cline-cli: `(echo "Review the following uncommitted diff. Verify fix correctness and test validity."; git diff) | cline -p -`
     - aider: `aider --dry-run --message "Review the uncommitted diff for fix correctness and test validity." $(git diff --name-only)`
     - github-copilot-cli: `(echo "Review the following uncommitted diff. Verify fix correctness and test validity."; git diff) | copilot -p -`
     - kiro-cli: `(echo "Review the following uncommitted diff. Verify fix correctness and test validity."; git diff) | kiro-cli chat --no-interactive -`
     - kimi-cli: `(echo "Review the following uncommitted diff. Verify fix correctness and test validity."; git diff) | kimi --print --prompt -`
14. Read all review summaries and full logs, then address valid findings.
15. Repeat implementation, test verification, and review until reviewers are satisfied or 5 rounds are reached.
16. If no consensus after 5 rounds, report the root cause, disputed points, whether the reproducing test passes, and the remaining risk.

## Completion Summary

After completion, report:

- Original bug statement.
- Reproducing test path and expected pre-fix failure.
- Fix summary.
- Commands run for pre-fix failure and post-fix pass.
- Review outcome.
- Remaining gaps or risks.
