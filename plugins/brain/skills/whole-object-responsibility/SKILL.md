---
name: whole-object-responsibility
description: "Use when evaluating complex systems, agent OS design, workflow engines, automation, HPC, infrastructure, distributed systems, protocols, organizations, division of labor, responsibility gaps, bypass paths, hidden state, or local compliance with unclear global ownership."
---

# Whole-Object Responsibility

## Overview

Use this skill when a system is complex, specialized, automated, or procedural enough that local steps can look reasonable while the whole object, state, failure path, or responsibility disappears.

**Core principle:** preserve understanding, judgment, and responsibility for the whole object inside divided systems.

This skill has two phases: **Interrogate** — strip away names and narratives to find what actually operates; **Record** — write the findings into a structured audit.

It pairs with `state-machine`: this skill defines the whole object, state, control, failure, and responsibility chain; `state-machine` records the claim-bearing transitions that occur while acting on that object.

## Iron Law

```text
NO SYSTEM-LEVEL CLAIM WITHOUT OBJECT-STATE-CONTROL-FAILURE-RESPONSIBILITY CHAINS
```

If every local step is compliant but no one owns the whole, flag responsibility evaporation.

## Terms

These terms are the shared vocabulary across both phases. Weak models must use these meanings, not guess.

| Term | Meaning |
| --- | --- |
| `whole object` | The full thing or consequence the system is actually handling, beyond local tasks or components. |
| `boundary` | The real system edge: what is inside/outside, what assumptions hold, what can affect the outcome. |
| `state` | The current facts the system depends on: files, memory, database rows, workflow state, queue state, credentials, provenance, environment. |
| `state owner` | Who or what maintains the authoritative state. |
| `representation` | How the object enters the system: coordinates, graph, data format, API schema, prompt structure, file layout, protocol encoding. |
| `constraint` | A real restriction on action, not merely a guideline: permission, scheduler limit, type check, workflow policy, proof obligation, memory bound. |
| `operation` | What actually happens to the object or state when a component acts. |
| `control chain` | The path by which decisions become actions: policy, scheduler, workflow, API, shell, human approval, tool call. |
| `bypass path` | A way to avoid the intended control or epistemic layer, such as an agent using raw shell instead of a workflow system. |
| `failure path` | How errors become visible or invisible, how the system can fail, and where failure is handled. |
| `cleanup owner` | Who is responsible for fixing bad state, bad outputs, or bad consequences after failure. |
| `responsibility owner` | Who owns final interpretation, judgment, and endorsement of the system's output. |
| `tacit-unwritten` | What the human knows but the document, paper, code, or protocol does not contain: conventions, signs, units, boundary conditions, failure experience, physical reasonableness, implicit constraints. Must be externalized before execution or claim. |
| `productive function` | The real value the system provides: speed, scale, safety, reproducibility, comparability, coordination, cost reduction. |

## Phase 1: Interrogate

Strip away names and narratives. Do not accept system labels as explanations.

<HARD-GATE>
For explicit audits, design reviews, long workflows, and high-risk state changes, you MUST address each interrogation chain node in order before making system-level claims. A node addressed with `Unknown` (with the reason — Surface, Structural, or Blocking) counts as complete. Skipping a node silently is not allowed.
</HARD-GATE>

For ordinary coding or subagent tasks, use a compact pass instead of a full audit, but still identify the object, authoritative state, failure path, and responsibility owner before claiming success.

### Anti-Pattern: "This System Is Simple Enough To Skip Interrogation"

Every system has hidden state, bypass paths, tacit assumptions, and unowned consequences. Simple-looking systems are where unexamined assumptions cause the most damage — a short script that mutates production state, a small workflow that silently drops errors, a paper whose claims rest on unwritten conventions. The interrogation can be short (a few lines per node for truly simple systems), but you MUST walk the chain.

### Checklist

You MUST create a task for each of these items and complete them in order:

1. **Recover the whole object** — start at the entry point, find what gets transformed. Do not stop at component labels.
2. **Trace local to global** — follow one action through state changes to the downstream consumer. Repeat until the global consequence is visible. If the chain breaks, flag it.
3. **Trace state and control** — find state storage, mutation paths, the control chain, and any bypass paths.
4. **Trace failure and cleanup** — find error handling, failure visibility, and the cleanup owner.
5. **Preserve productive function** — separate what the system actually makes cheaper/faster/safer from its inflated narrative.
6. **Record** — fill the audit template. Every field must be addressed; `Unknown` with a reason (Surface, Structural, Blocking) counts as addressed.

When you see labels like `agent`, `workflow`, `AI4S`, `automation`, `HPC platform`, `inference framework`, `web search`, `symbolic reasoning`, `tool use`, `end-to-end pipeline`, reduce them through the interrogation chain:

```text
name -> object -> state -> representation -> constraints -> operations -> failure paths -> responsibility owner -> tacit-unwritten
```

Ask:

- What object is actually being operated on?
- Where is the state?
- How does the object enter the system (representation)?
- What constraints are real?
- What operations happen?
- What can bypass the official path?
- What fails, and where is failure visible?
- Who owns final interpretation and cleanup?
- What does the human know that the document, code, or protocol does not contain? Fill it or mark Unknown.
- Which state transitions must be recorded by `state-machine` before this object can be called handled?

### Depth Guidance

`Unknown` is an acceptable answer when the input provides no evidence. Do not invent. But distinguish:

- **Surface Unknown**: the answer is in the code/paper, you haven't read that part yet. Keep reading.
- **Structural Unknown**: the answer is not in the code/paper at all. It's tacit knowledge the human must supply. Mark it and move on.
- **Blocking Unknown**: the answer is missing and you cannot proceed reliably without it. Stop and ask the human.

