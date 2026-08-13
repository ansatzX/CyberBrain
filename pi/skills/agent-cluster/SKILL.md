---
name: agent-cluster
description: Launch and supervise a Pi subagent cluster end to end. Use when a task needs multiple cooperating subagents — parallel fanout, research chains, review fleets, or plan/implement/verify pipelines — covering the JS-like workflow script (a semantic spec, translated to native calls, never executed), seam decomposition, launch call shape, fatal-vs-per-item failure discipline, agent caps, async monitoring, interruption, fan-in acceptance, and the durable run record. Model and thinking choices delegate to pick-model; coordination discipline delegates to team-leader.
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

- The user explicitly asks for a workflow or large multi-agent orchestration.
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
- The work is one goal pushed forward over many rounds — that is a fixed-policy
  loop (`paseo-loop` or the tachikoma pi resume loop), not a fanout cluster.

Default: when uncertain between one agent and a cluster, use one agent. Clusters
are the exception.

## 1. Declare the workflow — script semantics before agents

Write the orchestration as a **workflow script in JS-like pseudocode** before
any launch call. The script is a semantic specification, never executed: the
parent reads it, validates its shape, and translates it into native subagent
calls. Governance fields stay as text around the script.

```js
// workflow: <kebab-case name>          # display name + persistence key
// goal: <one line>
// done-means: <observable acceptance criteria>
// writer: <exactly one, or "none — read-only cluster">
// synthesizer: <who merges child outputs, usually the parent>
// max-agents: <n>                       # total-agent cap; exceeding it stops
//                                       # the cluster, it does not reroute
// failure-plan: <per-seam fallback + abort condition>

phase("P1: scope mapping");            // progress grouping only; no execution semantics
const map = parallel([
  () => agent("S1: map module A; read-only.", { label: "map-a", schema: { files: "string[]" } }),
  () => agent("S2: map module B; read-only.", { label: "map-b", schema: { files: "string[]" } }),
]);

phase("P2: implement");
const impl = await agent("S3: implement per S1/S2. Writable scope: <files>.", { label: "impl" });

phase("P3: review");
const review = await agent("S4: independently review the writer's changes.", { label: "review" });

return { map, impl, review };          // the synthesis deliverable the parent must materialize
```

### Vocabulary — semantics table

The parent translates each construct into native subagent calls; children never
see the script:

| Script construct | Semantic | Native mapping |
|---|---|---|
| `agent(prompt, { label, phase?, schema? })` | one child run; `schema` = the seam's expected output shape | one `{ agent, task }` entry; task carries seam id, label, shape; `schema` becomes `outputSchema` — **which must have an object root** (pi rejects non-object schemas) |
| `parallel([thunks])` | independent children; a child failure is a per-item `null`, not a script error | `subagent({ tasks, concurrency, context: "fresh" })` |
| `pipeline(items, stage, ...stages)` | every item passes through every stage; per-item failure stays per-item | a `chain` of parallel steps, one step per stage over all items |
| sequencing (`const x = await agent(...)`) | dependent seams with data flow | `chain` steps; later steps read `{previous}` / `{chain_dir}` |
| `phase(title)` | progress grouping only — never a control construct | phase tags on tasks, aggregated in the run record and completion report |
| `log(message)` | narration line | a line in the run record's `session.log` |
| `return <json>` | the synthesis deliverable | fan-in: the parent materializes this value and reports it |
| header comments (`workflow:`, `goal:`, ...) | identity + governance, not executed | run record key, declaration fields |

### Validation before launch

Shape-check the script first; a malformed declaration aborts, it does not launch:

- Each seam names **distinct files/modules/questions**. If two seams differ only
  by an item number or a broad file glob, merge them.
- Every fan-in seam (an `agent()` whose result feeds `return` or a later step)
  carries a `schema`; a missing schema on such a seam is an orchestration error.
- A mutation seam declares its writable scope in its prompt; read-only seams
  declare "read-only". Never let two mutation seams share a worktree.
- Pure parallel fanout carries no native `phase`/`label` fields on task
  entries — the parent tags phases in the run record itself. Chain steps do
  carry native `phase`/`label` fields.
- Fan-in consumes structured results from their saved output, never from the
  aggregated textual projection (which may read as empty for `outputSchema`
  tasks).
- Script-level misuse — an unknown `agent()` option, a pipeline whose
  `items × stages` exceeds the `max-agents` cap, a child that mutates outside
  its declared scope — is an **orchestration error**: abort the cluster and
  report it. It must never dissolve into a per-item retry.
- The caps and routing are the parent's deployment decision: no prompt text
  inside the script may override them.

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

## 3. Launch shape — translate the script semantics

Use the pi-subagents `subagent` tool. Prefer `async: true` for clusters unless
the user asked for run-to-completion in this turn. Launch calls are the
parent's faithful translation of the workflow script: each `agent()` becomes a
task entry, each `parallel()` one fanout, each `await` sequence one chain step.

Parallel fanout (independent seams):

```typescript
subagent({
  tasks: [
    { agent: "scout", task: "S1: <seam>. Read-only. Expected output: <shape>.", thinking: "low", outputSchema: { files: "string[]" } },
    { agent: "reviewer", task: "S2: <seam>. Do not edit files. Expected output: <shape>.", thinking: "medium" }
  ],
  concurrency: 2,
  context: "fresh",
  async: true
})
```

