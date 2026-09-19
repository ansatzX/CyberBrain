---
name: pi-extension-dev
description: 给 pi 开发自定义扩展：注册自定义 slash 命令（/xxx）、事件钩子（注入/拦截）、自定义工具、TUI 组件。当用户要"加一个 slash 命令"、"写个 pi 扩展"、"给 pi 加 /xxx 命令"、或需要 pi 扩展 API 参考时使用。包含已验证的 API 速查、踩坑清单和验证方法。
---

# pi 扩展开发

给 pi 开发扩展：先确定代码归属和实际加载位置，再选 API 和验证方法。

## 先确定交付边界

- **CyberBrain 包内开发**：入口放 `pi/extensions/`，纯逻辑放 `pi/lib/`，测试放 `pi/test/`，通过 `pi/package.json` 暴露。不要再复制到用户 extensions 目录造成双加载。
- **项目扩展**：仅当用户要该项目独有的扩展时，放目标项目的 `.pi/extensions/`；检查该项目的 trust 和 settings。
- **用户全局扩展**：仅在明确要求全局安装时，使用当前 `PI_CODING_AGENT_DIR` 指定的 agent home，未设置才默认 `~/.pi/agent`。CyberBrain 运行时代码用 `pi/lib/agent-paths.ts` 的 `agentDir()` 解析路径，不硬编码 home；安装器还可能使用 `--pi-home`。
- 核对当前 Pi 可执行文件、包引用和选定 home。修改源码不等于已部署；检查实际发现路径、重复命令和当前进程是否需要重新加载。
- review / 诊断只读取代码和配置，不自动安装、迁移或复制文件。

## 快速上手：注册第一个 slash 命令

