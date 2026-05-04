---
name: think-before-you-calculate
description: "Use when a task asks to run calculations, simulations, model training, searches, benchmarks, optimizations, workflows, agents, pipelines, or other tool-heavy execution before the scientific question and interpretation boundary are clear."
---

# Think Before You Calculate

## Overview

Use this skill as the pre-execution brake. It keeps calculations, tools, benchmarks, and workflows from silently defining the question.

**Core principle:** run tools strongly, but never let tool output become a conclusion without object, proxy, evidence, failure, and responsibility boundaries.

## Iron Law

```text
NO EXECUTION-BASED CONCLUSION WITHOUT A PRE-CALC AUDIT
```

You may run an exploratory calculation with missing fields, but you must label it exploratory and must not turn the result into scientific understanding.

## Terms

Weak models must use these meanings, not guess.

| Term | Meaning |
| --- | --- |
| `calc` | Any calculation, simulation, derivation, ML training, benchmark, search, workflow, pipeline, or agent tool execution. |
| `object` | The real thing, phenomenon, mechanism, system, or code state the work is about. It is not automatically a dataset, metric, or output. |
| `boundary` | The scope where the result is meant to hold: data split, approximation, environment, assumptions, system limits, or use case. |
| `representation` | How the object enters the system: coordinates, graph, Hamiltonian, tensor, prompt, AST, trace, embedding, schema, etc. |
| `proxy` | A measurable or optimizable substitute for the real object or goal: metric, loss, label, benchmark, generated candidate, workflow success. |
| `evidence` | What the calculation or tool output actually supports. |
| `failure path` | How the result could fail or be falsified: distribution shift, broken approximation, missing variable, invalid workflow, bad tool call. |
| `responsibility` | Who owns setup, interpretation, failure analysis, and final claim. |
| `productive function` | The real narrow value of the tool: speed, scale, reproducibility, comparison, automation, cost reduction, candidate generation. |
| `narrow claim` | The strongest claim the evidence supports without inflation. |

## Minimal Audit

Before execution or conclusion, fill this. Use `Unknown` rather than inventing.

```text
Object:
Boundary:
Representation:
Proxy / Optimization Target:
Evidence Expected:
Failure Path:
Responsibility:
Productive Function:
Narrow Claim This Could Support:
```

## Hard Gates

If any gate fails, label the run exploratory or narrow the claim.

```text
No object -> no object-level claim.
No boundary -> no generalization claim.
No proxy explanation -> no claim beyond proxy success.
No failure path -> no strong success claim.
No responsibility owner -> no autonomy/safety/reliability claim.
No productive function check -> critique may become over-dismissal.
```

## Pre-Calc Procedure

1. Identify the object.
2. Identify the representation.
3. Identify the proxy or optimization target.
4. State what the calculation can prove.
5. State what it cannot prove.
6. State the failure path.
7. State who owns interpretation.
8. Then run the tool, calculation, benchmark, or workflow.

If the user only wants execution, keep the audit to 3-8 lines, then proceed.

## Claim Compiler

After execution, write conclusions in this form:

```text
The result supports [narrow claim] under [boundary].
It does not establish [inflated claim].
Missing evidence: [gap].
Failure path: [failure condition or Unknown].
Responsibility owner: [owner or Unknown].
Productive function: [real value].
```

## Red Flags

Stop and audit when:

- The task says only "improve MAE," "run benchmark," "train model," "search," "generate candidates," or "automate workflow."
- A metric, loss, benchmark score, generated output, or workflow completion is about to become the conclusion.
- The calculation target is clear but the scientific object is not.
- The tool can run, but no one owns interpretation.
- The result is useful, but the story around it claims understanding, discovery, autonomy, or safety.

## When This Is Not Enough

Use a more specific skill when the task is not just pre-execution:

- Use `epistemic-systems-audit` for papers, AI4S, benchmark claims, scientific understanding claims, and claim repair.
- Use `whole-object-responsibility` for agent OS, workflow systems, infrastructure, HPC, distributed systems, protocol failure, and division-of-labor responsibility.

## Bottom Line

First make the calculation answerable. Then calculate.
