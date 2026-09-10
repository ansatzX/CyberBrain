# Provider capabilities

Read only when a launch needs search, extension selection or provider-specific
effort mapping. Verify the current implementation; these routes are not a
model-quality ranking.

### Server-side Responses search and launch-tool network access

Pi's model list reports reasoning and image support; it does not expose a general
"internet" column. That omission does **not** mean a Responses-backed model is
offline: a provider can execute `web_search` server-side as part of its Responses
request, without giving the child `bash` or a local web-search tool.

Current Cyberbrain behavior is:

| Route | Search status | Evidence and routing rule |
|---|---|---|
| `openai-codex/*` | Server-side Responses search is available through the ChatGPT/Codex Responses route. | Treat this as a provider-side capability, not a local child tool. Use it for current-information work when the task calls for search and retain source/evidence boundaries. |
| `deepseek-responses/*` | Server-side Responses search is enabled by default. | `pi/extensions/deepseek-responses.ts` loads `installDeepSeekWebSearch`, which injects `{ type: "web_search" }` into matching Responses payloads. It is disabled only by `CYBERBRAIN_DEEPSEEK_WEB_SEARCH=0`. Prefer this route when an approved DeepSeek model needs current information. |
| `deepseek/*` direct and `kimi-coding/*` | No Cyberbrain server-search injection is established here. | Do not assume provider-side search. Use a separately supplied launch tool or verify a provider-specific integration first. |
| `aihubmix/*` | Model- and gateway-specific. | A `search` name is not sufficient evidence. Verify that exact gateway endpoint and its returned source behavior before routing web-dependent work to it. |

For a child to retain Cyberbrain's DeepSeek Responses integration, retain the
required provider extension. Verify extension side effects against the task’s
permission boundary before using ambient discovery. The generated `cyberbrain.*` agents intentionally omit an
`extensions` allowlist, so normal Pi package discovery loads
`deepseek-responses` (and `aihubmix` when its API key is present). An explicit child `extensions` allowlist causes
pi-subagents to launch with `--no-extensions`; include the required provider
extension deliberately if such an allowlist is added.

Server-side search is still evidence collection, not a citation guarantee. The
child must disclose the provider route used, inspect returned sources when they
are available, and distinguish provider text from verified source content.


## Effort mapping

For provider-specific effort behavior, inspect the selected route’s current
metadata and implementation. Do not impose a minimum effort from a provider name.
Report clamps instead of claiming the requested effort was used.
