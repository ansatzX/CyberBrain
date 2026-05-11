---
name: state-machine
description: "Always-active project-state foundation for primary agents and subagents. Use to create a working-directory-local state node, track claim-bearing state transitions, and escalate from lightweight ledger entries to an explicit state machine for long, ordered, resumable, or multi-agent work."
---

# State Machine

Use this skill in every agent or subagent that may inspect, modify, summarize, or declare completion over project state. Coding, data processing, refactoring, analysis, file packaging, CI fixes, report generation, and multi-step research workflows all qualify.

Core principle: **state transitions make claims**. A transition that is not recorded cannot support a strong completion claim.

## Effort Levels

Always run the state-machine check, but scale the artifact:

| Level | Use When | Required Artifact |
| --- | --- | --- |
| `L0 internal` | Purely conversational, read-only, or no project state changes. | No file. Keep the state check internal. |
| `L1 node` | One agent performs ordinary work with meaningful transitions or a completion claim. | One `.state-machine/<node-id>.md` file. |
| `L2 gated` | Ordered correctness gates exist: source before transform, transform before artifact, verification before claim. | State node with explicit states, gate evidence, and progress matrix. |
| `L3 coordinated` | Multiple agents, resumable work, high-risk state, or user-visible correctness claims. | Parent/child state nodes, role separation, object drift checks, and completion matrix. |

Do not choose a lower level because the task feels easy. Choose by state risk: how much later reasoning will depend on this transition being correct.

## Always-On Start

At the start of work:

1. Identify the current agent working directory. State records must stay inside that directory or its writable workspace; do not write outside the sandbox.
2. Assign a stable node id for this agent or subagent, such as `root`, `codex-main`, `worker-auth`, or `explorer-logs`.
3. Choose effort level `L0` through `L3`.
4. Create or update this agent's own state node for `L1` and above.
5. If the task is `L0`, do not create a file; keep the state check internal and do not claim state changed.
6. Subagents write their own state node, not the parent's file. Each child node declares its parent node at the top. The parent may summarize child nodes later, but children never edit parent state.

## Claim-Bearing Actions

Record an entry before or immediately after any meaningful action that:

- **Selects** an authority source, file, API, dataset, config, branch, or log.
- **Transforms** state by parsing, converting, filtering, aggregating, normalizing, refactoring, or migrating.
- **Substitutes** one implementation, source, function, model, dependency, or fallback for another.
- **Summarizes** detailed state into a conclusion, report, metric, chart, issue, or PR comment.
- **Stores** an intermediate artifact, cache, export, generated file, checkpoint, or packaged result.
- **Deletes / ignores** state that could affect the object.
- **Presents** state through a table, figure, UI, visualization, or natural-language claim.
- **Completes** work by saying done, fixed, passing, reproduced, migrated, or ready.

Purely mechanical reads and formatting-only edits do not require a ledger entry unless the result is used as evidence for a claim. If unsure, record a short entry.

## State File Location

Records live in the current agent working directory, not in global agent config and not outside the sandbox.

Default directory:

```text
./.state-machine/
```

Default node file:

```text
./.state-machine/<node-id>.md
```

If the project already has a local state-machine convention, use that path and note it. The state file belongs to the working directory under the current agent's control. If the object being modified lives elsewhere, record the external path as state being acted on, but keep the state node in the working directory.

Initialize new files with:

```text
# State Node

Node ID:
Parent Node: none | <relative path to parent node>
Working Directory:
Object:
Current State: DISCOVERED
State Owner Role:
Last Updated:

## Child Nodes

- None

## Open Gaps

- Unknown

## Evidence Register

- Unknown

## Transitions
```

## Lightweight Ledger Protocol

For ordinary work, add one entry per meaningful transition:

```text
## T001 - Short Title

Before State:
Action:
After State:
Implicit Claim:
Authority:
Representation / Proxy:
Lost Information:
Evidence IDs:
Evidence Quality: authority | direct | proxy | absence | human | mixed
Failure Mode:
Verification:
Object Drift: none | possible | changed
Status: proposed | exploratory | blocked | verified | superseded
```

Keep entries concise. Use `Unknown` rather than inventing. `Unknown` may be acceptable for exploratory work, but it cannot support a strong completion claim.

## Evidence Quality Ladder

Classify evidence before using it to advance state:

| Quality | Meaning | May advance to `VERIFIED`? |
| --- | --- | --- |
| `authority` | Source-of-truth record: spec, command log, schema, notebook cell, API contract, test oracle, user-approved requirement. | Yes, if applicable and checked. |
| `direct` | Inspected artifact, exact output, trace, diff, rendered screenshot, opened file, executed test result. | Yes, when it directly matches the claim layer. |
| `proxy` | Filename, directory name, convention, heuristic, similarity, model guess, inferred pattern. | No. It supports only `exploratory`. |
| `absence` | Search or inspection found no contrary reference. | No by itself. It can support gaps or risk notes. |
| `human` | User correction, review, endorsement, or domain judgment. | Yes for the scope the human explicitly endorsed. |
| `mixed` | Multiple evidence types. | Only if the authority/direct/human evidence is sufficient without relying on proxy evidence. |

Hard rule: proxy evidence cannot justify `VERIFIED`, `CLAIM_READY`, or completion. If authority and proxy conflict, authority wins unless the user explicitly overrides it.