```typescript
// CyberBrain 包内示例：pi/extensions/my-commands.ts
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
| --- | --- | --- |
| 通知 | `ctx.ui.notify(msg, "info"\|"warning"\|"error")` | 无 UI 模式（print）下可能无输出 |
| 选择框 | `await ctx.ui.select(title, string[])` | 返回选中项或 `undefined`（取消） |
| 确认框 | `await ctx.ui.confirm(title, message)` | 返回 boolean |
| 文本输入 | `await ctx.ui.input(title, placeholder?)` | 返回字符串或 `undefined` |
| footer 状态 | `ctx.ui.setStatus("key", "text")` | 传 `undefined` 清除 |
| 编辑区上方 widget | `ctx.ui.setWidget("key", string[])` | 传 `undefined` 清除 |
| 跑 shell | `const r = await pi.exec("git", ["status"], { timeout: 8000 })` | 返回 `{ stdout, stderr, code, killed }` |
| 触发模型 | `pi.sendUserMessage("指令文本", { deliverAs: "steer"\|"followUp" })` | 发送 user 消息触发 turn |
| 读会话 | `ctx.sessionManager.getSessionFile()` / `.getEntries()` | 会话文件路径 / 全部条目 |
| 当前模型 | `ctx.model` | Model 对象（标识在 `ctx.model.id`，显示名称在 `ctx.model.name`） |
| 会话持久化 | `pi.appendEntry("my-type", data)` | 写入会话文件（不参与 LLM 上下文），resume 时用 `sessionManager.getEntries()` 找回 |
| 快捷键 | `pi.registerShortcut("ctrl+alt+p", { handler })` | 注册键位 |
| CLI flag | `pi.registerFlag("plan", { type: "boolean", default: false })` | `pi.getFlag("plan")` 读取 |

## 常用事件钩子

| 事件 | 时机 | 典型用途 |
| --- | --- | --- |
| `session_start` | 会话启动/resume | 恢复状态、初始化 |
| `before_agent_start` | 每轮 turn 前 | **注入上下文**（返回 `{ systemPrompt }` 或 `{ message }`），如 goal 状态 |
| `tool_call` | 工具调用前 | **拦截**（返回 `{ block: true, reason }`），如危险命令权限门 |
| `turn_end` | 每轮结束 | 解析模型输出（如 `[DONE:n]` 标记）更新状态 |
| `agent_settled` | agent 完全结束（无重试/续跑） | 可用于 goal 自动续跑，但必须按 session/idle boundary 去重并保留终态停止门 |
| `context` | 消息发给模型前 | 过滤/改写消息 |

完整生命周期图与签名：见 [docs/events.md](docs/events.md)。

## 开发流程（重要）

1. **先看当前安装的官方例子**：定位正在运行的 `pi` 可执行文件及所属包，读取相应 `docs/extensions.md` 和 `examples/extensions/`。系统打包可位于 `/usr/lib/pi/`，npm/Homebrew 布局不同；不要假定某台机器的绝对路径或旧版本文档仍适用。
2. **写代码**：参考 [docs/api-reference.md](docs/api-reference.md) 核对签名。
3. **验证**（必须，按顺序）：
   - 使用支持 TypeScript 的 Node 做语法与相关单元测试（较早的 Node 22 需要 `--experimental-strip-types`）；不支持时明确报告，不用 live provider import 代替语法检查。
   - 按 [隔离验证](docs/verification.md) 使用临时 agent home 和工作目录，显式 `-ne -e <file>.ts` 加载待测入口，测试不会触发模型调用的命令。不要把自动发现与 `-e` 混用，否则可能双加载。print 模式 notify 不可见时，用测试专用目录或可观察返回验证 handler。
   - 检查有无 `ParseError` 输出（加载失败会报错并提示 `-ne` 排查）
4. **交付**：保持上面选定的包/项目/全局边界，在获准的实际目标中验证发现与命令行为。分别报告源码测试、安装验证和当前会话验证；不要假定 `/reload` 与完整重启在状态恢复上等价。

## 踩坑清单（血的教训）

详见 [docs/pitfalls.md](docs/pitfalls.md)，核心几条：

1. **`??` 与 `||`/`&&` 不能无括号混用**：`a ?? b || c` 是 JavaScript 语法错误；写成 `(a ?? b) || c`。pi 支持 `??` 与 `?.`，不要为兼容性把它们机械改成 `||`/`&&`（会改变空字符串、0、false 的语义）。
2. **参数解析分支要小心**：`/goal clear 理由` 这种带参数的子命令，用 `startsWith` 匹配，不要 `===`。
3. **print/RPC 模式没有 UI**：`ctx.hasUI` 为 false 时 `select/confirm/input` 不可用，先判断再调用。
4. **`ctx.ui.notify` 在 print 模式无输出**：验证命令执行要靠副作用（写文件/改状态）。
5. **ExtensionAPI 的 `pi.sendUserMessage()` 是 fire-and-forget**；命令 handler 中不要假设它可被 await。会话替换后的回调必须使用新 `ctx.sendUserMessage()`。
6. **发现目录中的 `.ts`/`.js` 会作为扩展入口加载**；测试和辅助模块放入口之外，CyberBrain 使用 `pi/test/` 和 `pi/lib/`，并使用包相对导入。

## 核心模式：Slash = Prompt 即配置（沉淀 prompt 模式）

方法论（见用户博客）：复用超过一次的 prompt 模式 → 沉淀成 slash。实现为已部署的 `Cyberbrain/pi/extensions/slash-framework.ts`：

- 包内默认 slash 放 `pi/slashes/<name>.md`；用户 override 放选定 agent home 的 `slashes/<name>.md`，同名用户定义优先：frontmatter（`name` / `description`，可选 `namespace` 默认 `ansatz`，可选 `scope: once|session` 默认 `once`）+ 正文 = 优化好的 prompt
- 框架注册 `/ansatz:<name>`；prompt 只由 `before_agent_start` 注入一次，命令参数作为用户任务消息发送。`once` 在一次 agent run 后自动退出，`session` 保持到 `off`。
- 行为控制走 hook：`before_agent_start` 每轮注入 prompt 文本（hook 代码本身不进 LLM 上下文，省 token）
- 原则：一个 slash 只干一件事；hook 里不加载 skills（要 skill 把名字写进 prompt 文件）；沉淀时用纯 workflow 文本最省 token
- 新 slash 必须放入所选归属的目录；`/reload` 后检查命令被发现、实际采用的定义与覆盖顺序（命令自动带 `ansatz:` 前缀）。不要擅自覆盖用户 override。
- 命名空间约定：自定义 slash 一律 `/<ns>:<name>`（如 `/ansatz:review`、`/skill:tdd` 是 pi 内置格式）；pi 命令解析按空格分割取命令名，冒号原样支持
- 样板：`Cyberbrain/pi/slashes/python.md`（Python agent，Google style + current docs + what/why；context7 仅在可用时使用）
- **goal 的稳定约束**：源码以 [事件壳](../../extensions/goal.ts)、[状态与锁](../../lib/goal-core.ts) 和 [回归测试](../../test/goal-core.test.ts) 为准，不从旧指南复制实现快照。所有 read-modify-write 必须持有锁；锁超时不改状态，不按锁年龄偷锁，确认全部 writers 停止后才能处理孤儿锁。
- goal 的 continuation 必须在同一 session/idle boundary 去重，complete/blocked/pause/clear、用户中断和 session shutdown 都必须停止待发续跑；恢复 active 状态时不静默启动。resume 是显式重新授予预算的操作。
- goal 同时有 continuation 轮数、空转、错误、模型 turn 和墙钟时间预算。默认值和环境变量从 goal-core 读取；错误与 aborted 分开，中断不能触发自动续跑。墙钟中断是协作式取消，不保证杀掉不响应信号的外部任务。不要把词元重叠启发式描述成可靠的语义理解。

## 完整示例

[examples/namespaced-command.ts](examples/namespaced-command.ts) 是最小可复制样板。完整实战参考：`Cyberbrain/pi/extensions/slash-framework.ts`、`goal.ts` 与 `utility-commands.ts`。

## 参考文档

- 官方文档：当前 Pi 安装包的 `docs/extensions.md`（先核对版本和实际路径）
- 类型声明：`.../dist/core/extensions/types.d.ts`（精确签名，比文档快）
- 本文档章节：[api-reference.md](docs/api-reference.md) / [events.md](docs/events.md) / [pitfalls.md](docs/pitfalls.md) / [verification.md](docs/verification.md)
