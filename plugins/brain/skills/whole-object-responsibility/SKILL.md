---
name: whole-object-responsibility
description: "Trace the object, evidence, control, failure and ownership of a system; use a compact internal check ordinarily and a detailed chain for explicit system audits."
---

# Whole-Object Responsibility

Look past component names to what actually happens and who owns the result.
Preserve the system's useful contribution while checking the limits of its claims.

## Ordinary work

Keep a brief internal check: what is being handled, which state is authoritative,
what evidence supports the answer, how failure appears, and who owns recovery.
No task list or full audit template is required. Use `state-machine` for changes;
read-only work can remain L0 without a file.

## Explicit system audits

Walk this chain before making a system-level judgment:

1. Recover the whole object from its entrypoints and outputs.
2. Trace one local action through state changes to the downstream consequence.
3. Identify authoritative state, representations, control paths and actual constraints.
4. Identify bypasses, visible and silent failures, rollback and cleanup ownership.
5. Separate productive value from claims the evidence cannot establish.
6. Report findings with evidence, impact, boundary and actionable corrections.

Treat names, prompts, role descriptions, directories and successful exits as
proxies until the implementation or observations establish their meaning. A
prompt instruction is not an enforced capability boundary. A procedure being
followed is not proof the requested object was handled correctly.

## Audit frame

Address applicable fields in notes or the report; combine related fields and
omit duplication. Do not turn each field into a mandatory tool-created task.

```text
Whole Object / Boundary:
State / State Owner:
Representation:
Constraints / Operations / Control Chain:
Bypass Paths / Failure Paths:
Cleanup Owner / Responsibility Owner:
Tacit assumptions:
Productive Function:
Evidence-backed Verdict:
```

Distinguish unknowns that require more reading from missing domain assumptions
and genuine blockers. Continue useful independent work; ask only when missing
information prevents a reliable next step. Do not generalize beyond the evidence.

For large systems, inspect entrypoints and relevant dataflows in chunks. Update
findings when later evidence contradicts an earlier interpretation. Do not infer
whole-system correctness from a local test or dismiss useful engineering because
it does not establish a stronger scientific claim.

## References, loaded only when relevant

- Code audits: [reading-code.md](references/reading-code.md).
- Scientific paper review: [reading-papers.md](references/reading-papers.md),
  together with `epistemic-systems-audit` for scientific claim evaluation.
- Paper writing: [writing-papers.md](references/writing-papers.md) or
  [Chinese writing reference](references/writing-papers-zh.md).

Possible conclusions include aligned, useful but narrow, responsibility gap,
execution bypass, or unsupported completion. Explain the concrete evidence
instead of presenting a label as the finding. End when the user's audit or
requested correction is complete.
