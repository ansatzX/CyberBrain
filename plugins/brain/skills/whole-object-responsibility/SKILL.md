---
name: whole-object-responsibility
description: "Use when evaluating complex systems, agent OS design, workflow engines, automation, HPC, infrastructure, distributed systems, protocols, organizations, division of labor, responsibility gaps, bypass paths, hidden state, or local compliance with unclear global ownership."
---

# Whole-Object Responsibility

## Overview

Use this skill when a system is complex, specialized, automated, or procedural enough that local steps can look reasonable while the whole object, state, failure path, or responsibility disappears.

**Core principle:** preserve understanding, judgment, and responsibility for the whole object inside divided systems.

## Iron Law

```text
NO SYSTEM-LEVEL CLAIM WITHOUT OBJECT-STATE-CONTROL-FAILURE-RESPONSIBILITY CHAINS
```

If every local step is compliant but no one owns the whole, flag responsibility evaporation.

## Terms

Weak models must use these meanings, not guess.

| Term | Meaning |
| --- | --- |
| `whole object` | The full thing or consequence the system is actually handling, beyond local tasks or components. |
| `boundary` | The real system edge: what is inside/outside, what assumptions hold, what can affect the outcome. |
| `state` | The current facts the system depends on: files, memory, database rows, workflow state, queue state, credentials, provenance, environment. |
| `state owner` | Who or what maintains the authoritative state. |
| `control chain` | The path by which decisions become actions: policy, scheduler, workflow, API, shell, human approval, tool call. |
| `constraint` | A real restriction on action, not merely a guideline: permission, scheduler limit, type check, workflow policy, proof obligation. |
| `operation` | What a component actually does to the object or state. |
| `bypass path` | A way to avoid the intended control or epistemic layer, such as an agent using raw shell instead of a workflow system. |
| `failure path` | How errors become visible or invisible, how the system can fail, and where failure is handled. |
| `local role` | A component, team, agent, protocol step, or subsystem with limited responsibility. |
| `global consequence` | What all local actions produce together. |
| `protocol` | A standardized procedure for action or coordination. Useful, but not a substitute for judgment. |
| `local rationality` | Each local action is defensible in its own narrow context. |
| `global blindness` | No one can see or judge what the local actions produce together. |
| `responsibility evaporation` | Everyone follows protocol, but no one owns interpretation, cleanup, harm, or consequence. |
| `productive function` | The real value specialization or protocol provides: scale, safety, comparability, reproducibility, cost reduction, recovery. |
| `over-dismissal risk` | The critique ignores the system's real productive function because its narrative is inflated or immature. |

## Anti-Nominalization

Do not accept system nouns as explanations.

When you see labels like `agent`, `workflow`, `AI4S`, `automation`, `HPC platform`, `inference framework`, `web search`, `symbolic reasoning`, `tool use`, `end-to-end pipeline`, reduce them to:

```text
name -> object -> state -> representation -> constraints -> operations -> failure paths -> responsibility owner
```

Ask:

- What object is actually being operated on?
- Where is the state?
- What constraints are real?
- What operation happens?
- What can bypass the official path?
- What fails, and where is failure visible?
- Who owns final interpretation and cleanup?

## Audit Template

Use `Unknown` when missing.

```text
Whole Object:
Boundary:
Local Roles:
Global Consequence:
Object Chain:
State Owner:
Control Chain:
Constraints:
Bypass Paths:
Failure Visibility:
Cleanup Owner:
Responsibility Chain:
Productive Function:
Over-Dismissal Risk:
Verdict:
```

## Procedure

### 1. Recover The Whole Object

Identify what the whole system is really handling. Do not stop at component labels, tickets, APIs, diagrams, or workflow steps.

### 2. Trace Local To Global

Map how local roles compose:

```text
local role -> local action -> state change -> global consequence
```

If local actions are clear but global consequence is unclear, flag `local rationality, global blindness`.

### 3. Trace State And Control

Ask:

- What state is authoritative?
- Who can mutate it?
- What path turns decisions into actions?
- What constraints are enforced rather than merely described?
- What can bypass the intended layer?

Execution bypass is a responsibility failure, not just a tooling bug.

### 4. Trace Failure And Cleanup

Ask:

- How does failure become visible?
- Who is paged, blocked, or forced to decide?
- Can the system silently continue after epistemic failure?
- Who cleans up bad state, bad outputs, or bad consequences?

No cleanup owner means no complete responsibility chain.

### 5. Preserve Productive Specialization

Do not treat specialization as the enemy. Identify what the division of labor makes possible:

- Scale.
- Safety.
- Reproducibility.
- Comparability.
- Coordination.
- Recovery.
- Cost reduction.
- Specialized expertise.

Then separate:

```text
Productive Function:
Inflated Narrative:
Responsibility Gap:
Narrow Valid Claim:
```

## Red Flags

- Everyone followed protocol, but no one owns the consequence.
- The diagram is clear, but the object is unclear.
- The system state is hidden, scattered, or unowned.
- The execution layer can bypass the epistemic or workflow layer.
- A workflow is treated as judgment.
- An agent action is treated as subjectivity.
- A platform is called "end-to-end" to avoid naming responsibility.
- The system is more efficient while boundaries and failure paths are less visible.
- The critique dismisses the system before identifying its productive function.

## Verdicts

- `Aligned`: object, state, control, failure, and responsibility are visible.
- `Local rationality, global blindness`: local actions are defensible, but the whole consequence is not understood.
- `Responsibility evaporation`: protocol compliance exists, but no final owner exists.
- `Execution bypass`: action can avoid the intended control or epistemic layer.
- `Workflow theater`: process organization substitutes for judgment.
- `Decorative abstraction`: abstraction looks clean but hides object, state, failure, or responsibility.
- `Empty advancedness`: features or packaging do not improve object contact, control, verification, or responsibility.
- `Over-dismissal risk`: critique ignores real productive function.

## Bottom Line

For any complex system, first ask about object, boundary, state, control, failure path, and responsibility chain instead of accepting its name and narrative.
