# External Agent CLI Protocol

Use this protocol before invoking any external coding-agent CLI from a Tachikoma skill.

## 1. Discover the installed contract

Before constructing a command, run these read-only checks:

```text
<cli> --version
<cli> --help
<cli> <subcommand> --help       # when a subcommand will be used
```

Use only flags, permission modes, model options, and resume syntax shown by that installed version. A skill example is illustrative; current CLI help is authoritative.

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

Do not require the external agent to create `full.md`, `summary.md`, logs, or any
other artifact. The orchestrating agent owns all durable logs and summaries; the
external CLI only returns its final response. Do not discard stderr: append the
external CLI's output to the task log (see §6). Process success is evidence only
that the CLI exited; inspect its final report and the claimed artifacts before
reporting success.

## 5. Resume and failure

Use the CLI's currently documented resume command. Resume only the intended session and restate the inherited execution boundary. If command discovery, authentication, permissions, or the run itself fails, report the exact failure and stop; do not retry with broader permissions or a different model without user direction.

## 6. Task log and summary

Every delegated task keeps a durable record outside the conversation context.
The orchestrating agent maintains, per task, under `$TACHIKOMA_LOG_DIR` or the
default `<target-dir>/.tachikoma/<task-slug>/`:

- `session.log` — every round's raw external CLI output and stderr, appended
  behind a `===== round N <ISO timestamp> =====` separator;
- `summary.md` — the current state, rewritten each round with a round number
  and ISO timestamp in the header: route used, session handle, rounds run and
  where each stopped, files inspected/changed, commands and verification run,
  next status (`continue` | `complete` | `blocked`, with blocker text when
  blocked), remaining uncertainty, and the narrow conclusion with evidence
  paths.

Deliver the summary by cating it into the command stdout; neither the
orchestrating agent nor its parent should need a separate file read for the
current state.

Context discipline:

- Read `summary.md` first; it is the only file that may enter the agent
  context in full.
- Consult `session.log` only with bounded extraction (tail, grep with line
  limits) for a specific error or evidence; never replay it wholesale.
- Recommend adding `.tachikoma/` to the target project's `.gitignore`; use
  `TACHIKOMA_LOG_DIR` to place logs outside the repository when that is not
  acceptable.
