---
name: pick-model
description: Resolve model and thinking settings for an authorized Pi subagent launch while preserving user choices and configured role defaults. Does not change persistent preferences or initiate delegation.
---

# Pick Model

Use this skill for model or effort decisions on an already justified Pi launch.
For task decomposition and ownership use `team-leader`; for actual multi-child
execution use `agent-cluster`. Do not load the other guides for a simple settings
lookup or create a cluster just to use this skill.

## Resolve the model

1. Honor explicit user choices and the enforced `subagents.modelScope`. If they
   conflict or the requested model is unavailable, report the conflict; do not
   silently substitute or weaken the allowlist.
2. Preserve existing role overrides and configured defaults unless the current
   launch is authorized to override them.
3. With no applicable override, omit `model` and let runtime resolution fall back
   to the parent session. Omission alone does not prove parent-model inheritance.
4. Select an alternate model only under an applicable user-approved routing policy.
   Do not infer quality, price or eligibility from provider/model names.

Inspect `subagent({ action: "models" })`, current role configuration and installed
Pi metadata when resolution or capabilities are unknown. Reuse verified facts
within the session while the relevant configuration is unchanged. After launch,
check the actual resolved model and effort before reporting what was used.

## Select supported effort

Use the lowest supported effort suitable for the decision burden, subject to
explicit user policy:

| Work | Suggested effort |
| --- | --- |
| File mapping, symbol lookup, bounded extraction | `low` |
| Focused implementation, tests and ordinary review | `medium` |
| Architecture decisions, security boundaries and difficult debugging | `high` |

Size or ambiguity alone does not justify high effort; narrow the task first.
There is no provider-wide minimum or fixed quota of high-effort children.

Verify the installed launch API. The checked pi-subagents child launch does not
accept a standalone `thinking` field; the root field with that name configures a
watchdog. To select effort, use the supported `model: "provider/id:level"` suffix
on the same resolved model after verifying its supported levels. This does not
authorize a different provider/model. Otherwise preserve configured resolution.
Report runtime clamps or rejection. Do not invent `fallbackModels` launch fields.

## Conditional references

- A task needs network/search capabilities, extension selection or provider effort
  mapping: read [provider capabilities](references/provider-capabilities.md).
- The user requests persistent multi-model routing or supplies model evaluations:
  read [model policy](references/model-policy.md).

Do not change persistent settings, generated agent definitions or fallback policy
without authorization. Model routing never expands the child’s write scope.
