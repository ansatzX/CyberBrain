# Collaborative Multi-Agent Fix

> Note: Additional skills are now available: opencode, qwen, cline-cli, aider, github-copilot-cli, kiro-cli, kimi-cli. **By default, this workflow uses codex and gemini-cli only.** If the user explicitly instructs to use other skills, you may use them alongside codex and gemini-cli.

You must fix $ARGUMENTS using **codex**, **gemini-cli**, and an independent subagent. If the user explicitly instructs to use other skills (opencode, qwen, cline-cli, aider, github-copilot-cli, kiro-cli, kimi-cli), you may use them as well.
## Requirements:
- codex and gemini-cli skills. If the user explicitly instructs, other skills like opencode, qwen, cline-cli, aider, github-copilot-cli, kiro-cli, kimi-cli may also be used. If the skills are not available, report an error and stop.
- a code-reviewer subagent. If not, use general-purpose Task tool.
- you should first expand the problem to add context to a description that all agents can understand. Don't interpret $ARGUMENTS on your own but copy it verbatim.

## Constraints:
- You must always use codex, gemini-cli, and other skills (if explicitly instructed) in read-only mode where applicable. For codex use `--sandbox read-only`. For gemini-cli do not use `--yolo` or `-s` flags. For other skills, use their respective read-only/safe modes.
- **Timeout**: Always use `timeout: 600000` (10 min) when calling Bash for codex/gemini commands. If using other skills as explicitly instructed by user, apply appropriate timeouts for them as well.

## Your workflow:
1. Ask **codex** and **gemini-cli** to analyze the problem and propose fix plans. If the user explicitly instructs to use other skills (opencode, qwen, cline-cli, aider, github-copilot-cli, kiro-cli, kimi-cli), include them as well. Ask a **subagent** to analyze the problem independently. They should run in parallel.
   - **codex**: `echo "Analyze ""your description here"". Propose a fix plan with steps and tradeoffs." | codex exec --skip-git-repo-check --sandbox read-only - 2>/dev/null`
   - **gemini-cli**: `gemini "Analyze ""your description here"". Propose a fix plan with steps and tradeoffs." -o json 2>/dev/null | jq -r '.response'`
   - **other skills (if explicitly instructed)**: Use opencode, qwen, cline-cli, aider, github-copilot-cli, kiro-cli, or kimi-cli as instructed by user
   - **subagent**: Launch an appropriate agent to analyze independently
2. Compare the plans, summarize tradeoffs, and ask me only the **necessary** questions to choose the best fix (use `AskUserQuestion`).
3. Ultrathink: implement the fix (must not git commit) on your own.
4. Ask **codex**, **gemini-cli**, and **subagent** to review the **uncommitted changes**. If the user explicitly instructs to use other skills (opencode, qwen, cline-cli, aider, github-copilot-cli, kiro-cli, kimi-cli), include them as well.
   - **codex**: `(echo "Review the following uncommitted diff."; git diff) | codex exec --skip-git-repo-check --sandbox read-only - 2>/dev/null`
   - **gemini-cli**: `(echo "Review the following uncommitted diff."; git diff) | gemini -o json 2>/dev/null | jq -r '.response'`
   - **other skills (if explicitly instructed)**: Use opencode, qwen, cline-cli, aider, github-copilot-cli, kiro-cli, or kimi-cli as instructed by user
   - **subagent**: Launch a code-review agent to review the diff
5. Review their responses; if any item depends on human preference, ask me (use `AskUserQuestion`).
6. Repeat steps 3–5 until reviewers are satisfied or **5 rounds** reached. If no consensus after 5 rounds, report the root cause and what remains disputed.

---