A template field marked Unknown after all chunks are read is a real gap — not a failure of analysis, but a finding in itself.


For domain-specific guidance on applying the chain to papers or code, see:
- `references/reading-papers.md` — paper structure, where tacit knowledge hides, inflation patterns
- `references/reading-code.md` — code entry points, name-vs-behavior, tracing data flow

### Working With Large Inputs

When the input is too large to hold in context at once (long papers, large codebases, multi-module systems):

1. Break the input into chunks: per file, per module, per section.
2. Start the audit template immediately — do not wait until all chunks are read.
3. Apply the interrogation chain to each chunk. Write findings into the template as you go.
4. When a later chunk contradicts or qualifies an earlier finding, update the template. Prefer the later evidence.
5. After all chunks, review every field marked Unknown. Decide: Surface (read more), Structural (ask human), or Blocking (stop).

### Step 1: Recover The Whole Object

Identify what the whole system is really handling.

**How:** Start at the entry point (main function, API handler, workflow trigger, paper abstract). Follow what changes — data, files, state, conclusions. The object is what gets transformed, not the name of the system that transforms it. In a paper: the object is the physical system or phenomenon under study, not the method applied to it.

Do not stop at component labels, tickets, APIs, diagrams, or workflow steps.

### Step 2: Trace Local To Global

Map how local roles compose into the whole.

**How:** Pick one local action. Trace its effect on state. Ask: who sees this state change next? Repeat until you reach the output or consequence the user cares about. If the chain breaks — a state change has no visible downstream effect — flag it.

```text
local role -> local action -> state change -> global consequence
```

If local actions are clear but global consequence is unclear, flag `local rationality, global blindness`.

### Step 3: Trace State And Control

Find what holds truth and who can change it.

**How:** Look for where the system stores facts: files, databases, environment variables, in-memory caches, workflow engines, scheduler queues. For each, ask: who writes to it? Who reads from it? What happens if two writers conflict?

Trace the control chain: starting from a decision (human command, API call, scheduled trigger), follow through policies, scripts, tools, and approvals until it becomes an action on state.

Ask:

- What state is authoritative?
- Who can mutate it?
- What path turns decisions into actions (control chain)?
- What constraints are enforced rather than merely described?
- What can bypass the intended layer?

Execution bypass is a responsibility failure, not just a tooling bug.

When a local action selects, transforms, substitutes, summarizes, stores, deletes, presents, or declares completion over state, record that transition with `state-machine`. Whole-object understanding without state-transition evidence is not enough to support a completion claim.

### Step 4: Trace Failure And Cleanup

Find how the system breaks and who fixes it.

**How:** Look for error handling: try/catch, exit codes, log statements, alerting, rollback logic. For each failure mode, ask: is the failure visible to a human or only to a log file? Does the system halt, degrade, or silently continue? Who is expected to notice and act?

Ask:

- How does failure become visible?
- Who is paged, blocked, or forced to decide?
- Can the system silently continue after epistemic failure?
- Who cleans up bad state, bad outputs, or bad consequences (cleanup owner)?

No cleanup owner means no complete responsibility chain.

### Step 5: Preserve Productive Function

Do not treat specialization as the enemy. Identify what the division of labor makes possible.

**How:** Ask what the system makes cheaper, faster, safer, or more reproducible than the alternative. Then check whether the narrative around the system inflates this real value into a stronger claim.

Identify:

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

## Phase 2: Record

After the interrogation chain is complete, record findings. Use `Unknown` rather than inventing.

```text
Whole Object:
Boundary:
State:
State Owner:
Representation:
Constraints:
Operations:
Control Chain:
Bypass Paths:
Failure Paths:
Cleanup Owner:
Responsibility Owner:
Tacit-Unwritten:
Productive Function:
Verdict:
```

If the audit leads to action, also ensure the project state file records:

```text
State File:
Critical Transitions:
Completion Evidence Needed:
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
- The agent says "done", but no artifact, state change, log, test result, or verification layer is attached.

## Verdicts

- `Aligned`: object, state, control, failure, and responsibility are visible.
- `Local rationality, global blindness`: local actions are defensible, but the whole consequence is not understood.
- `Responsibility evaporation`: protocol compliance exists, but no final owner exists.
- `Execution bypass`: action can avoid the intended control or epistemic layer.
- `Workflow theater`: process organization substitutes for judgment.
- `Completion theater`: agent or workflow reports completion, but the claimed done-state is not tied to inspectable artifacts, state transitions, verification results, and a responsible owner.
- `Decorative abstraction`: abstraction looks clean but hides object, state, failure, or responsibility.
- `Empty advancedness`: features or packaging do not improve object contact, control, verification, or responsibility.
- `Over-dismissal risk`: critique ignores real productive function.

## Key Principles

- **Unknown is a finding, not a failure.** Mark the reason — Surface, Structural, or Blocking. A fully-addressed template with half the fields Unknown is complete; a template with all fields filled but one node silently skipped is not.
- **Write as you go.** Start the audit template immediately. Do not wait until all chunks are read — findings decay in context.
- **Prefer later evidence.** When chunk B contradicts chunk A, trust B. The template is live, not a first-impression record.
- **Silence is a red flag.** If no error handling, no cleanup path, or no responsibility owner is visible anywhere in the code or paper, flag it. The absence is evidence.
- **Walk every node.** The chain is not a menu — you do not pick the interesting nodes. A two-line answer for a straightforward node is complete; skipping it is not.

## Bottom Line

For any complex system, first interrogate — strip away names and narratives through the chain. Then record — write findings into the audit template. Do not accept the name or narrative first.
