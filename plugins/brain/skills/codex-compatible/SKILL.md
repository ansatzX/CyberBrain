---
name: codex-compatible
description: "Use for Codex exec_command permissions, sandbox paths, and host-native external CLI delegation when the task actually needs them."
---

# Codex Compatible

Apply only on a host exposing Codex exec_command semantics. Effective session
instructions and current local Codex source/help take precedence over examples.
This skill cannot grant permissions or authorize delegation by itself.

## Permissions and paths

- Inspect the actual command failure before requesting escalation. Fix ordinary
  errors locally; use require_escalated only when the active policy permits it.
- Reuse applicable approved prefixes. If proposing a reusable prefix, make it
  no broader than the authorized action. A script-specific prefix can be safer
  than an interpreter-wide prefix; do not strip meaningful scope arguments just
  for reuse. Omit prefix_rule when a safe reusable rule is unavailable.
- Justification must describe the capability being requested. Avoid treating
  shell segmentation, working directory, or approval rules as a sandbox.
- Read current writable roots. Do not assume memory, global caches, home or
  temporary directories are writable. Prefer a permitted local cache; changing
  global configuration does not automatically change the active session policy.
- Filesystem scope and command approval are separate controls. Neither expands
  the user's authorized task or permits changing model/provider preferences.

## Delegation

Delegate only an authorized, concrete, bounded task when it improves the outcome.
Keep immediate critical-path work local; do independent work while children run.
Use the requested CLI, or Pi as the external-CLI default when delegation is
appropriate. Follow the matching tachikoma skill and its shared protocol first.
If that skill is unavailable, verify the CLI contract directly or report the gap.

Preserve target directory, model/provider settings, session handle and execution
boundary on every round. A read-only run must retain its verified tool restriction
on resume. Ambient extensions may execute at startup independently of model tools;
an allowlist is not an OS sandbox. If strict workspace immutability is required,
verify extension side effects and use an appropriate external boundary or stop.

The tachikoma Pi skill owns the per-round helper and log format. There is no
unrestricted fixed command that supersedes the chosen boundary. Redirect raw
stdout/stderr into host capture or the task log as appropriate for the shared
protocol’s single-call or durable mode. Preserve the CLI exit status, inspect
bounded evidence, and deliver a concise summary. Never use an unchecked pipeline status
as evidence the CLI succeeded.

For native subagents, use current host tools, explicit ownership, disjoint write
sets and inherited model settings. On CLI failure, report the cause. Switch to
a native agent only if already authorized and able to preserve the same scope;
otherwise stop the delegated task. Do not broaden permissions or select a new
model as an automatic fallback.

Stop at the accepted result, a failed run, the declared round limit, or a decision
outside delegated authority. Do not start a new objective after completion.
