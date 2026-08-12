---
name: pi-extension-dev
description: 给 pi 开发自定义扩展：注册自定义 slash 命令（/xxx）、事件钩子（注入/拦截）、自定义工具、TUI 组件。当用户要"加一个 slash 命令"、"写个 pi 扩展"、"给 pi 加 /xxx 命令"、或需要 pi 扩展 API 参考时使用。包含已验证的 API 速查、踩坑清单和验证方法。
---

# pi 扩展开发

给 pi 开发扩展的完整配方。扩展 = 一个 TypeScript 文件，放在 `~/.pi/agent/extensions/`（全局）或 `.pi/extensions/`（项目，需 trust），pi 启动时自动加载。

## 快速上手：注册第一个 slash 命令

```typescript
// ~/.pi/agent/extensions/my-commands.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function myExtension(pi: ExtensionAPI) {
  pi.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify(`Hello ${args || "world"}!`, "info");
    },
  });
}
```

重启 pi 后输入 `/hello 张三` 即可。`args` 是命令后的全部参数文本（`" 张三"` 已 trim 前原始串，自行 trim）。

**带参数自动补全**：

```typescript
pi.registerCommand("deploy", {
  description: "Deploy to an environment",
  getArgumentCompletions: (prefix: string) => {
    const envs = ["dev", "staging", "prod"].filter((e) => e.startsWith(prefix));
    return envs.length > 0 ? envs.map((e) => ({ value: e, label: e })) : null;
  },
  handler: async (args, ctx) => { /* ... */ },
});
```

## 命令能做什么（常用能力）

| 能力 | 写法 | 说明 |
|---|---|---|
| 通知 | `ctx.ui.notify(msg, "info"\|"warning"\|"error")` | 无 UI 模式（print）下可能无输出 |
| 选择框 | `await ctx.ui.select(title, string[])` | 返回选中项或 `undefined`（取消） |
| 确认框 | `await ctx.ui.confirm(title, message)` | 返回 boolean |
| 文本输入 | `await ctx.ui.input(title, placeholder?)` | 返回字符串或 `undefined` |
| footer 状态 | `ctx.ui.setStatus("key", "text")` | 传 `undefined` 清除 |
| 编辑区上方 widget | `ctx.ui.setWidget("key", string[])` | 传 `undefined` 清除 |
| 跑 shell | `const r = await pi.exec("git", ["status"], { timeout: 8000 })` | 返回 `{ stdout, stderr, code, killed }` |
| 触发模型 | `pi.sendUserMessage("指令文本", { deliverAs: "steer"\|"followUp" })` | 发送 user 消息触发 turn |
| 读会话 | `ctx.sessionManager.getSessionFile()` / `.getEntries()` | 会话文件路径 / 全部条目 |
| 当前模型 | `ctx.model` | Model 对象（名称在 `ctx.model.model`） |
| 会话持久化 | `pi.appendEntry("my-type", data)` | 写入会话文件（不参与 LLM 上下文），resume 时用 `sessionManager.getEntries()` 找回 |
| 快捷键 | `pi.registerShortcut("ctrl+alt+p", { handler })` | 注册键位 |
| CLI flag | `pi.registerFlag("plan", { type: "boolean", default: false })` | `pi.getFlag("plan")` 读取 |

## 常用事件钩子

| 事件 | 时机 | 典型用途 |
|---|---|---|
| `session_start` | 会话启动/resume | 恢复状态、初始化 |
| `before_agent_start` | 每轮 turn 前 | **注入上下文**（返回 `{ systemPrompt }` 或 `{ message }`），如 goal 状态 |
| `tool_call` | 工具调用前 | **拦截**（返回 `{ block: true, reason }`），如危险命令权限门 |
| `turn_end` | 每轮结束 | 解析模型输出（如 `[DONE:n]` 标记）更新状态 |
| `agent_settled` | agent 完全结束（无重试/续跑） | 触发后续动作，如 goal 自动续跑 |
| `context` | 消息发给模型前 | 过滤/改写消息 |

完整生命周期图与签名：见 [docs/events.md](docs/events.md)。

## 开发流程（重要）

1. **先看官方例子**：`/opt/homebrew/Cellar/pi-coding-agent/<ver>/libexec/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/` 有 60+ 个工作示例（commands.ts、plan-mode/、permission-gate.ts、notify.ts、sandbox/、subagent、status-line.ts 等），按需复制改造。
2. **写代码**：参考 [docs/api-reference.md](docs/api-reference.md) 核对签名。
3. **验证**（必须，按顺序）：
   - `node --check <file>.ts` — 语法检查
   - 若文件已在自动发现目录：直接 `pi -p "/cmd args"`；若只想加载单个扩展：`pi -p -ne -e <file>.ts "/cmd args"`。不要把自动发现与 `-e` 混用，否则同名命令会变成 `/cmd:1`、`/cmd:2`。print 模式 notify 不可见时，用可逆副作用或测试专用目录验证 handler。
   - 检查有无 `ParseError` 输出（加载失败会报错并提示 `-ne` 排查）
