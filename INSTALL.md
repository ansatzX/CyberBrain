# CyberBrain 安装指南（Pi）

> 给 LLM / 安装者看的完整安装流程。按顺序执行，不要跳步。

## 依赖项

本项目（`cyberbrain-pi`）依赖：

| 依赖 | 作用 | 安装方式 |
|---|---|---|
| `pi-subagents` (npm, ^0.40.0) | 子代理委派扩展（chains / parallel / TUI clarification） | 声明在 `pi/package.json` 的 `dependencies`，由下方第 2 步自动安装 |
| `tsx` (devDependency) | 跑 TypeScript 测试和 doctor 语法检查 | 同上 |
| `AIHUBMIX_API_KEY` | AIHubMix provider | 环境变量，需用户自行提供 |
| `DEEPSEEK_API_KEY` | DeepSeek Responses provider | 环境变量，需用户自行提供 |

## 前置条件

- `pi` CLI 已安装且在 PATH 中（`pi --version` 可见）
- Node.js 20+，npm 10+
- Python 3（`tools/manage-pi.sh` 安装器需要）
- macOS 或 Linux（Windows 无自动迁移，需手动）

## 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/ansatzX/CyberBrain.git ~/soft/CyberBrain
cd ~/soft/CyberBrain

# 2. 安装 pi 包依赖（pi-subagents + tsx）
#    必须加 --legacy-peer-deps，避免把 peer 的 pi 运行时重复安装进 node_modules
npm --prefix pi install --legacy-peer-deps

# 3. 注册本地包到 Pi（会写入 ~/.pi/agent/settings.json，迁移旧文件）
bash tools/manage-pi.sh install

# 4. 验证
bash tools/manage-pi.sh doctor
```

`doctor` 全绿（`Doctor OK`）即安装成功。它检查：包注册、旧文件冲突、`pi-subagents` 依赖是否存在、必需环境变量、全部测试。

## 安装后生效内容

新开 pi 会话后可用：

- **扩展命令**：`/ansatz:goal`（长任务目标）、`/ansatz:diff`、`/ansatz:status`、slash 模式框架（`/ansatz:review`、`/ansatz:python`）
- **providers**：`aihubmix/*`（实时模型发现）、`deepseek-responses/deepseek-v4-flash`（1M 上下文，思考档位 low/high/xhigh/max）
- **pi-subagents**：子代理委派引擎（chains / parallel fanout / async supervision），资源经 `pi/node_modules/pi-subagents/` 加载
- **集群技能**：`agent-cluster`（多代理启动/监督/fan-in）+ `pick-model`（按次委派的模型与思考档位选择）
- **子代理角色**：`pi/subagents/awesome-agent-select/` 生成的 9 个 `cyberbrain.<role>` 代理（如 `/run cyberbrain.code-reviewer`）
- **共享 skills**：`plugins/brain`、`plugins/tachikoma`、`plugins/awesome-agent-select` 下的所有 skill

## 环境变量

```bash
export AIHUBMIX_API_KEY="sk-..."
export DEEPSEEK_API_KEY="sk-..."
```

可选：`AIHUBMIX_ORIGIN`、`AIHUBMIX_CACHE_PATH`、`CYBERBRAIN_DEEPSEEK_WEB_SEARCH=0`（关闭 DeepSeek 默认联网搜索）。

## 更新

```bash
cd ~/soft/CyberBrain
git pull
npm --prefix pi install --legacy-peer-deps   # 依赖可能变化
bash tools/manage-pi.sh update
bash tools/manage-pi.sh doctor
```

## 卸载

```bash
cd ~/soft/CyberBrain
bash tools/manage-pi.sh uninstall
```

只移除包注册和安装清单，不动 credentials / sessions / goals / cache。

## 常见问题

- **doctor 报 `pi-subagents dependency missing`**：漏了第 2 步，执行 `npm --prefix pi install --legacy-peer-deps` 后重跑 doctor。
- **改动不生效**：扩展在会话启动时加载，必须**新开 pi 会话**。
- **doctor 报环境变量缺失**：provider 不会注册，但不影响其他功能；按需 export 即可。
