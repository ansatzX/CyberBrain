---
name: agent-cluster
description: Launch and supervise a Pi subagent cluster end to end. Use when a task needs multiple cooperating subagents — parallel fanout, research chains, review fleets, or plan/implement/verify pipelines — covering trigger judgment, task decomposition, launch call shape, async monitoring, intervention, and fan-in acceptance. Model and thinking choices delegate to pick-model; coordination discipline delegates to team-leader.
---

# Agent Cluster

This skill owns the **lifecycle of an agent cluster**: whether to launch, how to
decompose, what the launch call looks like, how to supervise, and when the
cluster is actually done. It is a launcher and supervisor, not a model router
and not a delegation philosophy.

Load order for every cluster:

1. `team-leader` — delegation discipline, one writer per worktree, review duty.
2. `pick-model` — per-child model and thinking selection.
3. This skill — compose and run the cluster.

Never let model choice substitute for task decomposition. A well-routed cluster
with bad seams is still a bad cluster.

## 0. Trigger judgment — should a cluster exist at all?

Launch a cluster only when at least one is true:

- The task has **independent seams** that a single agent would serialize
  (multiple modules, multiple documents, multiple hypotheses).
- The task needs **role separation**: implementation and independent review must
  not share a context.
- The task needs **breadth-first exploration** before any synthesis is possible.

Do **not** launch a cluster when:

- The task is a single-file, single-concern change — use one subagent or none.
- The seams overlap so much that children would read the same files with the
  same questions — that is one scout, not a fleet.
- The parent could answer from already-known context — clusters do not replace
  reading.
- The user asked a question, not for work — answer directly.

Default: when uncertain between one agent and a cluster, use one agent. Clusters
are the exception.

## 1. Decompose — seams before agents

Write the decomposition before any launch call:

```text
Goal:
Done means:                # observable acceptance criteria
Seams:                     # independent work slices
  S1: <slice> — agent lane — expected output
  S2: <slice> — agent lane — expected output
Writer:                    # exactly one, or "none — read-only cluster"
Synthesizer:               # who merges child outputs (usually the parent)
Failure plan:              # what happens if a seam fails
```

Seam rules:

- Each seam names **distinct files/modules/questions**. If two seams differ only
  by an item number or a broad file glob, merge them.
- Each seam has an **expected output shape** the parent can verify without
  re-reading everything the child read.
- A mutation seam declares its writable scope; read-only seams declare "no
  edits". Never let two mutation seams share a worktree.

## 2. Map seams to agents

| Seam type | Agent candidates | Notes |
|---|---|---|
| Codebase recon, file mapping | `scout`, `cyberbrain.*` analyst | Read-only, `low` thinking per `pick-model` |
| External/current research | `researcher` | Requires a verified search route; see `pick-model`'s search table |
| Focused implementation | `worker`, `cyberbrain.typescript-pro`, `cyberbrain.test-automator` | One writer per worktree |
| Independent review | `reviewer`, `cyberbrain.code-reviewer`, `cyberbrain.qa-expert` | Fresh context, must not share the writer's session |
| Plan synthesis, tradeoff decision | `planner`, `oracle`/`advisor` | The single allowed `high` lane |
| API/docs/perf/tooling specialization | matching `cyberbrain.*` role | Role text comes from canonical profiles |

Then apply `pick-model`: parent-model inheritance by default,
per-lane `thinking`, user-approved alternates only. Every launch call states its
chosen `thinking` explicitly.

## 3. Launch shape

Use the pi-subagents `subagent` tool. Prefer `async: true` for clusters unless
the user asked for run-to-completion in this turn.

Parallel fanout (independent seams):

```typescript
subagent({
  tasks: [
    { agent: "scout", task: "S1: <seam>. Read-only. Expected output: <shape>.", thinking: "low" },
    { agent: "reviewer", task: "S2: <seam>. Do not edit files. Expected output: <shape>.", thinking: "medium" }
  ],
  concurrency: 2,
  context: "fresh",
  async: true
})
```

Sequential pipeline (dependent seams):

```typescript
subagent({
  chain: [
    { agent: "scout", task: "Map <surface>; read-only.", as: "context" },
    { checkpoint: "review-scope", message: "Seams approved?" },
    { agent: "worker", task: "Implement per {context}. Writable scope: <files>." },
    { agent: "reviewer", task: "Independently review the writer's changes from {chain_dir}." }
  ],
  async: true
})
```

Call-shape rules:

- Every `task` carries its seam id, mutation boundary, and expected output —
  never a bare "review this" or "implement the plan".
- Use a `{ checkpoint: ... }` before any mutation step the user has not already
  approved.
- Do not clone prompts across children with only names swapped; that fails the
  seam rule.

## 4. Supervise

While children run:

- Do not duplicate assigned work. Parent-side work is reading unaffected
  context, preparing synthesis, or reviewing completed child output.
- Watch with `subagent({ action: "status", view: "fleet" })`; verify each child
  resolved to the intended model/thinking.
- Guide a live run with `steer`; revive a finished or failed child with
  `resume`. A `stopped` run is not resumable — decompose a replacement seam
  instead of blindly relaunching the same prompt.
- If a child hits a model/scope rejection, do not silently swap models. Surface
  it; alternate models require the `pick-model` approval path.

## 5. Fan-in and acceptance

A cluster is done only when the synthesis step has run. The synthesizer is
normally the parent.

For each child output:

1. Check it against its seam's expected output shape — missing shape means the
   seam is unresolved, not "probably fine".
2. Check mutation seams against their declared writable scope — out-of-scope
   edits are findings, not free value.
3. Merge child findings into one answer; name disagreements between children
   instead of averaging them away.
4. State residual risk: what no seam covered, what was assumed, what failed.

Completion report:

```text
Cluster goal:
Seams: resolved / failed / partial (per seam)
Writer changes: verified scope, files touched
Review findings: blocking / non-blocking
Residual risk:
Done means (restated): met | not met — evidence
```

## Anti-patterns

- Launching a fleet to avoid reading the code yourself.
- Every child at `high` thinking on the parent model "to be safe".
- Two writers, one worktree.
- Merging child outputs without checking them against the seams.
- Reporting "cluster done" when children finished but synthesis never ran.
- Retrying a failed seam with an identical prompt and expecting a different
  result.