4. **交付**：放 `~/.pi/agent/extensions/`，重启 pi（或 `/reload` 重载扩展）生效。同名命令冲突时 pi 自动加后缀 `/xxx:1`。

## 踩坑清单（血的教训）

详见 [docs/pitfalls.md](docs/pitfalls.md)，核心几条：

1. **`??` 与 `||`/`&&` 不能无括号混用**：`a ?? b || c` 是 JavaScript 语法错误；写成 `(a ?? b) || c`。pi 支持 `??` 与 `?.`，不要为兼容性把它们机械改成 `||`/`&&`（会改变空字符串、0、false 的语义）。
2. **参数解析分支要小心**：`/goal clear 理由` 这种带参数的子命令，用 `startsWith` 匹配，不要 `===`。
3. **print/RPC 模式没有 UI**：`ctx.hasUI` 为 false 时 `select/confirm/input` 不可用，先判断再调用。
4. **`ctx.ui.notify` 在 print 模式无输出**：验证命令执行要靠副作用（写文件/改状态）。
5. **ExtensionAPI 的 `pi.sendUserMessage()` 是 fire-and-forget**；命令 handler 中不要假设它可被 await。会话替换后的回调必须使用新 `ctx.sendUserMessage()`。
6. **`extensions/` 下所有 `.ts`/`.js` 都会作为扩展入口加载**；测试和辅助模块放 `~/.pi/agent/lib/` 或独立包目录。

## 核心模式：Slash = Prompt 即配置（沉淀 prompt 模式）

方法论（见用户博客）：复用超过一次的 prompt 模式 → 沉淀成 slash。实现为已部署的 `Cyberbrain/pi/extensions/slash-framework.ts`：

- 每个 slash = `~/.pi/agent/slashes/<name>.md` 一个文件：frontmatter（`name` / `description`，可选 `namespace` 默认 `ansatz`，可选 `scope: once|session` 默认 `once`）+ 正文 = 优化好的 prompt
- 框架注册 `/ansatz:<name>`；prompt 只由 `before_agent_start` 注入一次，命令参数作为用户任务消息发送。`once` 在一次 agent run 后自动退出，`session` 保持到 `off`。
- 行为控制走 hook：`before_agent_start` 每轮注入 prompt 文本（hook 代码本身不进 LLM 上下文，省 token）
- 原则：一个 slash 只干一件事；hook 里不加载 skills（要 skill 把名字写进 prompt 文件）；沉淀时用纯 workflow 文本最省 token
- **新沉淀 = 扔一个 .md 文件进 `~/.pi/agent/slashes/`，`/reload` 即生效**（命令自动带 `ansatz:` 前缀）
- 命名空间约定：自定义 slash 一律 `/<ns>:<name>`（如 `/ansatz:review`、`/skill:tdd` 是 pi 内置格式）；pi 命令解析按空格分割取命令名，冒号原样支持
- 样板：`Cyberbrain/pi/slashes/python.md`（Python agent，Google style + current docs + what/why；context7 仅在可用时使用）
- **goal 系统 v2**（对齐 codex `ext/goal/` 架构）：`extensions/goal.ts`（命令/工具/事件壳）+ `lib/goal-core.ts`（纯逻辑可单测：存储/状态机/校验/注入文本）。模型只能通过 `get_goal`/`create_goal`/`update_goal` 工具交互（update 仅 complete 须理由 / blocked 须 3 轮阈值），日常零注入（事件驱动），续跑 = `agent_settled` 立即（零间隔，对齐 codex on_thread_idle）
- **环境事实（实测）**：① `extensions/` 下**所有 .ts 都被当扩展加载**——辅助模块必须放 `~/.pi/agent/lib/`；② 同一扩展被双加载（自动 + `-e`）时命令名变 `:1/:2` 导致原命令失效——测试用 `-ne -e`；③ print 模式每次 session 文件不同（threadId 漂移）——测试用 `--session <固定路径>`；④ `registerTool` 的 `parameters` 必须是合法 JSON Schema（`{ type: "object", properties: {} }`，不能是空 `{}`）

## 完整示例
[examples/namespaced-command.ts](examples/namespaced-command.ts) 是最小可复制样板。完整实战参考：`Cyberbrain/pi/extensions/slash-framework.ts`、`goal.ts` 与 `utility-commands.ts`。

## 参考文档

- 官方文档：`/opt/homebrew/Cellar/pi-coding-agent/<ver>/libexec/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`（最权威，先查它）
- 类型声明：`.../dist/core/extensions/types.d.ts`（精确签名，比文档快）
- 本文档章节：[api-reference.md](docs/api-reference.md) / [events.md](docs/events.md) / [pitfalls.md](docs/pitfalls.md) / [verification.md](docs/verification.md)
