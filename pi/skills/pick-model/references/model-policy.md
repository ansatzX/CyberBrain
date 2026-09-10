# Optional model evaluations and persistent policy

Read when the user requests a reusable routing policy or supplies model
evaluations. Ordinary launches do not require a registry or a new evaluation.

## User evaluation registry

The user is the authority on local quality, cost, latency, reliability, and
preferred task fit. Keep evaluations separate from provider marketing and model
names. Do not invent entries; an empty field means `Unknown`, not a negative
rating.

```text
Model (provider/id):
Status: approved | trial | avoid | unknown
User says it is good for:
User says to avoid it for:
Preferred thinking range:
Observed limits / failure modes:
Evidence or last verified date:
```

Use an `approved` user evaluation as the first choice for matching task lanes;
use `trial` only for bounded, reviewable work; never route to `avoid`. If no
applicable evaluation exists, preserve role/default resolution and apply the thinking
lanes below. Ask the user to add an evaluation after a meaningful run rather
than silently promoting a model.

## Persistent multi-model policy

A reusable multi-model fleet requires user approval because it changes provider
use, cost, and failure behavior. Put that policy in user or project Pi settings,
not in generated `cyberbrain.*` agents. Example shape:

```json
{
  "subagents": {
    "modelScope": {
      "enforce": true,
      "allow": ["<approved-provider>/*"]
    },
    "agentOverrides": {
      "scout": { "model": "<approved-provider>/<fast-model>", "thinking": "low" },
      "planner": { "model": "<approved-provider>/<deep-model>", "thinking": "high" }
    }
  }
}
```

Do not write this configuration, pin a model in a generated adapter, or enable a
fallback without explicit user approval. Once approved, use the configured roles
and still apply the cluster policy above.
