---
name: epistemic-systems-audit
description: "Use when reading papers, evaluating AI4S systems, reviewing scientific claims, judging benchmark or dataset results, checking claims about understanding/discovery/reasoning/autonomy, or repairing inflated scientific claims."
---

# Epistemic Systems Audit

## Overview

Use this skill to decide whether a paper, AI4S system, benchmark result, workflow, or agent claim actually supports scientific understanding or only proxy success.

**Core principle:** evidence must match the claim; proxy success is not object-level understanding.

## Iron Law

```text
NO SCIENTIFIC CLAIM WITHOUT QUESTION-OBJECT-PROXY-EVIDENCE ALIGNMENT
```

If the object, proxy, evidence, failure condition, or responsibility owner is missing, the claim must be narrowed or marked `not even wrong`.

## Terms

Weak models must use these meanings, not guess.

| Term | Meaning |
| --- | --- |
| `scientific question` | The real question: object + phenomenon + mechanism + evidence standard. Not a dataset, method, task, or benchmark name. |
| `object` | The real molecule, material, wavefunction, mechanism, system, behavior, or code state under study. |
| `phenomenon` | The behavior, property, pattern, or effect to explain or predict. |
| `mechanism` | The proposed reason the phenomenon happens. |
| `evidence standard` | What would count as answering the question. |
| `representation` | How the object enters the model or computation: graph, coordinates, Hamiltonian, basis, embedding, trace, AST, etc. |
| `proxy` | A substitute used because the object or ability is hard to measure directly: dataset, label, metric, loss, benchmark, generated candidate, workflow success. |
| `dataset` | A finite slice of the object space, not the object itself. |
| `metric` | A local number such as MAE, RMSE, accuracy, AUROC, pass@k, success rate. |
| `loss` | Training objective, not automatically the scientific objective. |
| `benchmark` | Standard task/data/metric for comparison, not general capability or understanding. |
| `AI4S` | AI for Science: AI methods for prediction, simulation acceleration, screening, design, literature mining, agents, or automated experiments. |
| `claim` | What the paper or system says it proved, solved, discovered, automated, or understood. |
| `evidence` | Experiments, calculations, benchmarks, ablations, controls, OOD tests, real validation, code, derivations, or failure cases. |
| `claim creep` | Evidence supports a weak claim, but the text asserts a stronger claim. |
| `failure condition` | Where the method, proxy, or claim stops holding. A claim must be precise enough to fail. |
| `responsibility` | Who owns interpretation, failure analysis, and final claim. |
| `not even wrong` | Too vague to be false because object, proxy, evidence, boundary, failure, or responsibility is unclear. |

## Audit Template

Fill fields with `Unknown`, `Unstated`, or `Not evidenced` when missing.

```text
Scientific Question:
Object:
Phenomenon:
Mechanism:
Evidence Standard:
Representation:
Proxy:
Proxy Justification:
Proxy Limitation:
Claim:
Evidence:
Contribution Type:
Failure Conditions:
Responsibility Chain:
Proxy Collapse Risk:
Claim-Evidence Alignment:
Verdict:
```

## Procedure

### 1. Recover The Scientific Question

Ask whether the paper is answering a scientific question or only performing a task.

Bad question:

```text
Can we improve MAE on this dataset?
```

Better question:

```text
How does molecular structure affect this property under these approximations, and what evidence would show reliable prediction or mechanism?
```

### 2. Separate Object, Representation, And Proxy

State:

- Object: what the claim is really about.
- Representation: how the object enters the system.
- Proxy: what is measured, optimized, generated, scored, or completed.

If the evidence is only about a dataset, metric, loss, benchmark, generated output, or workflow success, keep the claim at that level.

### 3. Classify The Contribution

Use one of these:

| Type | Legitimate Claim |
| --- | --- |
| `Engineering` | Faster, cheaper, smoother, more automated, more reproducible. |
| `Prediction` | Better accuracy, ranking, screening, or benchmark performance under stated conditions. |
| `Scientific Understanding` | Mechanism, new relation, changed object understanding, failure boundary, or testable hypothesis. |

Do not let engineering or prediction masquerade as scientific understanding.

### 4. Align Claim And Evidence

Use this compiler:

```text
The evidence supports [narrow claim] under [conditions].
It does not establish [inflated claim].
Missing evidence: [gap].
Failure condition: [condition or Unknown].
Responsibility owner: [owner or Unknown].
```

Examples:

- Lower MAE supports prediction on that dataset/split, not mechanism understanding.
- Benchmark score supports benchmark performance, not general reasoning.
- Workflow completion supports execution, not discovery.
- Generated candidates support proposal, not validated discovery.

### 5. Require Failure Conditions

Ask:

- What result would weaken or falsify the claim?
- Where does the proxy stop representing the object?
- What distribution shift matters?
- Which approximation can break?
- What cases were not tested?
- What validation would show the interpretation is wrong?

No failure condition means no strong scientific claim.

### 6. Preserve Productive Value

Do not collapse "not understanding" into "no value." Identify the real value:

```text
Productive Function:
Inflated Narrative:
Narrow Valid Claim:
Evidence Needed For Stronger Claim:
```

## Claim Repair

Use this when the text is vague, promotional, or inflated.

```text
Original Claim:
Problem:
Evidence Actually Supports:
Rewritten Claim:
Missing Evidence For Stronger Claim:
Failure Conditions:
Responsibility Owner:
Verdict:
```

## Verdicts

- `Aligned`: evidence supports the stated claim.
- `Useful but narrow`: real engineering or prediction value, but not scientific understanding.
- `Proxy collapse`: proxy success is treated as object-level truth.
- `Claim creep`: evidence supports a weaker claim than asserted.
- `Workflow theater`: process complexity substitutes for scientific judgment.
- `Responsibility gap`: no clear owner for interpretation or failure.
- `Not even wrong`: too vague to be falsified.
- `Over-dismissal risk`: critique ignores real productive value.

## Bottom Line

Prefer a limited true claim over a fluent inflated claim.
