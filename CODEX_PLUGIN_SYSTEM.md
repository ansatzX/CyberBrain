# Codex 插件系统机制

> 基于 Codex 源码 `/Users/ansatz/data/code/codex/codex-rs/` 分析。

## 1. 插件目录结构

```
plugin-name/
├── .codex-plugin/
│   └── plugin.json          # 必需：定义 name、version、skills、hooks 等路径
├── skills/                  # 可选：SKILL.md 文件 → Codex 启动时加载
├── hooks/
│   └── hooks.json           # 可选：SessionStart / PreToolUse / PostToolUse 等事件钩子
├── agents/                  # ❌ 不被 Codex 识别（只被 Claude Code 识别）
├── .mcp.json                # 可选：MCP server 定义
└── .app.json                # 可选：App connector 定义
```

**插件清单 `plugin.json` 支持的路径字段**（[manifest.rs](/Users/ansatz/data/code/codex/codex-rs/core-plugins/src/manifest.rs)）：

| 字段 | 用途 |
|---|---|
| `skills` | SKILL.md 所在目录 |
| `mcpServers` | MCP server 配置文件 |
| `apps` | App connector 配置 |
| `hooks` | 钩子配置文件（路径或内联） |

**没有 `agents` 字段**。Agent role 不是插件系统的一等公民。

## 2. Agent Role 的发现机制

Agent role 由 `load_agent_roles()` 负责发现（[agent_roles.rs](/Users/ansatz/data/code/codex/codex-rs/core/src/config/agent_roles.rs)）：

```
load_agent_roles()
  → 遍历每个 config_layer
    → 解析该 layer 的 config.toml 中的 [agents] 段
    → 扫描该 layer 的 config_folder/agents/*.toml
    → 去重合并到 config.agent_roles: BTreeMap<String, AgentRoleConfig>
```

**只有 config layer 的 `agents/` 子目录被扫描**。插件不是 config layer，插件目录下的 `agents/` 完全不可见。

最终 `spawn_agent` 工具的 `agent_type` 参数描述由 `spawn_tool_spec::build(&config.agent_roles)` 生成（[role.rs](/Users/ansatz/data/code/codex/codex-rs/core/src/agent/role.rs:183)）。

**Agent role .toml 格式**（参考 [builtins/explorer.toml](/Users/ansatz/data/code/codex/codex-rs/core/src/agent/builtins/explorer.toml)）：

```toml
name = "role-name"
description = "One-line description shown in spawn_agent tool"

developer_instructions = """
Full system prompt...
"""
```

可选字段：`model`、`model_reasoning_effort` 等 ConfigToml 字段。

## 3. 安装/卸载流程

### 安装

`install_plugin()` → `materialize_marketplace_plugin_source()` → `store.install()` → `copy_dir_recursive()` → `replace_plugin_root_atomically()` → `set_user_plugin_enabled()`

（[manager.rs:804](/Users/ansatz/data/code/codex/codex-rs/core-plugins/src/manager.rs:804), [store.rs:98](/Users/ansatz/data/code/codex/codex-rs/core-plugins/src/store.rs:98)）

| 步骤 | 操作 |
|---|---|
| 1. 解析 marketplace | 从 marketplace.json 找到插件 source（Git 或 local） |
| 2. 物化 source | Git → clone；Local → 直接用本地路径 |
| 3. 拷贝到缓存 | `copy_dir_recursive(source → ~/.codex/plugins/cache/{marketplace}/{plugin}/{version}/)` |
| 4. 写 config.toml | `plugins."marketplace:plugin" = { enabled = true }` |

缓存路径：`~/.codex/plugins/cache/{marketplace_name}/{plugin_name}/{version}/`

**关键**：拷贝是普通 `fs::copy`，不是 symlink。源目录修改不会自动反映到缓存。

### 刷新

插件缓存更新时机：
- 启动时 `refresh_non_curated_plugin_cache()` 检测 marketplace source version 是否变化
- 如果变化 → `force_reinstall` 重新拷贝
- `codex marketplace upgrade` 手动触发

