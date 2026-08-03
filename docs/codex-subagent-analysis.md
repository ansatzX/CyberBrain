# Codex Subagent 源码分析

日期：2026-08-03
来源：`codex-rs` 源码直接阅读（第一手证据，非文档转述）
范围：`core/src/tools/handlers/multi_agents*`、`core/src/agent/`、`core/src/agent_communication.rs`、`agent-graph-store/`、`protocol/src/`

## 一句话结论

**codex 的 subagent 是在同一个 agent 运行时里管理一棵"线程树"**——每个 subagent 是完整独立的 thread（独立 rollout、独立 config、独立上下文窗口），有持久化的派生图、协议级加密通信、缓存感知的上下文 fork、硬性的容量/深度/继承约束。它不是"再调一次 LLM"，而是多线程体系的一等公民。

## 关键代码路径

| 关注点 | 文件 |
|---|---|
| 工具规格（v1/v2 全部 7+ 工具 schema） | `core/src/tools/handlers/multi_agents_spec.rs`（890 行） |
| spawn 公共机制（config 构建/继承/模型覆盖/角色） | `core/src/tools/handlers/multi_agents_common.rs`（463 行） |
| v2 spawn handler | `core/src/tools/handlers/multi_agents_v2/spawn.rs` |
| v2 消息工具（send_message/followup_task 共用） | `core/src/tools/handlers/multi_agents_v2/message_tool.rs` |
| v2 wait/list/interrupt | `core/src/tools/handlers/multi_agents_v2/{wait,list_agents,interrupt_agent}.rs` |
| v1 handlers（spawn/close/resume/send_input/wait） | `core/src/tools/handlers/multi_agents/` |
| 线程生成核心（fork、resume、容量） | `core/src/agent/control/spawn.rs`（1013 行） |
| 通信投递 | `core/src/agent/control.rs`（send_inter_agent_communication） |
| 通信审计 | `core/src/agent_communication.rs` |
| agent 注册表/数量限制 | `core/src/agent/registry.rs` |
| 角色系统 | `core/src/agent/role.rs` |
| 目标解析（id / 规范路径） | `core/src/agent/agent_resolver.rs` |
| 派生图持久化 | `agent-graph-store/`（thread_spawn_edges 表） |
| 协议类型 | `protocol/src/protocol.rs`（InterAgentCommunication、SubAgentSource）、`protocol/src/agent_path.rs` |
| 主线程执行委派 | `core/src/codex_delegate.rs` |

## 九点结论（证据支撑）

### 1. Subagent = 完整独立 Thread

- spawn 创建全新 thread（`ThreadSource::Subagent`），独立 rollout 文件、独立 config、独立上下文窗口
- 继承关系持久化：`SessionSource::SubAgent(SubAgentSource::ThreadSpawn { parent_thread_id, depth, agent_path, agent_role })`
- **AgentPath 层级命名**：`/root/task1/task_3`；任何 agent 可用规范路径引用其他 agent，跨分支必须用全路径（`/root/task2/task_3` 引用 `/root/task1/task_3` 只能用全名）

### 2. 上下文继承是核心设计（fork_turns）

- `fork_turns`：`none`（零上下文）/ `all`（全历史）/ `N`（最近 N 轮，`SpawnAgentForkMode::LastNTurns`）
- fork 时**清洗历史**（`keep_forked_rollout_item`）：只保留 system/developer/user 消息 + assistant 最终回答，**剔除函数调用、工具结果、推理、AgentMessage**
- full-history fork **保留父线程的缓存 prompt 前缀**（缓存优化）；截断 fork 必须重建上下文
- 父的 developer instructions 被子 agent 的替换（v2 有 `multi_agent_v2.subagent_developer_instructions` 配置，替换时精确匹配父指令文本）
- v1 另有 `fork_context` 布尔参数（v2 已废弃，报错提示用 fork_turns）

### 3. 运行时强制继承（apply_spawn_agent_runtime_overrides）

- 子 agent **强制继承**：approval_policy、approvals_reviewer、cwd、权限 profile、sandbox（防子 agent 用错策略）
- config 从父的**实时 turn 状态**构建（`build_agent_spawn_config`），不是 stale config——model、provider、reasoning_effort、service_tier 默认继承父
- 模型覆盖：`agent_default_subagent_model` 配置或 spawn 参数；校验模型支持 multi-agent backend、reasoning effort 合法

