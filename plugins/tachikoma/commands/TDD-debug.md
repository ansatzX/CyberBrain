# TDD Debug Protocol

You must debug $ARGUMENTS using **codex**, **gemini-cli**, and an independent subagent. If the user explicitly instructs to use other tools (opencode, qwen, cline-cli, aider, github-copilot-cli, kiro-cli, kimi-cli) instead of **codex** or **gemini-cli**, you may use them as well.

## Overview
This workflow ensures bugs are fixed with proper test coverage by:
1. First writing a **failing** test that reproduces the bug
2. Then fixing the bug using multi-agent collaboration
3. Verifying the test passes after the fix

## Requirements:
- **AI CLI tools** : codex and gemini-cli opencode, qwen, cline-cli, aider, github-copilot-cli, kiro-cli, kimi-cli skills may also be used.
- There skills. If the skills are not available, report an error and stop.
- a code-reviewer subagent. If not, use general-purpose Task tool.
- a test-automator subagent for test design review.
- you should first expand the bug description to add context. Don't interpret $ARGUMENTS on your own but copy it verbatim.

## Constraints:
- You must always use **AI CLI tools** in read-only mode where applicable. For codex use `--sandbox read-only`. For gemini-cli do not use `--yolo` or `-s` flags. For other skills, use their respective read-only/safe/yolo modes.
- **Timeout**: Always use `timeout: 1200000` (20 min) when calling Bash for **AI CLI tools** to commands.
- **Parallel Execution**: If using subagent + more than one AI CLI tool, run all AI CLI tools (except subagent) in background using `run_in_background: true` for parallel execution.
- **Wait for Completion**: After launching background commands and subagent, always wait for ALL of them to complete and return results before proceeding to the next step. Use `TaskOutput` to retrieve results from background tasks.
- The test MUST fail before the fix and MUST pass after the fix.
---

## Phase 1: Reproduce the Bug with a Failing Test

### Step 1.1: Analyze the Bug
First, expand the bug description to add context. Don't interpret $ARGUMENTS on your own but copy it verbatim. Gather information about:
- The expected behavior
- The actual (buggy) behavior
- The relevant code paths
- The testing framework used in the project

### Step 1.2: Design the Test
Ask **AI CLI tools** and a **test-automator subagent** in parallel to propose a test that reproduces the bug:
- **IMPORTANT**: If using more than one AI CLI tool + subagent, run all AI CLI tools in background using `run_in_background: true`
- **IMPORTANT**: Wait for ALL background commands and subagent to complete before proceeding. Use `TaskOutput` to retrieve results.
- **codex**: `echo "Given this bug: ""$ARGUMENTS"". Design a test case that will FAIL when the bug exists and PASS when fixed. Include the test code and explain why it catches this bug." | codex exec --skip-git-repo-check --sandbox read-only - 2>/dev/null`
- **gemini-cli**: `gemini "Given this bug: ""$ARGUMENTS"". Design a test case that will FAIL when the bug exists and PASS when fixed. Include the test code and explain why it catches this bug." -o json 2>/dev/null | jq -r '.response'`
- **opencode**: `opencode run --agent plan "Given this bug: ""$ARGUMENTS"". Design a test case that will FAIL when the bug exists and PASS when fixed. Include the test code and explain why it catches this bug." 2>/dev/null`
- **qwen**: `qwen "Given this bug: ""$ARGUMENTS"". Design a test case that will FAIL when the bug exists and PASS when fixed. Include the test code and explain why it catches this bug." --approval-mode plan 2>/dev/null`
- **cline-cli**: `cline -p "Given this bug: ""$ARGUMENTS"". Design a test case that will FAIL when the bug exists and PASS when fixed. Include the test code and explain why it catches this bug." 2>/dev/null`
- **aider**: `aider --dry-run --message "Given this bug: ""$ARGUMENTS"". Design a test case that will FAIL when the bug exists and PASS when fixed. Include the test code and explain why it catches this bug." 2>/dev/null`
- **github-copilot-cli**: `copilot -p "Given this bug: ""$ARGUMENTS"". Design a test case that will FAIL when the bug exists and PASS when fixed. Include the test code and explain why it catches this bug." 2>/dev/null`
- **kiro-cli**: `kiro-cli chat "Given this bug: ""$ARGUMENTS"". Design a test case that will FAIL when the bug exists and PASS when fixed. Include the test code and explain why it catches this bug." --no-interactive 2>/dev/null`
- **kimi-cli**: `kimi --print --prompt "Given this bug: ""$ARGUMENTS"". Design a test case that will FAIL when the bug exists and PASS when fixed. Include the test code and explain why it catches this bug. Do NOT make any changes, only analyze and propose." 2>/dev/null`
- **subagent**: Launch a test-automator agent to independently design a reproducing test

