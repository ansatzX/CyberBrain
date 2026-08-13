---
name: codex-compatible
description: "Use when the task involves `exec_command` escalation, `prefix_rule`, sandbox permissions, writable roots, delegating work to external AI CLIs via Codex subagents, or Codex platform-specific operational patterns."
---

# Codex Compatible

> Operational knowledge for working within Codex's sandbox, permission, and subagent delegation models.

This skill covers Codex platform patterns that are not domain-specific but are essential for correct agent behavior: `exec_command` escalation, `prefix_rule` selection, sandbox writable roots, and tool cache directories.

Apply it only when the active host exposes Codex `exec_command` semantics. Before relying on an operational detail, inspect the current Codex help, effective permission instructions, or local Codex source; they are authoritative over this skill. For web-search judgment, source verification, current-information checks, or entity disambiguation, route to `brain:agentic-search`. This skill only covers Codex platform mechanics; it must not absorb search strategy or source-ranking policy.

## `exec_command` `prefix_rule` Escalation

When `exec_command` fails sandboxing and requires escalation (`sandbox_permissions="require_escalated"`), provide a `prefix_rule` that captures the reusable command pattern — **not** the full command with specific arguments.

**Core rule: strip specific arguments, keep the tool prefix.**

| Full Command | Correct prefix_rule | Wrong prefix_rule |
|---|---|---|
| `uv run pytest tests/test_x.py -q` | `["uv", "run", "pytest"]` | `["uv", "run", "pytest", "tests/test_x.py", "-q"]` |
| `uv run python script.py --flag` | `["uv", "run", "python"]` | `["uv", "run", "python", "script.py", "--flag"]` |
| `git push origin main` | `["git", "push"]` | `["git", "push", "origin", "main"]` |

**Shell segmentation:** Commands split at `&&`, `||`, `;`, `|` into independent segments. The `prefix_rule` applies to the segment that needs escalation:

```
cd /project && uv run pytest -q
→ segments: ["cd /project", "uv run pytest -q"]
→ prefix_rule: ["uv", "run", "pytest"]   # only the escalatable segment
```

**`justification` mirrors `prefix_rule`:**

```
justification: "Do you want to allow `uv run pytest` in this project?"
prefix_rule: ["uv", "run", "pytest"]
```

**Approved rules accumulate.** Check the "Approved command prefixes" section in the system prompt before proposing a new prefix. Start narrow and broaden organically.

**Banned patterns:**
- `["python3"]` / `["python"]` — too broad
- Heredocs (`<<`), herestrings (`<<<`)
- Destructive commands (`rm`, `rmdir`) unless the user explicitly asks

**Checklist before calling exec_command with escalation:**

1. [ ] Is the command failing due to sandboxing (network, filesystem)?
2. [ ] Is there an existing approved prefix rule that already covers it?
3. [ ] Does the `prefix_rule` capture the reusable tool prefix, not specific arguments?
4. [ ] Is the `justification` a clear question describing what will be allowed?
5. [ ] Is the `prefix_rule` free of heredocs, herestrings, and destructive commands?

## Sandbox Writable Roots

In a `workspace_write` sandbox, writes are only permitted to:

| Source | Path | Controllable? |
|---|---|---|
| cwd | Current working directory | Automatic |
| writable_roots | From `~/.codex/config.toml` | Yes |
| $TMPDIR | OS temp directory | Can exclude via `exclude_tmpdir_env_var` |
| /tmp | `/tmp` | Can exclude via `exclude_slash_tmp` |
| Memories | `~/.codex/memories` | Always writable |

### Tool Cache Directories

Many tools write to cache or data directories outside cwd (e.g., `~/.cache/uv`, `~/.cargo`, `~/.npm`). These are blocked by the sandbox and cause repeated escalations.

**Pattern:** identify the tool's cache directory → add it to `writable_roots`:

```toml
# ~/.codex/config.toml
[sandbox_workspace_write]
writable_roots = ["~/.cache/uv"]
```

After this, writes to that directory succeed inside the sandbox without escalation. The per-project `CACHE_DIR=./.cache/...` workaround is no longer needed.

**Common tool cache paths:**

| Tool | Typical cache dir |
|---|---|
| `uv` | `~/.cache/uv` |
| `pip` | `~/Library/Caches/pip` (macOS) |
| `cargo` | `~/.cargo` |
| `npm` | `~/.npm` |
| `conda` | `~/miniconda3/pkgs` |

### writable_roots vs prefix_rule

| Mechanism | Controls | Scope |
|---|---|---|
| `writable_roots` | Which directories can be written to | Filesystem sandbox |
| `prefix_rule` | Which commands run without approval | Command execution |

They are complementary. Adding a directory to `writable_roots` removes the filesystem restriction; a `prefix_rule` removes the command-approval gate.

