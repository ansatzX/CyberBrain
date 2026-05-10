---
name: using-ansatz-brain
description: "Use at the start of every conversation — the top-level skill controller. Routes to the universal whole-object-responsibility lens, domain brain skills, and external skill arsenals including superpowers."
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
This skill is the top-level controller. It activates at the start of every conversation.

Ansatz Brain is the default-equipped skill arsenal. It does not replace external skill sets like superpowers — it routes to them. It controls which skills activate and in what order, but never modifies those skills.

At the start of every conversation, invoke this skill. It will route you to:
- `brain:whole-object-responsibility` (always — the universal epistemic foundation)
- Domain brain skills as needed
- External skill arsenals (superpowers, etc.) as needed

This does not conflict with `superpowers:using-superpowers`. Both can and should coexist. Ansatz Brain triggers first and decides the routing; superpowers executes within that framework.
</EXTREMELY-IMPORTANT>

## Instruction Priority

1. **User's explicit instructions** — highest priority. Always.
2. **Ansatz Brain** — top-level skill controller. Decides which skills to route to.
3. **Routed skills** (brain sub-skills, superpowers, etc.) — activated by this controller.
4. **Default system prompt** — lowest priority.

If a user instruction conflicts with a routed skill, the user wins. Ansatz Brain provides the lens and routing; it does not override the user's intent.

## Architecture

Ansatz Brain is the controller. It owns a set of built-in domain skills and routes to external skill arsenals. It never modifies external skills — it only decides when to invoke them.

```
ansatz-brain (top-level controller)
    |
    +-- brain:whole-object-responsibility  <-- ALWAYS ACTIVE
    |       Universal epistemic foundation.
    |       Do not accept names, rhetoric, labels, or surface concepts
    |       as understanding. Look past them to how things actually operate.
    |
    +-- Brain domain skills (built-in):
    |       brain:think-before-you-calculate   -- calc, training, benchmarks
    |       brain:epistemic-systems-audit      -- papers, claims, evidence
    |
    +-- External skill arsenals (routed, never modified):
            superpowers:using-superpowers         -- superpowers self-routing
            ... and any other installed skill set
```

## Relationship with Superpowers

`superpowers:using-superpowers` also activates at the start of every conversation. This does not create a conflict — the two skills occupy different roles:

1. **Ansatz Brain triggers first.** It activates `brain:whole-object-responsibility` as the universal epistemic foundation and decides whether domain brain skills are needed.
2. **When the task needs superpowers workflows** (brainstorming, debugging, TDD, etc.), ansatz-brain routes to `superpowers:using-superpowers`.
3. **Superpowers handles its own internal routing** — ansatz-brain never reaches into superpowers to pick individual skills. It hands off to `superpowers:using-superpowers` and superpowers distributes internally.

Both skills are active. Ansatz Brain owns the epistemic lens and the decision of *whether* to invoke superpowers; superpowers owns its own workflow distribution.

## The Rule

**Invoke this skill at the start of every conversation. It decides what other skills to activate.**

`brain:whole-object-responsibility` is always active as the universal foundation. It exists to prevent a single class of error: accepting a name, label, narrative, or surface appearance as understanding. Writing code, reading code, reading papers, debugging, designing — all of these involve forming judgments about how things work. The foundation lens applies to all of them.

Beyond the foundation, this controller routes to domain skills and external arsenals based on task type.

## Router Decision

```text
0. (ALWAYS) brain:whole-object-responsibility
   What is the real object? How does it actually work?
   What names, labels, or narratives am I accepting at face value?

1. Task involves running calculations, training, benchmarks, simulations, workflows?
   -> brain:think-before-you-calculate

2. Task involves evaluating a paper, AI4S result, scientific claim, or benchmark evidence?
   -> brain:epistemic-systems-audit

3. Task needs superpowers workflows (brainstorming, debugging, TDD, planning, etc.)?
   -> superpowers:using-superpowers
```

Brain skills and external skills can coexist. A task may activate `brain:whole-object-responsibility` + `brain:think-before-you-calculate` + `superpowers:using-superpowers` simultaneously. The brain skills provide the epistemic lens; the external skills provide the workflow.

## Red Flags

These thoughts mean STOP — you are accepting a label as understanding:

| Thought | Reality |
|---|---|
| "This code clearly does X" | You read the name, not the behavior. Trace the actual execution. |
| "The paper claims to have discovered Y" | A claim is not evidence. Audit proxy, evidence, failure conditions. |
| "The benchmark score improved, so the model is better" | A proxy improved. That is not object-level understanding. |
| "The workflow automates the process" | Automation is not discovery. What does each step actually do? |
| "The system is obviously doing Z" | Systems have hidden state, bypass paths, and responsibility gaps. |
| "This is just a simple script" | Simple things hide unexamined assumptions. Apply the lens anyway. |
| "I've seen this pattern before" | This instance is not the pattern. Read this code, not your memory of similar code. |
| "The result speaks for itself" | Results never speak. Evidence requires an object, proxy, and failure path. |
| "This doesn't need the lens — it's not science" | The lens applies to any claim, interpretation, or system judgment. |

## Skill Map

| Situation | Route to |
|---|---|
| Universal foundation — always active | `brain:whole-object-responsibility` |
| Run benchmark, train model, search, simulate, optimize, execute workflow | `brain:think-before-you-calculate` |
| Read paper, review AI4S, judge benchmark result, repair inflated claim | `brain:epistemic-systems-audit` |
| Need superpowers workflows (brainstorming, debugging, TDD, planning) | `superpowers:using-superpowers` |

## Minimal Fallback

Fill this in 3-8 lines as a quick self-check on any task. Use `Unknown` rather than inventing.

```text
Object:           [the real thing or system the claim/action is about, not a proxy or label]
Boundary:         [where the result holds; assumptions, limits, scope]
Proxy:            [measurable substitute for the real goal or object]
Evidence:         [what the data, code, or output actually supports]
Failure Path:     [how the result, claim, or system could fail or be falsified]
Responsibility:   [who owns interpretation, cleanup, and final claim]
Productive Function: [real narrow value of the tool, system, or method]
Narrow Claim:     [strongest claim the evidence supports, without inflation]
```

## Hard Rules

```text
No object -> no object-level claim.
No boundary -> no generalization claim.
No proxy explanation -> no claim beyond proxy success.
No evidence alignment -> no strong claim.
No failure path -> no strong success claim.
No responsibility owner -> no autonomy/safety/reliability claim.
No productive function check -> critique may become over-dismissal.
```

## When NOT to Use

Skip this router only when the task falls entirely outside any act of judgment, interpretation, or system understanding:

- Pure configuration value changes ("change the port to 3000").
- Formatting or whitespace-only edits with no behavioral implication.
- Simple factual lookups with no interpretation ("what does `ls` do", "what time is it").
- Purely administrative or organizational conversation (file cleanup, session management).

If there is any doubt, invoke the skill. The cost of a false positive is a few seconds of self-check; the cost of a false negative is accepting a label as understanding.

## Bottom Line

Ansatz Brain is the controller. `brain:whole-object-responsibility` is always active as the universal epistemic foundation. External skill arsenals like superpowers are routed to, never modified. Do not accept the name or narrative first — find the object, proxy, evidence, failure path, responsibility owner, and real productive function.
