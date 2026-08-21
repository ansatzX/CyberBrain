# Pi Extension API Quick Reference

Authoritative source: `packages/coding-agent/docs/extensions.md` and `packages/coding-agent/src/core/extensions/types.ts` in the pi repository.

## Commands

```ts
pi.registerCommand("namespace:name", {
  description: "...",
  getArgumentCompletions: (prefix) => [{ value: "x", label: "x" }],
  handler: async (args, ctx) => { /* ... */ },
});
```

## Tools

Use a complete JSON Schema for `parameters`; even an empty object tool needs `{ type: "object", properties: {} }`.

```ts
pi.registerTool({
  name: "tool_name",
  label: "Tool label",
  description: "Model-facing contract",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  async execute(_id, params, signal, onUpdate, ctx) {
    return { content: [{ type: "text", text: "result" }], details: {} };
  },
});
```

## Common API

- `pi.exec(command, args, options)` → `{ stdout, stderr, code, killed }`
- `pi.sendUserMessage(content, { deliverAs: "steer" | "followUp" })` → fire-and-forget
- `pi.sendMessage(message, options)` → custom model-visible message
- `pi.appendEntry(customType, data)` → persistent session entry, not model-visible
- `pi.getActiveTools()` / `pi.setActiveTools(names)`
- `pi.registerShortcut(key, options)`
- `pi.registerFlag(name, options)` / `pi.getFlag(name)`

## Context

- `ctx.cwd`
- `ctx.mode`, `ctx.hasUI`
- `ctx.sessionManager.getSessionFile()` / `getEntries()`
- `ctx.model` (`provider`, `id`, `name`, `contextWindow`, `maxTokens`)
- `ctx.ui.notify/select/confirm/input/editor/setStatus/setWidget`
