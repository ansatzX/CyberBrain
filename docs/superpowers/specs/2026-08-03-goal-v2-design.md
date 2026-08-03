# Goal 系统 v2 设计（pi 扩展，对齐 codex goal 架构）

日期：2026-08-03
状态：已批准（brainstorming 完成，待实现计划）

## 背景

pi（coding agent）的自定义 slash 扩展已实现 goal 系统 v1（`~/.pi/agent/extensions/codex-slash.ts`），但 v1 存在架构缺陷：

1. **模型直接 write 状态文件** —— 无状态机 owner，模型可能写坏格式/乱改状态
2. **每轮常驻注入** —— goal 状态每轮进上下文，浪费 token
3. **无事件驱动** —— 注入、续跑、状态迁移没有按事件组织
4. **无 blocked 审计** —— 模型可以随意声明阻塞/完成

本设计对齐 codex 的 goal 架构（源码证据：`codex-rs/ext/goal/`，2835 行），核心原则：

- **确定性逻辑归代码**（状态机 owner = 扩展 TS），**非确定性意图归模型**（工具调用）
- **模型永远不碰存储介质**
- **注入事件驱动**：日常轮次零注入，只有设置/续跑两个事件注入
- **模型状态权力极小**：只能声明 complete（须理由）或 blocked（须 3 轮阈值）

## 存储与状态机

**存储**：`~/.pi/agent/goals/<会话文件哈希>.md`（per-session，等价 codex 的 thread_goals 行；单用户单进程场景文件够用，不引入 SQLite）

```yaml
---
thread_id: <会话文件哈希>
goal_id: <uuid>
objective: <目标文本>
status: active            # active | blocked | complete | abandoned
created_at: <ISO>
updated_at: <ISO>
blocked_streak: 0         # 同一阻塞连续轮数
blocked_condition: null   # 当前阻塞条件（换条件重置计数）
complete_reason: null     # 模型标记 complete 时的理由
---
```

**状态迁移权限**：

| 迁移 | 谁触发 | 途径 |
|---|---|---|
| 创建 active | 用户 | `/ansatz:goal set` |
| active → blocked | 模型（streak ≥ 3） | `update_goal` 工具 |
| blocked → active | 用户 | clear + set（不单独做 resume） |
| active → complete | 模型（须理由） | `update_goal` 工具 → notify 用户 |
| active → abandoned | 用户 | `/ansatz:goal clear [理由]` |

不含预算：token_budget / tokens_used / budget_limited 全部砍掉（用户决策：YAGNI）。

## 工具层（模型入口）

三个工具（`pi.registerTool`，约束写进工具描述）：

**`get_goal`** — 无参。返回 objective / status / created_at / updated_at / blocked_streak。模型自查状态用（替代日常注入）。

**`create_goal`** — 参数 `objective`（必填）。描述约束"仅当用户或系统明确要求时创建；不得从普通任务推断目标"。已有 active goal → 拒绝（对齐 codex "Fails if an unfinished goal exists"）。

**`update_goal`** — 参数 `status`（枚举 complete | blocked）+ `reason`（必填）。描述约束：
- `complete`：仅当目标真正达成且无剩余工作（模型须自查证据）
- `blocked`：仅当同一阻塞条件连续 3 轮；用户恢复后重新计数

校验（扩展代码，模型无法绕过）：
- status 非法 → 错误
- blocked 且 streak < 3 → 错误"同一阻塞需连续 3 轮，当前第 N 轮"
- complete 无 reason → 拒绝
- complete 通过 → 写文件 + notify 用户（"模型声明完成：<理由>"）+ 停止续跑

## 注入层（事件驱动）

形式：`before_agent_start` 返回 message（`customType: "goal-context"`, `display: false`）+ `context` 事件过滤历史旧 goal-context（只留最新一条）——即 custom message 注入 + context 过滤（通道 2 + 3）。

两个注入事件：

| 事件 | 触发时机 | 内容 |
|---|---|---|
| `objective_updated` | `/ansatz:goal set` 后、`create_goal` 通过后 | 新目标 + 指示调整当前轮转向它 |
| `continuation` | `agent_settled` 立即触发（零间隔，对齐 codex on_thread_idle） | 目标 + 行为规范（保持目标完整、从证据工作、完成审计、blocked 审计） |

**日常轮次零注入**。模型要状态 → 调 `get_goal`。

## 续跑

- 触发：`agent_settled` 事件立即（零间隔，对齐 codex on_thread_idle；无冷却，终止只靠 update_goal/用户 clear）
- 注入 continuation 消息（`pi.sendUserMessage`, `deliverAs: "followUp"`）
- 停止条件：status 变为 complete / blocked / abandoned，或用户 clear

## 命令层（用户入口）

| 命令 | 行为 |
|---|---|
| `/ansatz:goal set <目标>` | 写文件（active）→ 注入 objective_updated 触发当轮；已有 active → 拒绝并提示先 clear |
| `/ansatz:goal view` | UI 展示 objective / status / 时间线 / blocked_streak |
| `/ansatz:goal clear [理由]` | 归档 abandoned（终态，续跑停止） |

## 错误处理

| 场景 | 处理 |
|---|---|
| 工具参数非法 | 返回错误文本给模型（模型可自纠） |
| blocked 但 streak < 3 | 错误并告知当前轮数 |
| complete 无 reason | 拒绝 |
| create 时已有 active | 拒绝 |
| goals 文件损坏/缺失 | 重建默认空状态 + notify 用户 |
| 续跑期间用户 clear | 续跑检查 status 后自然停止（单进程串行无竞态） |

## 测试

- 单元（存储/校验纯函数）：状态迁移、blocked streak 计数/重置、complete 校验、注入过滤
- 实测（`pi -p -e` 副作用验证）：set 写文件、clear 归档、工具校验
- 手动 TUI 清单：set → 模型干活 → update_goal(complete) → 续跑停止 + notify；blocked 三轮才生效

## 与 v1 的切割

- 删除：模型 write 文件的指令（goalInjection 里的"用 write 工具更新 goals.md"）
- 删除：每轮 systemPrompt 注入 → 改为事件驱动 custom message + context 过滤
- 删除：预算字段/steering
- 保留：per-session 存储、事件驱动零间隔续跑、/ansatz:goal 命令族
