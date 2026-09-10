---
name: state-machine
description: "Track meaningful project changes and verification, using an internal check for read-only tasks and a local ledger or state DAG when recovery and ordering matter."
---

# State Machine

Choose the recording level by the consequences of state changes. The record
supports evidence; it is not a prerequisite for every answer.

| Level | When | Artifact |
| --- | --- | --- |
| L0 | Conversation, read-only inspection, or a simple lookup | Internal check; no file or task creation |
| L1 | Ordinary changes with meaningful verification | One local state node |
| L2 | Ordered source/transform/verification gates | Node with explicit gate evidence |
| L3 | Resumable or coordinated changes | Nodes with dependency edges and ownership |

**L0 is exempt from all ledger, state-file, script-record and completion-entry
requirements below.** A read-only review may reach an evidence-backed conclusion
and end without creating files. Cite inspected evidence and disclose limits in
the answer. Do not escalate merely because you will summarize findings.

## Local node (L1 and above)

Use `.state-machine/<node-id>.md` inside the current workspace or its existing
state-record convention. Each agent owns its own node; children reference their
parents and never edit a parent's node. Use an internal record if writes are
not authorized; do not request write access just for bookkeeping.

```text
Node ID:
Parent Nodes: none | dependency paths
Working Directory:
Object and requested outcome:
State Owner:
Current State:
Open Gaps:
Evidence Register:
```

Record meaningful selection, transformation, substitution, deletion or completion
as a concise entry. Batch mechanical reads; do not log every command separately.

```text
Before -> After:
Action and authority:
Evidence and verification:
Lost information / failure mode:
Object drift: none | possible | changed
Status: exploratory | verified | blocked | superseded
```

Evidence may be source authority, direct observation, user endorsement, proxy or
absence. A proxy or unsuccessful search alone does not verify a stronger claim.
Use Unknown instead of inventing evidence. Keep execution success distinct from
numerical, scientific, visual or operational correctness.

## Gates and coordination

For L2/L3, use domain-specific states such as DISCOVERED -> SOURCES_MAPPED ->
TRANSFORMED -> VERIFIED -> CLAIM_READY. Each advance names its gate evidence.
Do not jump from an artifact existing to its correctness being verified.

Keep dependencies acyclic. Assign source-of-truth ownership, write scopes,
verification responsibility and cleanup responsibility explicitly. A substitute
needs equivalence evidence; otherwise report the deviation. If the object drifts
from the user's goal, resolve that before claiming completion.

Store non-trivial ad hoc scripts under `.scripts/<timestamp>-<purpose>` when
they support reproducibility; repository scripts and tests already have durable
paths and need no duplicate. Record inputs, purpose, outputs and verification.
Routine shell commands and short exploratory probes need no wrapper script.

## Completion (L1 and above only)

Record requested outcome, observed result, verification commands/evidence,
unresolved gaps, cleanup owner and drift check. Mark each relevant layer passed,
failed, unknown or not-required. A pending layer prevents claiming that layer
complete; it need not prevent reporting a narrower verified result.

Then give the user the result, changes, tests and material limits. Stop at the
authorized outcome. Do not recursively audit the audit record or create another
state node solely to record this completion entry.
