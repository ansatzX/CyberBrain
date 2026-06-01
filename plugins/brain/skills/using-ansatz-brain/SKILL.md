---
name: using-ansatz-brain
description: "Use at the start of every primary-agent and subagent conversation — the top-level skill controller. Always activates whole-object-responsibility and state-machine foundations, then routes to domain brain skills and external skill arsenals including superpowers."
---

<AGENT-SCOPE>
This controller applies to primary agents and subagents. Subagents may keep the self-check brief, but they must not skip the always-active foundations.
</AGENT-SCOPE>

<EXTREMELY-IMPORTANT>
This skill is the top-level controller. It activates at the start of every conversation.

Ansatz Brain is the default-equipped skill arsenal. It does not replace external skill sets like superpowers — it routes to them. It controls which skills activate and in what order, but never modifies those skills.

At the start of every conversation, invoke this skill. It will route you to:
- `brain:whole-object-responsibility` (always — the universal epistemic foundation)
- `brain:state-machine` (always — the project-state and transition foundation)
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
    +-- brain:state-machine  <-- ALWAYS ACTIVE
    |       Project-state foundation.
    |       Track claim-bearing state transitions, completion evidence,
    |       and state-machine gates in working-directory-local state nodes.
    |
    +-- Brain domain skills (built-in):
    |       brain:think-before-you-calculate   -- calc, training, benchmarks
    |       brain:epistemic-systems-audit      -- papers, claims, evidence
    |       brain:codex-compatible             -- exec_command, sandbox, prefix_rule
    |
    +-- External skill arsenals (routed, never modified):
            superpowers:using-superpowers         -- superpowers self-routing
            ... and any other installed skill set
```

## Relationship with Superpowers

`superpowers:using-superpowers` also activates at the start of every conversation. This does not create a conflict — the two skills occupy different roles:

1. **Ansatz Brain triggers first.** It activates `brain:whole-object-responsibility` and `brain:state-machine` as always-active foundations, then decides whether domain brain skills are needed.
2. **When the task needs superpowers workflows** (brainstorming, debugging, TDD, etc.), ansatz-brain routes to `superpowers:using-superpowers`.
3. **Superpowers handles its own internal routing** — ansatz-brain never reaches into superpowers to pick individual skills. It hands off to `superpowers:using-superpowers` and superpowers distributes internally.

Both skills are active. Ansatz Brain owns the epistemic lens and the decision of *whether* to invoke superpowers; superpowers owns its own workflow distribution.

## The Rule

**Invoke this skill at the start of every conversation. It decides what other skills to activate.**

`brain:whole-object-responsibility` is always active as the universal object/responsibility foundation. It exists to prevent a single class of error: accepting a name, label, narrative, or surface appearance as understanding. Writing code, reading code, reading papers, debugging, designing — all of these involve forming judgments about how things work. The foundation lens applies to all of them.

`brain:state-machine` is always active as the project-state foundation. It exists to prevent a complementary error: taking actions that change state while leaving no durable record of the implicit claim, authority source, lost information, verification, or completion evidence.

Beyond the foundation, this controller routes to domain skills and external arsenals based on task type.

## Router Decision

```text
0. (ALWAYS) brain:whole-object-responsibility
   What is the real object? How does it actually work?
   What names, labels, or narratives am I accepting at face value?

0A. (ALWAYS) brain:state-machine
   What project state exists? What working-directory-local state node should record transitions?
   Will any action select, transform, substitute, summarize, store, delete,
   present, or declare completion over state?

1. Task involves running calculations, training, benchmarks, simulations, workflows?
   -> brain:think-before-you-calculate

2. Task involves evaluating a paper, AI4S result, scientific claim, or benchmark evidence?
   -> brain:epistemic-systems-audit

3. Task involves exec_command escalation, sandbox permissions, or prefix_rule usage?
   -> brain:codex-compatible

4. Task needs superpowers workflows (brainstorming, debugging, TDD, planning, etc.)?
   -> superpowers:using-superpowers
```

Brain skills and external skills can coexist. A task may activate `brain:whole-object-responsibility` + `brain:state-machine` + `brain:think-before-you-calculate` + `superpowers:using-superpowers` simultaneously. The brain skills provide the epistemic and state lens; the external skills provide the workflow.

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
| Project-state and transition foundation — always active | `brain:state-machine` |
| Run benchmark, train model, search, simulate, optimize, execute workflow | `brain:think-before-you-calculate` |
| Read paper, review AI4S, judge benchmark result, repair inflated claim | `brain:epistemic-systems-audit` |
| exec_command escalation, sandbox, prefix_rule | `brain:codex-compatible` |
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

## Lightweight Cases

Do not skip this router. For tasks that fall outside meaningful judgment, interpretation, or state change, keep the pass lightweight and do not create a state file:

- Pure configuration value changes ("change the port to 3000").
- Formatting or whitespace-only edits with no behavioral implication.
- Simple factual lookups with no interpretation ("what does `ls` do", "what time is it").
- Purely administrative or organizational conversation (file cleanup, session management).

If there is any doubt, run the foundations and record state transitions when project state changes. The cost of a false positive is a few seconds of self-check; the cost of a false negative is accepting a label as understanding.

## Experience Block

These are accumulated operational lessons. They are not yet standalone skills; recurring entries may later be distilled into dedicated skills.

### Python Execution Environments

Prefer `uv` or `conda` for Python/Python3 work instead of bare-metal `python` or `python3`, unless the user explicitly asks for the system interpreter or the repository already requires it.

When using `uv` inside a sandbox, do not rely on a global `UV_CACHE_DIR`; sandboxed runs may be unable to read or write it. Create a working-directory-local cache such as:

```text
./.cache/uv
```

Then run `uv` with:

```text
UV_CACHE_DIR=./.cache/uv uv ...
```

When using conda, do not activate environments in the shell. Use explicit conda subcommands:

```text
conda run -n <env> ...
conda create -n <env> ...
conda install -n <env> ...
```

Find the conda binary path before relying on it. Use a known local path when available, discover it from the environment, or ask the user for the conda binary path when it cannot be found safely.

For durable script discipline (timestamped `.scripts/` files, evidence provenance), see `brain:state-machine`. Scripts are evidence artifacts; state nodes track them.

### Codex Operational Patterns

For `exec_command` escalation, `prefix_rule`, sandbox writable roots, and `uv` cache configuration, route to `brain:codex-compatible`. All operational knowledge lives there.


## Bottom Line

Ansatz Brain is the controller. `brain:whole-object-responsibility` and `brain:state-machine` are always active foundations. External skill arsenals like superpowers are routed to, never modified. Do not accept the name or narrative first — find the object, proxy, evidence, failure path, responsibility owner, real productive function, and the project-state transitions that make those claims durable.