Sequential pipeline (dependent seams; a `pipeline(items, stage1, stage2)`
becomes a chain of two parallel steps):

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

- Every `task` carries its seam id, phase, mutation boundary, and expected
  output — never a bare "review this" or "implement the plan".
- Use a `{ checkpoint: ... }` before any mutation step the user has not already
  approved.
- Do not clone prompts across children with only names swapped; that fails the
  seam rule.
- A launch call that contradicts the script's semantics (a missing `await`
  dependency, a `schema` dropped from a fan-in seam, an agent cap already
  spent) is an **orchestration error**: abort the cluster and report it. Never
  silently adjust the plan to make a malformed launch succeed.

## 4. Supervise

While children run:

- Do not duplicate assigned work. Parent-side work is reading unaffected
  context, preparing synthesis, or reviewing completed child output.
- Observe with `subagent({ action: "status", view: "fleet" })` — snapshots are
  read-only; observing never transfers run control. Do not steer a healthy
  child just because you can.
- **Classify every failure**: a child failure is a per-seam event, handled at
  fan-in against the seam's failure plan; an orchestration error (declaration
  violation, shape mismatch, agent cap exceeded, budget exhausted) aborts the
  whole cluster and is reported as such. Per-item failure must never dissolve
  into a silent "partial success", and orchestration failure must never be
  retried as if it were a bad child.
- The `Max agents` cap is a runaway-loop backstop. If the cluster would need
  more agents than declared, stop and re-declare — do not overflow silently.
- Interruptions are bounded: `interrupt` pauses a live run; `stop` ends it and
  `stopped` runs are not resumable. Before reporting completion, reach
  **quiescence**: no active child run may remain.
- Guide a live run with `steer`; revive a finished or failed child with
  `resume`. A `stopped` run is not resumable — decompose a replacement seam
  instead of blindly relaunching the same prompt.
- If a child hits a model/scope rejection, do not silently swap models. Surface
  it; alternate models require the `pick-model` approval path.

## 5. Constrain, don't trust

Children comply because the parent **restricts capability, gates output, and
verifies at fan-in** — never because a child promises to. Map every demand in
the script to a mechanism:

| Demand in the script/declaration | Mechanism that enforces it |
|---|---|
| Seam output shape (`schema`) | `outputSchema` — a non-conforming final response is rejected, not accepted |
| Child must not see parent context | `context: "fresh"` (or `fork`); the child sees only its task string |
| Child may only touch certain files | `reads: ["..."]` allowlist (or `false`) |
| Bounded exploration, no runaway | `toolBudget` (hard cap; `block` cuts tools after) + `turnBudget` (abort after grace) |
| One writer per worktree | `worktree: true` — isolated git worktrees |
| User approval before a mutation step | `{ checkpoint }` in the chain |
| A later stage may not run on unverified output | chain step `gateOn: "acceptance"` |
| Claims about changed files / tests must be evidenced | `acceptance: { level, evidence }` with `changed-files`, `commands-run`, `tests-added`, ... |
| Independent review duty | `acceptance.review.required` — a fresh-context reviewer must verify before the result counts |
| Cap and routing stay the parent's decision | the child never sees the script, caps, or model routing — they exist only in the parent's launch call |
| Total fleet bound | `Max agents` in the declaration, checked against the spawn budget |

What pi cannot mechanically deny: there is **no per-child write block** in the
task schema. A read-only seam is enforced by role choice (read-only agents),
`reads` allowlists, and the fan-in diff check — the parent verifies that a
read-only seam staged nothing. Treat role promises as unverified until the
fan-in check passes.

## 6. Fan-in and acceptance

A cluster is done only when the synthesis step has run and the run record is
closed. The synthesizer is normally the parent; synthesis **materializes the
script's `return` value** — that value is the deliverable, and partial child
outputs are never reported as it.

For each child output:

1. Check it against its seam's expected output shape — missing shape means the
   seam is unresolved, not "probably fine".
2. Check mutation seams against their declared writable scope — out-of-scope
   edits are findings, not free value.
3. Merge child findings into one answer; name disagreements between children
   instead of averaging them away.
4. State residual risk: what no seam covered, what was assumed, what failed.

### Durable run record

Keep the cluster's durable record outside the context, per the tachikoma
shared agent-cli protocol §6: one record per cluster under
`.tachikoma/<workflow-name>/`, opened when the cluster starts and closed only
when synthesis and quiescence are reached. Every member entry pairs a start
and an end by seam sequence number; a record whose tail is missing an ending
is evidence of interruption, not corruption. The summary is the only file that
may enter context in full — never replay child output transcripts.

Completion report:

```text
Workflow: <name>
Phases: <per-phase progress>
Seams: resolved / failed / partial (per seam)
Agents started: <n> of max <cap>
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
- Dissolving an orchestration error into a per-seam retry, or reporting
  partial output as success.
- Letting a child prompt override the declaration's caps, routing, or writable
  scope.
- Using a fanout cluster for a goal that needs a fixed-policy loop
  (`paseo-loop` or the tachikoma pi resume loop with
  continue / complete / blocked status).