### Step 1.3: Select and Implement the Test
1. Compare the proposed tests and summarize their approaches.
2. Ask the user which test approach to use (use `AskUserQuestion`).
3. Implement the chosen test in the appropriate test file.

### Step 1.4: Verify the Test Fails
1. Run the test to confirm it **FAILS** (proving the bug exists).
2. Use `AskUserQuestion` to ask the user:
   - "Does the test correctly reproduce the bug?"
   - "Does the test failure match the expected buggy behavior?"
   - "Is the test implementation acceptable?"
3. If the user rejects the test, iterate on test design (return to Step 1.2).
4. **Do not proceed to Phase 2 until the user confirms the test is valid.**

---

## Phase 2: Fix the Bug (Collab-Fix Protocol with Test Verification)

### Step 2.1: Propose Fix Plans
Ask **AI CLI tools** and a **code-reviewer subagent** in parallel to analyze and propose fixes:
- **IMPORTANT**: If using more than one AI CLI tool + subagent, run all AI CLI tools in background using `run_in_background: true`
- **IMPORTANT**: Wait for ALL background commands and subagent to complete before proceeding. Use `TaskOutput` to retrieve results.
- **codex**: `echo "Analyze this bug: ""$ARGUMENTS"". We have a failing test that reproduces it. Propose a fix plan with steps and tradeoffs. The fix must make the test pass." | codex exec --skip-git-repo-check --sandbox read-only - 2>/dev/null`
- **gemini-cli**: `gemini "Analyze this bug: ""$ARGUMENTS"". We have a failing test that reproduces it. Propose a fix plan with steps and tradeoffs. The fix must make the test pass." -o json 2>/dev/null | jq -r '.response'`
- **opencode**: `opencode run --agent plan "Analyze this bug: ""$ARGUMENTS"". We have a failing test that reproduces it. Propose a fix plan with steps and tradeoffs. The fix must make the test pass." 2>/dev/null`
- **qwen**: `qwen "Analyze this bug: ""$ARGUMENTS"". We have a failing test that reproduces it. Propose a fix plan with steps and tradeoffs. The fix must make the test pass." --approval-mode plan 2>/dev/null`
- **cline-cli**: `cline -p "Analyze this bug: ""$ARGUMENTS"". We have a failing test that reproduces it. Propose a fix plan with steps and tradeoffs. The fix must make the test pass." 2>/dev/null`
- **aider**: `aider --dry-run --message "Analyze this bug: ""$ARGUMENTS"". We have a failing test that reproduces it. Propose a fix plan with steps and tradeoffs. The fix must make the test pass." 2>/dev/null`
- **github-copilot-cli**: `copilot -p "Analyze this bug: ""$ARGUMENTS"". We have a failing test that reproduces it. Propose a fix plan with steps and tradeoffs. The fix must make the test pass." 2>/dev/null`
- **kiro-cli**: `kiro-cli chat "Analyze this bug: ""$ARGUMENTS"". We have a failing test that reproduces it. Propose a fix plan with steps and tradeoffs. The fix must make the test pass." --no-interactive 2>/dev/null`
- **kimi-cli**: `kimi --print --prompt "Analyze this bug: ""$ARGUMENTS"". We have a failing test that reproduces it. Propose a fix plan with steps and tradeoffs. The fix must make the test pass. Do NOT make any changes, only analyze and propose." 2>/dev/null`
- **subagent**: Launch a code-reviewer agent to propose a fix independently

