---
name: pick-model
description: Pick the model and thinking level for a Pi subagent launch when the user did not choose them — single delegation, parallel fanout, or chain. Use before launching pi-subagents, especially alongside agent-cluster, to make bounded, explainable per-launch choices without silently changing persistent model preferences.
---

# Pick Model

Choose a model and thinking level for every Pi subagent launch deliberately. This
skill routes the **launch**; it does not change the parent session, generated
agent definitions, or persistent Pi settings.

For a multi-agent cluster, load `team-leader` first to establish delegation,
writer ownership, and review boundaries, and use `agent-cluster` for the launch
lifecycle. This skill then assigns models and thinking levels; it replaces
neither of them.

## Non-negotiable precedence

1. An explicit user model, provider, thinking level, budget, or policy wins.
2. An enforced `subagents.modelScope` wins; never select outside its allowlist.
3. An existing role override or configured default wins unless the current launch
   explicitly overrides it.
4. Without an approved alternate-model policy, inherit the current parent-session
   model. Do not infer model quality, price, or provider eligibility from names.

An omitted `model` is a deliberate request to inherit the parent-session model.
An omitted `thinking` is **not** a reliable request to inherit the parent's
thinking level: set it explicitly for a routed launch.

## Installed-model facts and capability boundary

Treat local Pi metadata as the authority for what is installed, configured, and
supported by this runtime. Refresh it with `pi --list-models` and inspect the
current session with `subagent({ action: "models" })`; model availability can
change without this skill changing.

The current configured provider/model families include these examples:

| Family | Enabled examples | Pi metadata observed locally | Safe routing interpretation |
|---|---|---|---|
| OpenAI Codex / GPT | `openai-codex/gpt-5.6-terra`, `gpt-5.6-sol`, `gpt-5.6-luna`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.5` | reasoning supported; current session is `gpt-5.6-terra` at `high`; all listed except `gpt-5.3-codex-spark` accept images | Default inherited coding/workflow choice unless an approved policy selects another model. |
| DeepSeek | `deepseek/deepseek-v4-flash`, `deepseek/deepseek-v4-pro`, `deepseek-responses/deepseek-v4-flash` | reasoning supported; the direct entries expose large text contexts and no image input | Candidate textual-recon or long-context lanes only after the user evaluates quality, latency, and cost locally. |
| Kimi Coding | `kimi-coding/k3`, `k3-256k`, `kimi-for-coding`, `kimi-for-coding-highspeed` | reasoning and image input supported; `k3` exposes the largest configured context/output limits in this family | Candidate codebase-reading or coding lanes only after the user evaluates them locally. |
| AIHubMix gateway | many `aihubmix/gpt-*`, `aihubmix/deepseek-*`, `aihubmix/kimi-*`, and other aliases | gateway metadata and availability are provider-specific | Treat each `aihubmix/<model>` as a distinct gateway endpoint, not as equivalent to the direct provider's similarly named model. |

This table records interface metadata and routing boundaries, **not** a benchmark,
cost comparison, or a claim of model quality. Do not infer quality from `pro`,
`flash`, `highspeed`, `chat`, or `coding` in a model name.

### Server-side Responses search and launch-tool network access

Pi's model list reports reasoning and image support; it does not expose a general
"internet" column. That omission does **not** mean a Responses-backed model is
offline: a provider can execute `web_search` server-side as part of its Responses
request, without giving the child `bash` or a local web-search tool.

Current Cyberbrain behavior is:

| Route | Search status | Evidence and routing rule |
|---|---|---|
| `openai-codex/*` | Server-side Responses search is available through the ChatGPT/Codex Responses route. | Treat this as a provider-side capability, not a local child tool. Use it for current-information work when the task calls for search and retain source/evidence boundaries. |
| `deepseek-responses/deepseek-v4-flash` | Server-side Responses search is enabled by default. | `pi/extensions/third-party-all-in-one.ts` loads `installDeepSeekWebSearch`, which injects `{ type: "web_search" }` into matching Responses payloads. It is disabled only by `CYBERBRAIN_DEEPSEEK_WEB_SEARCH=0`. Prefer this route when an approved DeepSeek model needs current information. |
| `deepseek/*` direct and `kimi-coding/*` | No Cyberbrain server-search injection is established here. | Do not assume provider-side search. Use a separately supplied launch tool or verify a provider-specific integration first. |
| `aihubmix/*` | Model- and gateway-specific. | A `search` name is not sufficient evidence. Verify that exact gateway endpoint and its returned source behavior before routing web-dependent work to it. |

For a child to retain Cyberbrain's DeepSeek Responses integration, leave ambient
extensions enabled. The generated `cyberbrain.*` agents intentionally omit an
`extensions` allowlist, so normal Pi package discovery loads
`third-party-all-in-one`. An explicit child `extensions` allowlist causes
pi-subagents to launch with `--no-extensions`; include the required provider
extension deliberately if such an allowlist is added.

Server-side search is still evidence collection, not a citation guarantee. The
child must disclose the provider route used, inspect returned sources when they
are available, and distinguish provider text from verified source content.

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
applicable evaluation exists, inherit the parent model and apply the thinking
lanes below. Ask the user to add an evaluation after a meaningful run rather
than silently promoting a model.

## Launch procedure

Before launching one or more subagents:

1. Inspect the task, requested agent role, mutation authority, and whether it is
   a single task, chain, or fanout.
2. If model availability or existing overrides are unknown, inspect them with
   `subagent({ action: "models" })`. Respect unavailable or scope-rejected models.
3. Select a task lane and the thinking level below.
4. Select a model:
   - Use the user-selected or already approved role/default model when present.
   - Otherwise omit `model`, thereby inheriting the current parent model.
   - Select a non-parent model only from a user-approved project/user routing
     policy. Name it as an exact `provider/model` value and provide only approved
     `fallbackModels`.
5. Pass the selected `thinking` explicitly in the `subagent` call, chain step, or
   parallel task. Record the rationale briefly in the task prompt or final report.
6. After launch, inspect the resolved model/thinking shown by the run status or
   fleet view. If the runtime clamps/rejects the requested level, report that
   rather than claiming the requested level was used.

## Thinking lanes

Use the narrowest level that matches the decision burden:

| Lane | Typical work | Thinking |
|---|---|---|
| Recon | file mapping, symbol lookup, bounded extraction, test discovery | `low` |
| Routine | focused implementation, ordinary test work, scoped documentation, ordinary review | `medium` |
| Deep decision | architecture tradeoff, security boundary review, difficult debugging, plan synthesis with explicit acceptance criteria | `high` |

Do not use `high` merely because a task is vague or large. First reduce scope,
use recon, or ask for clarification. Do not choose `off` for a reasoning model
unless the user requests it or the task is mechanical and independently
verifiable.

## Cluster policy

For a parallel cluster, do not assign every child high thinking.

- Recon/scout lanes: `low`.
- Independent focused reviewers and routine workers: `medium`.
- At most one bounded synthesizer, architecture reviewer, or final decision
  owner: `high`.
- Keep one writer per worktree. Model routing never relaxes write isolation.
- When no approved model pool exists, all children inherit the parent model and
  differ only by thinking lane and task seam.

For chains, start with low/medium context gathering, reserve high thinking for a
well-scoped plan or decision step, then return to medium for implementation and
validation.

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
