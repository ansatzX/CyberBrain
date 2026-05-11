---
name: state-machine
description: "Always-active project-state foundation for primary agents and subagents. Use to locate or create a project-local state file, track claim-bearing state transitions, and escalate from lightweight ledger entries to an explicit state machine for long, ordered, resumable, or multi-agent work."
---

# State Machine

Use this skill in every agent or subagent that may inspect, modify, summarize, or declare completion over project state. Coding, data processing, refactoring, analysis, file packaging, CI fixes, report generation, and multi-step research workflows all qualify.

Core principle: **state transitions make claims**. A transition that is not recorded cannot support a strong completion claim.

## Always-On Start

At the start of work:

1. Identify the project root whose state is being handled.
2. Look for an existing project-local state file. Default: `.agent/state.md`.
3. If no state file exists, create one when the work has more than one meaningful transition, may be resumed, uses subagents, or will end in a correctness/completion claim.
4. If the task is purely conversational or read-only, do not create a file; keep the state check internal and do not claim state changed.
5. Subagents must use the same state file as the parent project unless explicitly assigned a separate workspace. They should record transitions they own and must not erase or rewrite transitions owned by others.

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

Records live in the project being modified, not in the global agent config.

Default path:

```text
.agent/state.md
```

If the project already has a local agent/state convention, use that path and note it. The state file belongs to the project under work, not the skill repository unless the skill repository itself is the object.

Initialize new files with:

```text
# Task State

Object:
Current State: DISCOVERED
State Owner:
Last Updated:

## Open Gaps

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
Evidence:
Failure Mode:
Verification:
Status: proposed | verified | exploratory | blocked | superseded
```

Keep entries concise. Use `Unknown` rather than inventing. `Unknown` may be acceptable for exploratory work, but it cannot support a strong completion claim.

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

## Hard Rules

- No ledger entry -> no strong claim from that transition.
- No authority -> transition is exploratory, not verified.
- No verification -> do not call the resulting state done.
- Substitution without equivalence evidence -> deviation, not replacement.
- Lost information not named -> downstream consumers must not assume preservation.
- Derived artifacts do not prove authority alignment.
- Completion is a final transition, not a conversational flourish.

## Completion Entry

Before saying work is complete, add or update a final entry:

```text
## Completion

Target State:
Observed State:
Evidence:
Verification Layer: programming | numerical | scientific | operational | visual | human-review
Known Gaps:
Responsibility Owner:
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