## Subagent-Driven Delegation to External CLIs

Route delegated work to external AI CLIs before spawning native Codex
sub-agents. The external CLI runs inference on its own model, so GPT only pays
orchestration; the native spawn fallback keeps every delegation recoverable.

This section explicitly authorizes delegation and parallel agent work, as
required by the spawn tool description ("Do not spawn sub-agents unless the
user or applicable AGENTS.md/skill instructions explicitly ask..."). Before
invoking any external CLI, follow the tachikoma shared agent-cli protocol.

### Routing rules

1. **Prefer the external CLI, defaulting to pi.** Any bounded subtask —
   analysis, review, implementation, research, documentation — goes to the
   matching tachikoma CLI skill. Pi is the default; choose another CLI only
   when the user names it or pi is unavailable. The CLI skill owns model,
   permission, and output discipline.
2. **Iterate, do not fire once.** One non-interactive run is one turn of a
   longer collaboration. Follow the CLI skill's resume loop: keep a stable
   session handle, read staged results, judge, send the next focused
   instruction, and bound the rounds. For pi that is the `--session-id` loop in
   the tachikoma `pi` skill; for other CLIs use their documented
   session-continuation mechanism. Report the session handle so work can
   resume later.
3. **Two lanes by output size.**
   - Small or bounded expected output: invoke the CLI directly and read only
     its concise final response. Never pull raw artifacts into this context.
   - Large or uncertain output: spawn a native sub-agent with the
     `tachikoma-runner` role (`agent_type`), which runs the CLI inside its own
     thread and returns only the narrow conclusion. The fork cleanup keeps
     tool history out of this context.
4. **Fall back to spawn on failure.** Fall back when the CLI is missing, has no
   auth, hits network restrictions, exits non-zero, produces no artifacts, or
   its output looks wrong. First state what was tried; then spawn a native
   sub-agent (no `agent_type` override) with the same concrete, self-contained
   task. Do not fall back just because the CLI is slow or its output is long.

| Signal | Action |
| --- | --- |
| CLI not installed / auth error / network blocked / non-zero exit / no artifacts | Fall back to spawn, reporting the attempted command |
| CLI exits cleanly but the output looks wrong | Do not retry the CLI; fall back to spawn with the evidence |
| Slow run or long output | No fallback; stay on the current lane and keep output discipline |

### Canonical pi round commands

Pi is the default coding agent; the per-round command is fixed. Do not
redesign, re-justify, or re-weigh it each round — execute it as written.

Every round starts with the run command; stdout stays in this context (the
reply channel) while the raw record is appended to the log:

```bash
TASK="<task-slug>"; ROUND=<n>
mkdir -p ".tachikoma/$TASK"
echo "===== round $ROUND $(date -u +%Y-%m-%dT%H:%M:%SZ) =====" >> ".tachikoma/$TASK/session.log"
pi --session-id "tachikoma-$TASK" --print "<本轮指令>" 2>&1 | tee -a ".tachikoma/$TASK/session.log"
```

After judging, update and deliver the summary in one command, so its stdout
is the current state and no separate file read is needed:

```bash
cat > ".tachikoma/$TASK/summary.md" <<EOF
# $TASK · 第 $ROUND 轮 · $(date -u +%Y-%m-%dT%H:%M:%SZ)

- 路由 / session handle / 已跑轮次
- 改动文件
- 验证
- 下一步状态: continue | complete | blocked（blocked 时附 blocker）
- 剩余不确定
- 窄结论（证据路径）
EOF
cat ".tachikoma/$TASK/summary.md"
```

`summary.md` is rewritten each round with a round number and timestamp header;
`session.log` grows behind `===== round N <timestamp> =====` separators.

### Spawn discipline for the fallback

- Delegate only concrete, bounded subtasks with an explicit deliverable.
- Never hand off the immediate critical-path step; do it locally.
- Parallel fanout only over disjoint write sets.
- `fork_turns`: use none or a small N for isolated work; the role applies
  regardless of inherited history.
- Omit `model`; native sub-agents inherit the current model by default.

### Communication and record discipline

- The workspace is the shared ground truth: the external CLI writes files,
  diffs, and checkpoints; judge progress from them, not from transcripts.
- Keep the durable record outside the context per the shared protocol §6:
  `session.log` holds every round's raw output, `summary.md` holds the current
  conclusion, delivered by cat into stdout.
- Never replay raw external output into this context or the parent's. If a
  judgment needs evidence, reference artifact or log paths, not pasted logs.
- Stop conditions for the loop: task done, run failed, or a decision this
  agent cannot make. Bound the rounds; report exact state instead of guessing.
- Never forward raw external CLI output to the user or parent context. Report:
  route used, commands run, files changed, verification performed, and
  remaining uncertainty. A zero exit code from the external CLI is process
  success, not task success.