### Step 2.2: Select Fix Approach
Compare the plans, summarize tradeoffs, and ask the user only the **necessary** questions to choose the best fix (use `AskUserQuestion`).

### Step 2.3: Implement the Fix
Ultrathink: implement the fix (must not git commit) on your own.

### Step 2.4: Verify Test Passes
1. Run the reproducing test to confirm it now **PASSES**.
2. If the test still fails, analyze why and iterate on the fix.

### Step 2.5: Review the Changes
Ask **AI CLI tools** and **subagents** to review the uncommitted changes, specifically checking:
- Code correctness
- Test feasibility and quality
- That the test genuinely validates the fix (not a false positive)

Run in parallel:
- **IMPORTANT**: If using more than one AI CLI tool + subagent, run all AI CLI tools in background using `run_in_background: true`
- **IMPORTANT**: Wait for ALL background commands and subagent to complete before proceeding. Use `TaskOutput` to retrieve results.
- **codex**: `(echo "Review the following uncommitted diff. Verify: 1) The fix is correct, 2) The test is feasible and properly validates the fix, 3) No regressions introduced."; git diff) | codex exec --skip-git-repo-check --sandbox read-only - 2>/dev/null`
- **gemini-cli**: `(echo "Review the following uncommitted diff. Verify: 1) The fix is correct, 2) The test is feasible and properly validates the fix, 3) No regressions introduced."; git diff) | gemini -o json 2>/dev/null | jq -r '.response'`
- **opencode**: `(echo "Review the following uncommitted diff. Verify: 1) The fix is correct, 2) The test is feasible and properly validates the fix, 3) No regressions introduced."; git diff) | opencode run --agent plan - 2>/dev/null`
- **qwen**: `(echo "Review the following uncommitted diff. Verify: 1) The fix is correct, 2) The test is feasible and properly validates the fix, 3) No regressions introduced."; git diff) | qwen --approval-mode plan - 2>/dev/null`
- **cline-cli**: `(echo "Review the following uncommitted diff. Verify: 1) The fix is correct, 2) The test is feasible and properly validates the fix, 3) No regressions introduced."; git diff) | cline -p - 2>/dev/null`
- **aider**: `aider --dry-run --message "Review the following uncommitted diff. Verify: 1) The fix is correct, 2) The test is feasible and properly validates the fix, 3) No regressions introduced." $(git diff --name-only) 2>/dev/null`
- **github-copilot-cli**: `(echo "Review the following uncommitted diff. Verify: 1) The fix is correct, 2) The test is feasible and properly validates the fix, 3) No regressions introduced."; git diff) | copilot -p - 2>/dev/null`
- **kiro-cli**: `(echo "Review the following uncommitted diff. Verify: 1) The fix is correct, 2) The test is feasible and properly validates the fix, 3) No regressions introduced."; git diff) | kiro-cli chat --no-interactive - 2>/dev/null`
- **kimi-cli**: `(echo "Review the following uncommitted diff. Verify: 1) The fix is correct, 2) The test is feasible and properly validates the fix, 3) No regressions introduced."; git diff) | kimi --print --prompt - 2>/dev/null`
- **subagent**: Launch a code-reviewer agent to review the diff with focus on test validity

### Step 2.6: Iterate if Needed
1. Review their responses; if any item depends on human preference, ask the user (use `AskUserQuestion`).
2. Repeat steps 2.3–2.5 until:
   - All reviewers are satisfied, AND
   - The test passes
   - OR **5 rounds** reached

If no consensus after 5 rounds, report:
- The root cause of the bug
- What remains disputed
- Whether the test is passing or failing
- Recommendations for resolution

---

## Summary Output
After completion, provide a summary including:
1. **Bug Description**: The original bug
2. **Test Created**: Location and description of the reproducing test
3. **Fix Applied**: Summary of the changes made
4. **Test Status**: Confirmation that the test now passes
5. **Review Consensus**: Final reviewer feedback

---