### 4. 容量与并发是硬限制

- `AgentExecutionLimiter`：每会话**并发执行上限**（`AgentLimitReached` 错误）
- `AgentRegistry`：全会话共享（AgentControl 单例），总 subagent 数量上限 + 昵称去重
- 深度上限 `agent_max_depth`（"Agent depth limit reached. Solve the task yourself."）
- v2 有 residency slots：agent 可卸载/按需重载（`reserve_v2_residency_slot`），限制常驻数量

### 5. Agent 间通信是协议级一等公民

- `InterAgentCommunication`：author / recipient / **other_recipients（群发）** / content / **encrypted_content（加密）** / trigger_turn
- 投递：`Op::InterAgentCommunication` 进入目标线程输入队列（`send_op`）
- 四种通信类型：`Spawn` / `Message` / `Followup` / `Result`（完成通知）
- 全链路 trace：`codex_otel.agent_communication`（明文内容默认不落日志，加密内容只记 "[plaintext]"）

### 6. 工具面

**v2（平铺函数）**：
- `spawn_agent`：task_name（必填，lowercase+下划线）、message（加密）、agent_type、fork_turns、model/reasoning_effort/service_tier 覆盖
- `send_message`：排队投递，**不触发新 turn**
- `followup_task`：投递并触发 turn（若空闲），**禁止 targeting root**
- `wait_agent`：等待 mailbox 更新（含排队消息与最终状态通知），timeout 有 min/max 配置防 busy-polling；也响应 steer 进来的用户输入
- `list_agents`：按 path_prefix 过滤列出活 agent
- `interrupt_agent`：中断当前 turn，agent 保持可通信

**v1（namespace `multi_agent_v1`）**：spawn_agent / send_input / wait_agent / resume_agent / close_agent（completed agent 仍占并发名额直到 close）

### 7. 角色系统（agent_type）

- 角色 = **config 层**（复用 config.toml 层叠机制，`apply_role_to_config`），spawn 时以 session-flag 优先级插入
- 角色可改 model/reasoning/approval 等；**调用者的 model_provider 和 service_tier 保持 sticky**（角色显式设置才覆盖）
- 角色文件 = 用户定义的 config 层（`AgentRoleConfig` / agent_roles 解析）

### 8. 持久化与恢复

- `thread_spawn_edges` 表（agent-graph-store）：parent→child 派生边，状态 Open/Closed；**线程派生图跨会话持久化**
- `restore_v2_agent_metadata`：resume 时从图恢复全部 agent 身份（无需重开运行时）
- 每个 agent 独立 rollout → 可独立 resume（`resume_agent_from_rollout`）
- v2 residency：`ensure_v2_agent_loaded` 按需从 rollout 恢复 agent 运行时

### 9. 委托纪律（写在工具描述里，模型每次调用可见）

**v1 描述是完整的行为规范**（约 400 词）：
- **不授权不 spawn**：只有用户或 AGENTS.md/skill 明确要求才能 spawn；"深度/彻底/研究/详细分析"的请求**不算**授权
- **关键路径自己做**：先规划，识别阻塞任务 vs sidecar 任务；立即阻塞下一步的任务不委托
- **wait 要克制**：只有被阻塞且立即需要结果才 wait_agent；等待期间做非重叠工作
- **并行模式**：信息收集可并行；实现按 **disjoint write set** 拆分（写集不重叠）
- 委托任务必须具体、自包含、有明确产出

**v2 描述精简**，但保留了：task_name 层级语义、同工具集（可再 spawn）、final answer 回传、"Only call this tool for a concrete, bounded subtask"。

## 与 pi 的对照

| 维度 | codex | pi（现状） |
|---|---|---|
| subagent 实现 | 完整线程树 + 派生图持久化 | 官方示例 subagent 扩展（spawn 独立 pi 进程，无持久化图/通信协议） |
| 通信 | 协议级 InterAgentCommunication（加密/群发/触发 turn） | 无 |
| 上下文继承 | fork 清洗 + 缓存前缀保留 | 无（新进程零上下文） |
| 硬限制 | 并发/总数/深度 | 有并发上限（MAX_CONCURRENCY） |
| 适合场景 | 同一代码库多 agent 协作 | 简单委托/并行 |

## 参考

- 本文档来源会话的完整推理过程见 pi 会话记录
- 相关源码：`/Users/ansatz/data/code/codex/codex-rs/`（上文表格路径）
