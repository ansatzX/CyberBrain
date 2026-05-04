---
name: using-ansatz-brain
description: "Use when starting any conversation - checks whether scientific/technical claims, calculations, benchmarks, papers, agents, workflows, automation, infrastructure, complex systems, or responsibility-chain skills apply before answering."
---

# Using Ansatz Brain

<EXTREMELY-IMPORTANT>
At the start of every conversation, check whether any Ansatz Brain skill applies before answering.

If there is even a small chance the task involves a scientific claim, technical claim, benchmark, metric, dataset, calculation, workflow, agent, automation, complex system, or responsibility chain, route to the appropriate specialized skill before answering.

Do not rationalize that the request is "just a simple question." If the user is asking what a result means, what a system does, whether a claim is true, or whether to run a tool, this router applies.

If none of these apply, say nothing about this router and answer normally.
</EXTREMELY-IMPORTANT>

## Overview

This is the router for the Ansatz-style object/proxy/responsibility skills. It exists to prevent the agent from accepting nouns, metrics, workflows, or generated outputs as understanding.

**Core principle:** first identify the object, boundary, proxy, evidence, failure path, responsibility owner, and productive function; then choose the specialized skill.

## Trigger Words

Use this router when the request includes or implies any of these:

- Paper, article, abstract, review, claim, evidence, result, conclusion.
- AI4S, AI for Science, scientific discovery, understanding, reasoning, autonomy.
- Benchmark, leaderboard, dataset, metric, accuracy, MAE, RMSE, AUROC, pass@k, loss, score.
- Simulation, calculation, DFT, MD, DMRG, tensor network, model training, optimization, screening, generation.
- Agent, tool use, workflow, pipeline, automation, orchestration, end-to-end, report generation.
- HPC, scheduler, Slurm, cgroup, storage, database, infrastructure, platform, distributed system.
- Protocol, responsibility, ownership, failure mode, bypass, hidden state, reproducibility, validation.

## Router Decision

Choose the narrowest applicable skill. If multiple apply, use them in this order.

```text
1. About to run a calculation/tool/workflow/search/benchmark?
   -> use think-before-you-calculate

2. Interpreting a paper, AI4S result, benchmark, dataset, metric, model output, or scientific claim?
   -> use epistemic-systems-audit

3. Evaluating an agent OS, workflow system, infrastructure, protocol, division of labor, hidden state, bypass path, or responsibility gap?
   -> use whole-object-responsibility
```

If unsure, do the minimal fallback below before answering.

## Minimal Fallback

Fill this in 3-8 lines. Use `Unknown` rather than inventing.

```text
Object:
Boundary:
Proxy:
Evidence:
Failure Path:
Responsibility:
Productive Function:
Narrow Claim:
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

## Stop These Shortcuts

Do not answer directly if you are about to say:

- The model understands X because the score improved.
- The benchmark proves reasoning.
- The workflow automates discovery.
- The agent autonomously discovered something.
- The system is safe/reliable/autonomous without a failure path and responsibility owner.
- The system is worthless because it is "only" a metric, workflow, or immature tool.

Route first.

## Skill Map

| Situation | Use |
| --- | --- |
| Run benchmark, train model, search, simulate, optimize, execute workflow | `think-before-you-calculate` |
| Read paper, review AI4S, judge benchmark result, repair inflated scientific claim | `epistemic-systems-audit` |
| Audit agent OS, workflow engine, infrastructure, HPC, protocol, hidden state, responsibility gap | `whole-object-responsibility` |

## Bottom Line

Do not accept the name or narrative first. Find the object, proxy, evidence, failure path, responsibility owner, and real productive function.