### 卸载

`uninstall_plugin()` → `store.uninstall()`  + `clear_user_plugin()`

（[manager.rs:925](/Users/ansatz/data/code/codex/codex-rs/core-plugins/src/manager.rs:925)）

| 步骤 | 操作 |
|---|---|
| 1. 删缓存 | `fs::remove_dir_all(~/.codex/plugins/cache/{marketplace}/{plugin}/)` |
| 2. 删配置 | 从 `~/.codex/config.toml` 移除 `[plugins."xxx"]` 条目 |

**没有卸载钩子**。卸载后不会运行任何清理脚本。

## 4. Hook 系统

支持的事件（[hook_config.rs](/Users/ansatz/data/code/codex/codex-rs/config/src/hook_config.rs)）：

| 事件 | 触发时机 |
|---|---|
| `SessionStart` | 每次 Codex 会话启动 |
| `PreToolUse` | 工具执行前 |
| `PostToolUse` | 工具执行后 |
| `PreCompact` / `PostCompact` | 上下文压缩前后 |
| `UserPromptSubmit` | 用户提交 prompt |
| `Stop` | 会话结束 |
| `PermissionRequest` | 权限请求 |

Handler 类型：`command`（执行命令）、`prompt`（注入文本）、`agent`（触发 agent）。

**没有 `on_install` / `on_uninstall` 事件**。

Hook 命令执行时自动注入环境变量（[discovery.rs:223](/Users/ansatz/data/code/codex/codex-rs/hooks/src/engine/discovery.rs:223)）：

| 变量 | 值 |
|---|---|
| `PLUGIN_ROOT` | 插件缓存的绝对路径 |
| `PLUGIN_DATA` | 插件数据目录 |
| `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA` | 同上（兼容名） |

## 5. 工作区插件 vs 全局插件

- **工作区插件**：通过 `.agents/plugins/marketplace.json` 注册，`source.source = "local"`
- **全局插件**：通过 `~/.agents/plugins/marketplace.json` 或远程 marketplace 注册
- `plugin.json` 的 `hooks` 路径必须以 `./` 开头，相对于插件根目录

## 6. Workaround：让插件提供 Agent Role

因为插件系统不原生支持 agent role，workaround 是：

1. 在插件里放 `agents/*.toml`（Codex agent role 格式）
2. 用 `SessionStart` hook + `$PLUGIN_ROOT` 环境变量，把 `.toml` 软链到 `~/.codex/agents/`
3. Codex 启动时 `load_agent_roles()` 自动发现

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "mkdir -p \"$HOME/.codex/agents\" && for f in \"$PLUGIN_ROOT/agents\"/*.toml; do [ -f \"$f\" ] && ln -sf \"$f\" \"$HOME/.codex/agents/$(basename \"$f\")\"; done",
        "commandWindows": "python -c \"import os,shutil,glob; d=os.path.join(os.environ['PLUGIN_ROOT'],'agents'); t=os.path.join(os.path.expanduser('~'),'.codex','agents'); os.makedirs(t,exist_ok=True); [shutil.copy2(f,os.path.join(t,os.path.basename(f))) for f in glob.glob(os.path.join(d,'*.toml'))]\"",
        "async": true
      }]
    }]
  }
}
```

**局限**：
- 不是安装/卸载时触发，而是下次 session 启动（`SessionStart` 是首次可用时机）
- 卸载后 symlink 变成断链，清理需手动 `rm ~/.codex/agents/*.toml`

## 7. 清理 Agent Symlink

项目级工具 `tools/cleanup-agent-symlinks.sh` 可批量清理所有插件创建的 agent role symlink：

```bash
bash tools/cleanup-agent-symlinks.sh
```

- 列出 `~/.codex/agents/` 中所有 symlink（不管来自哪个插件）
- 确认后删除
- 不触碰用户自己的普通 `.toml` 文件
- 仍启用的插件会在下次 SessionStart 自动重建 symlink
