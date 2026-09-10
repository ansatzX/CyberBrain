---
name: using-ansatz-brain
description: "Route Brain's object/evidence and state checks at conversation start, with a lightweight internal pass for ordinary work and detailed skills only when needed."
---

# Using Ansatz Brain

Brain helps keep conclusions tied to evidence and changes tied to the user's
objective. It follows the active host's system/developer instructions, permissions,
and user authorization. It cannot redefine their priority or grant new authority.

## Start with a lightweight check

Identify the object, requested result, available evidence, and failure boundary.
Use `whole-object-responsibility` for this lens and `state-machine` to select the
recording level. For a simple answer or read-only review, keep this internal:
no tasks, state files, or repeated templates are required just to answer.

For ordinary changes, one concise state node can record scope and verification.
Escalate to a detailed audit or state DAG only when the work has meaningful
ordering, recovery, scientific-claim, or coordination requirements.

## Route only relevant work

| Task | Skill |
| --- | --- |
| Complex system, responsibility or failure-chain audit | `whole-object-responsibility` |
| Changes, recovery, or multi-step verification | `state-machine` |
| Web sources, current facts, citations, identity disambiguation | `agentic-search` |
| Calculations, simulations, benchmarks and interpretation | `think-before-you-calculate` |
| Scientific papers, AI4S and claim/evidence evaluation | `epistemic-systems-audit` |
| Codex sandbox, approvals or external CLI delegation | `codex-compatible`, only on a Codex host |
| Project-local development workflow installation | `tame-dev-workflows`, only when requested |

Shared skills may be loaded by Pi and Codex. Use the current host's tools;
do not translate one host's runtime API into the other. If a routed skill is
unavailable, perform the bounded work directly where possible and state the gap.

If an installed external workflow skill such as Superpowers is relevant, follow
its own entrypoint. Do not assume it is installed or load its entire arsenal.
Brain supplies evidence boundaries, not a second implementation workflow.

## Execution discipline

- Preserve the user's target, model choices, scope and existing authorization.
- Do not infer permission to launch agents or install tooling from a skill name.
- Prefer configured Python environments (`uv` or `conda`) when appropriate;
  use the repository's required interpreter when specified.
- Keep tool caches inside allowed paths; a local `UV_CACHE_DIR` can avoid global
  cache writes. Do not rewrite global permissions to make a command succeed.
- Preserve non-trivial validation scripts when they support later claims.
- Once the requested outcome is verified, report it and stop. Further work
  requires a new objective from the user, not a self-assigned extension.
