# External Agent CLI Protocol

Use this protocol before invoking any external coding-agent CLI from a Tachikoma skill.

## 1. Discover the installed contract

Before the first use of an executable or an unfamiliar subcommand, inspect:

```text
<cli> --version
<cli> --help
<cli> <subcommand> --help       # when a subcommand will be used
```

Use only flags, permission modes, model options and resume syntax supported by
that installed version. Reuse this evidence in the same session when executable
identity/version and relevant configuration are unchanged; do not rerun help on
every round. Recheck after an upgrade, PATH/target-environment change, unfamiliar
subcommand or behavior inconsistent with the cached contract. Configuration and
permission changes still require their own checks. Examples do not override help.

## 2. Preserve the user's model choice

- Omit model, profile, reasoning, fallback, and provider flags by default. They inherit the CLI's current configuration or resumed session.
- Add one only when the user explicitly selected it, or after asking one focused question when selection is necessary.
- Validate a requested value against the CLI's current discovery/configuration mechanism before running it.
- Do not encode provider-specific model names, profile-to-model bindings, or assumed reasoning levels in a skill.
- Resume without changing model, profile, reasoning, provider, or permission settings unless the user explicitly asks to change them.

## 3. Establish the execution boundary

Classify the requested run before launch:

| Requested result | Required boundary |
| --- | --- |
| Read-only analysis | Use a CLI mode verified by its current help to be read-only. If none exists, say so; do not label an ordinary agent run read-only. |
| Workspace changes | The user must request or approve changes. Run in the explicitly selected target directory; use a fresh worktree only when it has been requested or approved. |
| Automatic approvals, broad filesystem access, network access, or destructive actions | Explain the exact capability and obtain explicit approval before adding the relevant flag. A worktree isolates repository changes; it is not permission for broader access. |

Never invent a host-specific question, approval, task, or tool API. Use the current host's native mechanism, or ask directly in the assistant response.

## 4. Prompt and output discipline

State the objective, target directory, allowed scope, prohibited actions, and required verification in the prompt. Request a concise final response containing:

- files inspected and changed;
- commands and verification run;
- remaining uncertainty or failures.

Do not require the external agent to create orchestration-only `full.md`, `summary.md`, or logs. Requested deliverables and authorized code changes remain its responsibility. The orchestrating agent owns all durable logs and summaries; the
external CLI returns its response and authorized deliverables. Capture stdout,
stderr and the actual exit status; choose the record size in §6. Process success is evidence only
that the CLI exited; inspect its final report and the claimed artifacts before
reporting success.

## 5. Resume and failure

Use the CLI's currently documented resume command. Resume only the intended session and restate the inherited execution boundary. If command discovery, authentication, permissions, or the run itself fails, report the exact failure and stop; do not retry with broader permissions or a different model without user direction.

## 6. Task log and summary

Choose the record size before launch:

| Task | Coordinator record |
| --- | --- |
| One bounded call, completed and verified in the current session | Capture stdout/stderr and exit status using the host’s output capture or an authorized temporary file. Return a concise result with scope, verification and relevant failure evidence. No `.tachikoma` directory, `summary.md` or new session handle is required solely for bookkeeping. |
| Multi-round, background, handed-off or explicitly resumable work | Keep the durable record below from the first round. |

If a one-call task needs continuation, preserve its available output, exit status,
actual session handle and boundary in a durable record before resuming. Do not
invent a handle or silently start a different conversation; report unavailable
resume state. Requested deliverables remain required in either mode.

For durable work the coordinator maintains a record under `$TACHIKOMA_LOG_DIR`
or `<target-dir>/.tachikoma/<task-slug>/`:

- `session.log`: append each round’s output and stderr with round/time separators.
- `summary.md`: current route/version, session handle, execution boundary,
  rounds/status, files, verification and remaining gaps, with evidence paths.
  Update after each round; use `continue`, `complete` or `blocked` with a reason.

Return the current concise summary directly; a separate `cat` is unnecessary
when its verified content is already available. Preserve exit status when logging;
a successful redirection or pipeline is not evidence the CLI succeeded.

Context discipline:

- For durable work, read `summary.md` first when resuming. Inspect relevant source files and
  deliverables as needed to verify it; summaries do not replace evidence.
- Consult `session.log` only with bounded extraction (tail, grep with line
  limits) for a specific error or evidence; never replay it wholesale.
- Recommend adding `.tachikoma/` to the target project's `.gitignore`; use
  `TACHIKOMA_LOG_DIR` to place logs outside the repository when that is not
  acceptable.
