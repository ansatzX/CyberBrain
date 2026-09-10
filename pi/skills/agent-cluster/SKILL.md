---
name: agent-cluster
description: "Decompose, launch and supervise Pi subagents with explicit ownership, verified launch schemas, bounded execution and evidence-backed fan-in."
---

# Agent Cluster

Use `team-leader` for ownership and `pick-model` for model/effort decisions.
The current Pi tool schema and installed pi-subagents source are authoritative.
Check them before adapting examples; do not invent task fields from a design sketch.

## Trigger judgment: should a cluster exist at all?

Use multiple agents only for independent tasks or a useful separation of writer
and reviewer, within existing authorization. Prefer one agent for overlapping
questions or small changes. Do not create a fleet to avoid reading known context.

Declare the objective, acceptance criteria, distinct task scopes, writer ownership,
maximum launches, timeout/round limits, fallback and synthesizer. A short list
is sufficient; a JS-like design sketch is optional and is not an executable API.
The parent enforces this launch count; a comment does not create a runtime limit.

## Real boundaries

| Requirement | Mechanism and limit |
| --- | --- |
| Independent conversation | `context: "fresh"` avoids forking parent history; project instructions, role and skills may still be loaded. `fork` inherits parent conversation and is unsuitable for independent review. |
| Files suggested to a child | `reads` adds reading instructions. It is not a filesystem or write allowlist; `reads: false` does not disable reads. |
| Strict read-only work | Verify the selected role's actual enabled tools, extensions and execution boundary. A role name or prompt is insufficient. If mutation cannot be excluded, use a verified restricted route or report the gap before launch. |
| Separate writers | Use supported managed worktree isolation, or explicit separate directories. Worktrees isolate Git changes, not home/network access. |
| Structured output | Use a complete JSON Schema with required fields and types; inspect the saved structured result. A shorthand such as `{ files: "string[]" }` does not validate files. |
| Bounded execution | Verify the installed scope of tool/turn/time budgets. Tool-budget defaults may block only reading tools; use a supported all-tools block when needed. |
| Approval boundary | Before unapproved mutation, stop in the parent and obtain missing authorization. Do not enqueue it behind an invented checkpoint step. Existing authorization remains valid. |

Post-run diff review detects changes after they happen; it does not enforce a
read-only boundary. Check unstaged, staged and untracked changes, as well as any
other authorized artifact locations. Stop before launching when the required
isolation cannot be established.

## Verified launch examples

Read only the example that matches the task:

- Independent module review: [parallel-review.js](examples/parallel-review.js).
- Review depending on a prior mapping: [dependent-review.js](examples/dependent-review.js).

Use the selected file’s contents as the `workflowScript` string in the public
payload, alongside `async: true` and `timeoutMs: 600000`. These files are workflow
statement bodies, not standalone Node programs. Adapt module paths and the timeout
to the authorized task. Tests execute these same files through the installed
runtime; there is no second copy embedded in this guide.

The interface checked on 2026-09-07 uses `workflowScript`. Legacy top-level
`tasks`, `chain` and `concurrency` are rejected by its public boundary. Recheck the
installed API when its version changes. Both examples launch at most two children
with no retries; verify child cancellation semantics separately from the workflow
timeout. Verify the effective `reviewer` role’s tools and extensions before launch.

Each child uses fresh context and a complete JSON Schema. Omitted models preserve
role/default resolution. For an explicit effort override, follow `pick-model`
using the same resolved model and a supported suffix.

For implementation, launch only the approved write scope after inspecting the
reconnaissance result. Launch independent review with fresh context after the
writer finishes. Supply its task, relevant artifacts and acceptance criteria;
do not expose the writer's reasoning as the reviewer's starting conclusion.

## Supervision and completion

Inspect `subagent({ action: "status", view: "fleet" })` and saved outputs while
continuing independent work. Do not duplicate healthy children's assignments.
Classify failures: child failure may use the declared bounded fallback; invalid
launch fields, scope violations and exhausted fleet budgets stop the affected
workflow. Report partial results as partial, never as success.

Before taking over a failed child, stop it or verify it is inactive, inspect
partial state and transfer ownership explicitly. Preserve model and permission
policy on resume; inspect the current status API before choosing a control action.

Fan-in checks each required schema, evidence and write scope, resolves conflicting
findings, and produces the user's deliverable. A schema proves shape, not factual
correctness. Claim completion only after synthesis and no active children remain.
Report unresolved work and stop at the authorized objective.

Keep one durable run summary when the cluster merits it: objective, task/run ids,
launch count, resolved models, observed status, files, tests and remaining gaps.
Keep raw logs out of the conversation except bounded evidence excerpts. Inspect
source artifacts as needed; a summary is not the sole permitted evidence source.