## Role And Authority Separation

Use roles instead of vague ownership:

| Role | May Do |
| --- | --- |
| `observer` | Record observations, evidence, unknowns, and risks. |
| `actor` | Record actions taken and artifacts generated. |
| `verifier` | Mark a transition or progress layer as verified, with evidence. |
| `coordinator` | Advance the parent/global state after reviewing child nodes. |
| `human-owner` | Endorse domain judgment, tacit knowledge, final acceptance, or user-only gates. |

Subagents default to `observer` and `actor` for their own node. They should not advance a parent/global node to `VERIFIED` or `CLAIM_READY` unless explicitly assigned the `verifier` or `coordinator` role.

## Object Drift Check

Before state advances to `VERIFIED`, `CLAIM_READY`, or completion, check:

```text
Original Object:
Current Object:
Changed: no | possible | yes
Drift Evidence:
Approval / Owner:
Action:
```

If `Changed` is `possible` or `yes`, do not advance the state until the drift is resolved or explicitly approved. Local engineering progress does not justify object drift.

## Base-Case Check: Dataflow And Coding

The retrospective failure mode this skill must prevent is: local coding progress creates artifacts while the object, authority source, and verification drift.

For any dataflow or coding transition, explicitly distinguish:

- **Authority state**: the source of truth being read or followed.
- **Derived state**: files, caches, exports, generated code, figures, reports, or summaries produced from it.
- **Boundary**: what the derived state is allowed to mean.
- **Substitution**: whether an implementation, data source, or analysis function was replaced.
- **Equivalence evidence**: why the substitute is equivalent; if absent, mark it as deviation.

Default statuses:

- Authority not checked -> `blocked` or `exploratory`.
- Derived artifact exists but verification is missing -> `exploratory`.
- Substitute lacks equivalence evidence -> `exploratory` or `blocked`, not `verified`.
- Final output differs from target without explanation -> `blocked`.

## State Machine Escalation

Add a lightweight state machine section when the task is long, ordered, resumable, correctness-sensitive, or involves multiple agents/tools mutating the same object.

Escalation is mandatory when a task has ordered correctness gates, such as source mapping before transformation, transformation before artifact generation, or verification before completion.

```text
# Task State

Object:
Current State:

Allowed States:
- DISCOVERED
- SOURCES_MAPPED
- TRANSFORMS_SPECIFIED
- ARTIFACTS_GENERATED
- VERIFIED
- CLAIM_READY

Invalid Jumps:
- DISCOVERED -> CLAIM_READY
- DISCOVERED -> ARTIFACTS_GENERATED
- ARTIFACTS_GENERATED -> CLAIM_READY
```

Use domain-appropriate state names. The point is not the specific labels; the point is to make forbidden shortcuts visible.

When moving between states, record:

```text
## State Advance

From:
To:
Transition IDs:
Gate Evidence:
Known Gaps:
Owner:
```

Gate examples:

- `SOURCES_MAPPED`: authority sources are named and checked.
- `TRANSFORMS_SPECIFIED`: transformations and substitutions are named; deviations are marked.
- `ARTIFACTS_GENERATED`: derived artifacts exist and their boundary is recorded.
- `VERIFIED`: verification matches the claim layer.
- `CLAIM_READY`: completion evidence exists and known gaps are stated.

Before entering `VERIFIED` or `CLAIM_READY`, run the object drift check and progress matrix. These are gates, not optional notes.

## Progress Matrix

Use a matrix when "done" has multiple layers. Each layer is `not-required`, `pending`, `passed`, `failed`, or `unknown`.

```text
Programming:
Data / State:
Operational:
Numerical:
Scientific:
Visual:
Human Review:
```

Only layers marked `passed` or `not-required` can support completion. If a layer is `unknown`, say what claim remains unsupported.

## Hard Rules

- No ledger entry -> no strong claim from that transition.
- No authority -> transition is exploratory, not verified.
- No verification -> do not call the resulting state done.
- Substitution without equivalence evidence -> deviation, not replacement.
- Lost information not named -> downstream consumers must not assume preservation.
- Derived artifacts do not prove authority alignment.
- Proxy evidence cannot advance state beyond exploratory.
- Object drift blocks verification until resolved or explicitly approved.
- Completion is a final transition, not a conversational flourish.

## Completion Entry

Before saying work is complete, add or update a final entry:

```text
## Completion

Target State:
Observed State:
Evidence IDs:
Evidence Quality:
Verification Layer: programming | numerical | scientific | operational | visual | human-review
Progress Matrix:
Known Gaps:
Responsibility Role:
Object Drift Check:
Narrow Claim:
Status: verified | exploratory | blocked
```

If verification only proves that code ran, say so. Do not use programming verification as evidence of numerical, scientific, operational, or visual correctness.

## Relationship To Other Brain Skills

- Use `using-ansatz-brain` to decide when this skill is needed.
- Use `whole-object-responsibility` when the whole system, ownership, failure path, or cleanup chain is unclear.
- Use `think-before-you-calculate` before running calculations, simulations, searches, benchmarks, training, or other tool-heavy workflows.
- Use `epistemic-systems-audit` when judging scientific claims, benchmark evidence, or paper claims.

This skill records the state transitions those skills reason about.
