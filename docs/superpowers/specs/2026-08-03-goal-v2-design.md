# Goal 系统 v2 设计（pi 扩展，对齐 codex goal 架构）

日期：2026-08-03
状态：已实现并验证；2026-08-17 修订为**显式启动、无自动续跑**。

## 原则

- 扩展代码是状态机 owner；模型永远不直接写状态文件。
- 日常轮次零注入；`/ansatz:goal set` 与 `/ansatz:goal resume` 都是显式用户动作，各自只启动一轮消息。
- active goal 保存目标和状态，**但 `agent_settled` 不得自动续跑**。模型完成一轮后由用户下一次输入、显式 resume，或另行实现的有界调度器决定是否继续。
- 模型只可通过 `create_goal`、`get_goal`、`update_goal` 交互。

## 存储

状态按 session 隔离，路径为：

```text
~/.pi/agent/goals/<sha1(session-file)>.json
```

写入使用临时文件 + rename 原子替换，文件权限 `0600`。旧 `.md` 状态在首次读取时自动迁移为 JSON。

```json
{
  "thread_id": "session hash",
  "goal_id": "uuid",
  "objective": "目标文本",
  "status": "active",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp",
  "blocked_streak": 0,
  "blocked_condition": null,
  "last_blocked_turn_id": null,
  "status_reason": null
}
```

状态：`active | paused | blocked | complete | abandoned`。

## 工具

### `get_goal`

无参数，返回目标、状态、时间、blocked audit 与 status reason。

### `create_goal`

参数：`objective`。只有用户或系统明确要求时可调用。active、paused、blocked 都属于 unfinished goal，禁止直接覆盖；用户必须 resume 或 clear。

### `update_goal`

参数：`status: complete | blocked`、`reason`。

- complete：必须附完成理由。
- blocked：同一阻塞条件必须在至少三个**不同 turn 中被显式报告**；同一 turn 的重复/并行调用最多计一次。
- 条件按 trim 和空白归一化比较。报告不同条件会开始新的 blocked audit；未显式报告 blocked 的中间 turn 不会被插件猜测为进展或阻塞。

turn identity 来源于 pi 的 `turn_start { turnIndex, timestamp }` 事件。

## 命令

- `/ansatz:goal set <objective>`
- `/ansatz:goal view`
- `/ansatz:goal pause`
- `/ansatz:goal resume`
- `/ansatz:goal clear [reason]`

在 `/ansatz:goal` 命令中，只有显式 `set <objective>` 能创建目标；未知或拼错的子命令只显示 usage，不能意外启动 agent turn。`create_goal` 工具仍可在用户或系统明确要求时创建目标。pause 保留目标并停止工作；resume 重置 blocked audit 并立即发送**一条** continuation。

## 续跑边界

```text
explicit /ansatz:goal set
  -> send one objective message

explicit /ansatz:goal resume
  -> reset blocked audit
  -> send one continuation message

agent_settled
  -> remain idle
```

`agent_settled` 是空闲状态通知，不是 active goal 的授权续跑信号。无条件 follow-up 会在模型报告等待外部输入、授权或无新证据时形成无限循环；不得使用。

## 测试

- `pi/test/goal-core.test.ts`：JSON 往返、旧格式迁移、状态迁移、同条件按 turn 的 blocked audit、条件变更重置、pause/resume、工具返回文本和 prompt。
- 回归检查：goal extension 不注册 `agent_settled` 自动 follow-up；只有 `set` 与 `resume` 路径可以启动一轮。
- 固定 session 的 print smoke 可验证 set → pause → resume → clear；print 模式 session 路径必须固定，避免 threadId 漂移。
