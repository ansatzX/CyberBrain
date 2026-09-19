# Provider capabilities

Read only when a launch needs search, extension selection or provider-specific
effort mapping. Verify the current implementation; these routes are not a
model-quality ranking.

### Server-side search and launch-tool network access

Pi's model list reports reasoning and image support; it does not expose a general
"internet" column. That omission does **not** mean a model is offline: a provider
can execute a search tool server-side through Responses or Anthropic Messages,
without giving the child `bash` or a local web-search tool. Check the exact
provider, model, protocol and enabled extension rather than the model name alone.

Current Cyberbrain behavior is:

| Route | Search status | Evidence and routing rule |
|---|---|---|
| `openai-codex/*` | Server-side Responses search is available through the ChatGPT/Codex Responses route. | Treat this as a provider-side capability, not a local child tool. Use it for current-information work when the task calls for search and retain source/evidence boundaries. |
| `deepseek-full/deepseek-flash` | Protocol-dependent: Anthropic search verified; Responses search did not execute. | `CYBERBRAIN_DEEPSEEK_PROTOCOL` defaults to `anthropic`. The hook injects `web_search_20250305` with `max_uses: 3` for Anthropic messages. Flash returned real server search results in live testing on 2026-09-19, including through Pi's streaming adapter. With `responses`, Flash receives no injection; do not claim search support from the provider name alone. |
| `deepseek-full/deepseek-v4-pro` | Search injection enabled in either protocol. | Anthropic mode uses `web_search_20250305`; Responses mode uses `web_search` (server calls verified in live testing on 2026-09-19). `CYBERBRAIN_DEEPSEEK_WEB_SEARCH=0` disables automatic injection for both. Request construction alone does not prove each request searched. |
| `deepseek/*` direct and `kimi-coding/*` | No Cyberbrain server-search injection is established here. | Do not assume provider-side search. Use a separately supplied launch tool or verify a provider-specific integration first. |
| `aihubmix/*` | Model- and gateway-specific. | A `search` name is not sufficient evidence. Verify that exact gateway endpoint and its returned source behavior before routing web-dependent work to it. |

For a child to retain Cyberbrain's DeepSeek Full integration, retain the
required provider extension. Verify extension side effects against the task’s
permission boundary before using ambient discovery. The generated `cyberbrain.*` agents intentionally omit an
`extensions` allowlist, so normal Pi package discovery loads
`deepseek-full.ts` (and `aihubmix` when its API key is present). An explicit child `extensions` allowlist causes
pi-subagents to launch with `--no-extensions`; include the required provider
extension deliberately if such an allowlist is added.

Server-side search is still evidence collection, not a citation guarantee. The
child must disclose the provider route used, inspect returned sources when they
are available, and distinguish provider text from verified source content.
Pi's current Anthropic adapter does not retain raw server-search blocks in its
normalized message history, so final text URLs do not establish preserved
structured citations. The custom provider is `deepseek-full`, not built-in
`deepseek`. Protocol changes require restarting the Pi process and refreshing
external catalogs; never silently switch protocol to satisfy a search request.

If user observations conflict with documentation or the local hook, retain the
exact endpoint/model and request/response evidence (redact credentials). Do not
resolve the conflict by merely adding a tool declaration or by dismissing the
observed result. A successful HTTP response or a plausible answer alone does not
establish server-side search. Do not silently switch the user's model/provider;
report the gap if no authorized search path is available.


## Effort mapping

For provider-specific effort behavior, inspect the selected route’s current
metadata and implementation. Do not impose a minimum effort from a provider name.
Report clamps instead of claiming the requested effort was used.
