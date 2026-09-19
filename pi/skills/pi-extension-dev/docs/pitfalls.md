# Pi Extension Pitfalls

1. JavaScript forbids unparenthesized mixing of `??` with `||` or `&&`: use `(a ?? b) || c`. Pi supports `??` and `?.`.
2. Every `.ts`/`.js` under an extension discovery directory is treated as an extension entry. Keep helpers/tests elsewhere: CyberBrain uses `pi/lib/` and `pi/test/`. For a standalone global extension, use the selected agent home, not a hardcoded `~/.pi/agent` path.
3. Do not load the same extension via automatic discovery and `-e`; duplicate commands become `name:1`, `name:2`.
4. Empty object tool schemas must still declare `{ type: "object", properties: {} }`.
5. `ctx.ui` dialogs require `ctx.hasUI`; print mode notifications may be invisible.
6. `pi.sendUserMessage()` is fire-and-forget. Replacement-session callbacks must use the fresh callback context.
7. `context` hook changes are request-local, not persistent session entries.
8. Slash prompt text injected by `before_agent_start` must not also be copied into the activating user message.
9. Use `[ \t]*`, not `\s*`, when parsing line-scoped frontmatter values; `\s` includes newlines.
10. Use atomic temp-file + rename writes for extension state.
11. Key per-session state by the stable session file/id. Give ephemeral runs process-local unique keys to avoid collisions.
12. Test extension commands with `pi -p -ne -e path/to/extension.ts ...` when the file also lives in an auto-discovered directory.
