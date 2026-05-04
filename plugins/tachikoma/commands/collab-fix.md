# Collaborative Multi-Agent Fix

You must fix $ARGUMENTS using **codex**, **gemini-cli**, and an independent subagent. If the user explicitly instructs to use other tools (opencode, qwen, cline-cli, aider, github-copilot-cli, kiro-cli, kimi-cli) instead of **codex** or **gemini-cli**, you may use them as well.
## Requirements:
- **AI CLI tools** : codex and gemini-cli opencode, qwen, cline-cli, aider, github-copilot-cli, kiro-cli, kimi-cli skills may also be used. 
- There skills. If the skills are not available, report an error and stop.
- a code-reviewer subagent. If not, use general-purpose Task tool.
- you should first expand the problem to add context to a description that all agents can understand. Don't interpret $ARGUMENTS on your own but copy it verbatim.

## Constraints:
- You must always use **AI CLI tools** in read-only mode where applicable. For codex use `--sandbox read-only`. For gemini-cli do not use `--yolo` or `-s` flags. For other skills, use their respective read-only/safe/yolo modes.
- **Timeout**: Always use `timeout: 600000` (10 min) when calling Bash for **AI CLI tools** to commands.
- **Parallel Execution**: If using subagent + more than one AI CLI tool, run all AI CLI tools (except subagent) in background using `run_in_background: true` for parallel execution.
- **Wait for Completion**: After launching background commands and subagent, always wait for ALL of them to complete and return results before proceeding to the next step. Use `TaskOutput` to retrieve results from background tasks. 

## Your workflow:
1. Ask **AI CLI tools** to analyze the problem and propose fix plans. If the user explicitly instructs to use other skills (opencode, qwen, cline-cli, aider, github-copilot-cli, kiro-cli, kimi-cli), include them as well. Ask a **subagent** to analyze the problem independently. They should run in parallel.
   - **IMPORTANT**: If using more than one AI CLI tool + subagent, run all AI CLI tools in background using `run_in_background: true`
   - **IMPORTANT**: Wait for ALL background commands and subagent to complete before proceeding. Use `TaskOutput` to retrieve results.
   - **codex**: `echo "Analyze ""your description here"". Propose a fix plan with steps and tradeoffs." | codex exec --skip-git-repo-check --sandbox read-only - 2>/dev/null`
   - **gemini-cli**: `gemini "Analyze ""your description here"". Propose a fix plan with steps and tradeoffs." -o json 2>/dev/null | jq -r '.response'`
   - **opencode**: `opencode run --agent plan "Analyze ""your description here"". Propose a fix plan with steps and tradeoffs." 2>/dev/null`
   - **qwen**: `qwen "Analyze ""your description here"". Propose a fix plan with steps and tradeoffs." --approval-mode plan 2>/dev/null`
   - **cline-cli**: `cline -p "Analyze ""your description here"". Propose a fix plan with steps and tradeoffs." 2>/dev/null`
   - **aider**: `aider --dry-run --message "Analyze ""your description here"". Propose a fix plan with steps and tradeoffs." 2>/dev/null`
   - **github-copilot-cli**: `copilot -p "Analyze ""your description here"". Propose a fix plan with steps and tradeoffs." 2>/dev/null`
   - **kiro-cli**: `kiro-cli chat "Analyze ""your description here"". Propose a fix plan with steps and tradeoffs." --no-interactive 2>/dev/null`
   - **kimi-cli**: `kimi --print --prompt "Analyze ""your description here"". Propose a fix plan with steps and tradeoffs. Do NOT make any changes, only analyze and propose." 2>/dev/null`
   - **subagent**: Launch an appropriate agent to analyze independently
2. Compare the plans, summarize tradeoffs, and ask me only the **necessary** questions to choose the best fix (use `AskUserQuestion`).
3. Ultrathink: implement the fix (must not git commit) on your own.
4. Ask **AI CLI tools** and **subagent** to review the **uncommitted changes**.
   - **IMPORTANT**: If using more than one AI CLI tool + subagent, run all AI CLI tools in background using `run_in_background: true`
   - **IMPORTANT**: Wait for ALL background commands and subagent to complete before proceeding. Use `TaskOutput` to retrieve results.
   - **codex**: `(echo "Review the following uncommitted diff."; git diff) | codex exec --skip-git-repo-check --sandbox read-only - 2>/dev/null`
   - **gemini-cli**: `(echo "Review the following uncommitted diff."; git diff) | gemini -o json 2>/dev/null | jq -r '.response'`
   - **opencode**: `(echo "Review the following uncommitted diff."; git diff) | opencode run --agent plan - 2>/dev/null`
   - **qwen**: `(echo "Review the following uncommitted diff."; git diff) | qwen --approval-mode plan - 2>/dev/null`
   - **cline-cli**: `(echo "Review the following uncommitted diff."; git diff) | cline -p - 2>/dev/null`
   - **aider**: `aider --dry-run --message "Review the following uncommitted diff." $(git diff --name-only) 2>/dev/null`
   - **github-copilot-cli**: `(echo "Review the following uncommitted diff."; git diff) | copilot -p - 2>/dev/null`
   - **kiro-cli**: `(echo "Review the following uncommitted diff."; git diff) | kiro-cli chat --no-interactive - 2>/dev/null`
   - **kimi-cli**: `(echo "Review the following uncommitted diff."; git diff) | kimi --print --prompt - 2>/dev/null`
   - **subagent**: Launch a code-review agent to review the diff
5. Review their responses; if any item depends on human preference, ask me (use `AskUserQuestion`).
6. Repeat steps 3–5 until reviewers are satisfied or **5 rounds** reached. If no consensus after 5 rounds, report the root cause and what remains disputed.

---

