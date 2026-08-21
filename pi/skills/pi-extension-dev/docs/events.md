# Pi Extension Events

Lifecycle order:

```text
session_start
user input
  -> input
  -> before_agent_start
  -> agent_start
  -> repeated turns:
       turn_start -> context -> provider hooks -> tool hooks -> turn_end
  -> agent_end
  -> agent_settled
session_shutdown
```

Key events:

- `resources_discover`: contribute skills/prompts/themes/extensions.
- `session_start`: restore extension state.
- `input`: intercept or transform typed/RPC input.
- `before_agent_start`: inject a per-run message or replace the system prompt.
- `context`: non-destructively filter/rewrite the message array for each provider request.
- `turn_start`: receives `turnIndex` and `timestamp`; use this to identify distinct turns.
- `turn_end`: receives assistant message and tool results.
- `tool_call`: block calls or mutate arguments in place.
- `tool_result`: rewrite tool results.
- `agent_end`: low-level agent run ended; retries or queued work may remain.
- `agent_settled`: no retry, compaction, or queued continuation remains.
- `session_compact`: react after compaction.

Guidance:

- Static behavior rules belong in the system prompt.
- Dynamic event state belongs in custom messages or extension-owned state.
- 通常不要从 hook 注入完整 skill 正文；依赖 Pi 原生元数据 + 按需 `read`。例外：某些跨 harness 集成（如 Superpowers）把 startup bootstrap 作为明确验收契约，必须按该项目自身规范保留。
