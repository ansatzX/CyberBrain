# Goal 系统 v2 设计（pi 扩展，对齐 codex goal 架构）

日期：2026-08-03
状态：已实现并验证

## 原则

- 扩展代码是状态机 owner；模型永远不直接写状态文件。
- 日常轮次零注入；设置、恢复与自动续跑通过显式消息驱动。
- `agent_settled` 后只要 goal 仍为 active，就立即续跑；终止靠 complete / blocked / pause / clear。
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
- blocked：必须跨三个**不同 turn** 调用；同一 turn 的重复/并行调用最多计一次。
- 如果中间出现一个没有 blocked 声明的 turn，blocked audit 重置。

turn identity 来源于 pi 的 `turn_start { turnIndex, timestamp }` 事件。

## 命令

- `/ansatz:goal set <objective>`
- `/ansatz:goal view`
- `/ansatz:goal pause`
- `/ansatz:goal resume`
- `/ansatz:goal clear [reason]`

pause 保留目标但停止自动续跑；resume 重置 blocked audit 并立即发送 continuation。

## 自动续跑

```text
agent_settled
  -> load current session goal
  -> status == active ? send continuation as followUp : stop
```

没有时间冷却；与 codex `on_thread_idle` 一致。用户已明确接受持续模型调用的成本。

## 测试

- `~/.pi/agent/lib/goal-core.test.ts`：JSON 往返、旧格式迁移、状态迁移、按 turn blocked audit、pause/resume、工具返回文本、续跑条件。
- 固定 session 的 print smoke：set → pause → resume → clear。
- 工具真实调用已验证：get/create/update complete；blocked 按 turn 逻辑由纯函数测试覆盖。
