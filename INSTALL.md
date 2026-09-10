# CyberBrain 安装指南（Pi）

> 给 LLM / 安装者看的完整安装流程。按顺序执行，不要跳步。

## 依赖项

本项目（`cyberbrain-pi`）依赖：

| 依赖 | 作用 | 安装方式 |
| --- | --- | --- |
| `pi-subagents` (npm) | 子代理委派扩展（单次调用 / workflowScript 编排） | 作为独立 Pi 包安装：`pi install npm:pi-subagents`（下方第 2 步） |
| `pi-lens` (npm) | 实时代码反馈（LSP / linters / formatters / type-checking） | 作为独立 Pi 包安装：`pi install npm:pi-lens`（下方第 2 步） |
| `AIHUBMIX_API_KEY` | AIHubMix provider | 环境变量，需用户自行提供 |
| `DEEPSEEK_API_KEY` | DeepSeek Responses provider | 环境变量，需用户自行提供 |

TypeScript 测试与 doctor 语法检查使用 Node 内置的 type stripping（Node 22.6+），无需 npm 依赖。

## 前置条件

- `pi` CLI 已安装且在 PATH 中（`pi --version` 可见）
- Node.js 22.6+（doctor 与测试用内置 type stripping 跑 TS：22.6 起支持，23.6+ 默认开启，推荐 24）
- Python 3（`tools/manage-pi.sh` 安装器需要）
- macOS 或 Linux（Windows 无自动迁移，需手动）

## 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/ansatzX/CyberBrain.git ~/soft/CyberBrain
cd ~/soft/CyberBrain

# 2. 安装必需依赖（全局 Pi 包，跟随上游最新版）
pi install npm:pi-subagents
pi install npm:pi-lens

# 3. 注册本地包到 Pi（会写入 ~/.pi/agent/settings.json，迁移旧文件）
bash tools/manage-pi.sh install

# 4. 验证
bash tools/manage-pi.sh doctor
```

`doctor` 全绿（`Doctor OK`）即安装成功。它检查：包注册、旧文件冲突、必需环境变量、全部测试。

自定义配置目录可用 `PI_CODING_AGENT_DIR`，安装命令也支持 `--pi-home /path/to/agent`（优先于环境变量）。安装器会把选定目录传给 Pi 子进程；后续运行 Pi 时也需使用同一 `PI_CODING_AGENT_DIR`。goal、slash 覆盖、provider cache 和 models.json 均跟随该目录。

迁移会先备份全部旧资源并持久化恢复清单，再移除旧文件。安装或更新失败时会恢复本批已移除的资源；恢复冲突会保留清单并报错。多次迁移按资源分别记录备份位置。旧 skill 若是目录软链接，会检查链接指向的内容；迁移和恢复保留链接本身，不删除其目标目录。

## 安装后生效内容

新开 pi 会话后可用：

- **扩展命令**：`/ansatz:goal`（长任务目标：`set` / `view` / `pause` / `resume` / `clear`；active 目标在每轮结束后自动续跑，受下方三道预算刹车约束）、`/ansatz:diff`、`/ansatz:status`、slash 模式框架（`/ansatz:review`、`/ansatz:python`）
- **providers**：`aihubmix/*`（实时模型发现）、`deepseek-responses/deepseek-v4-flash` / `deepseek-v4-flash-vision-exp` / `deepseek-v4-pro`（1M 上下文；flash 思考档位 low/high/max，pro 思考档位 high/max；vision-exp 在 flash 基础上支持图像输入，定价与 flash 一致）
- **pi-subagents**：子代理委派引擎（单次调用 / workflowScript 串行与并行编排 / async supervision），作为独立 Pi 包从所选配置目录加载（默认 `~/.pi/agent/npm`）
- **pi-lens**：实时代码反馈（LSP / linters / formatters / type-checking），作为全局 Pi 包从 `~/.pi/agent/npm` 加载
- **集群技能**：`agent-cluster`（多代理启动/监督/fan-in）+ `pick-model`（按次委派的模型与思考档位选择）
- **子代理角色**：`pi/subagents/awesome-agent-select/` 生成的 10 个 `cyberbrain.<role>` 代理（如 `/run cyberbrain.code-reviewer`）
- **共享 skills**：`plugins/brain`、`plugins/tachikoma`、`plugins/awesome-agent-select` 下的所有 skill

## 环境变量

```bash
export AIHUBMIX_API_KEY="sk-..."
export DEEPSEEK_API_KEY="sk-..."
```

可选：`AIHUBMIX_ORIGIN`、`AIHUBMIX_CACHE_PATH`、`CYBERBRAIN_DEEPSEEK_WEB_SEARCH=0`（关闭 DeepSeek 默认联网搜索）。

models.json 镜像（`registerProvider` 只对当前 pi 进程生效，直接读 `models.json` 的消费方看不到，故每次启动会把两个 provider 写回文件）：

- `AIHUBMIX_MODELS_JSON_PATH` / `CYBERBRAIN_DEEPSEEK_MODELS_JSON_PATH`：覆盖目标文件（默认 `$PI_CODING_AGENT_DIR/models.json`，否则 `~/.pi/agent/models.json`）。
- `AIHUBMIX_MODELS_JSON_REFRESH=off` / `CYBERBRAIN_DEEPSEEK_MODELS_JSON_REFRESH=off`：关闭对应 provider 的写入。

刷新只重写自己那一段，保留其余 key；写入前先备份为 `models.json.bak`，失败只告警，不阻断进程内的 provider 注册。

goal 自动刹车（无人值守时防止无限续跑；设为 `off` 或 `0` 关闭）：

- `CYBERBRAIN_GOAL_TURN_BUDGET`：续跑总轮数上限（默认 10）。
- `CYBERBRAIN_GOAL_IDLE_BUDGET`：连续「无实质进展」轮数上限（默认 3；该轮未调用任何会改变状态的工具即记为空转，只读工具、失败调用、`get_goal` 等自报告工具均不算进展）。
- `CYBERBRAIN_GOAL_ERROR_BUDGET`：连续报错轮数上限（默认 2）。Pi 只在重试与自动压缩耗尽后才 settle，所以 settled 的错误已是该轮终态；一个干净 turn 即清零，用户 Esc（`aborted`）不计入。

触发后目标转为 `paused` 而非终态：objective、历史与 `goal_id` 全部保留，`/ansatz:goal resume` 即可重新获得一份预算继续推进。

## 更新

```bash
cd ~/soft/CyberBrain
git pull
bash tools/manage-pi.sh update
bash tools/manage-pi.sh doctor
```

## 卸载

```bash
cd ~/soft/CyberBrain
bash tools/manage-pi.sh uninstall
```

只移除包注册和安装清单，不动 credentials / sessions / goals / cache。

需要恢复迁移前的旧资源时使用 `bash tools/manage-pi.sh uninstall --restore-legacy`。它会先检查所有备份和目标冲突，再卸载并恢复各批资源；缺失备份会报错并保留清单。恢复中断后可重跑同一命令：已正确恢复的文件会跳过，已卸载的包不会重复移除；被用户修改的文件仍会报冲突。每项资源先完整复制到临时位置再移入目标，避免失败留下半份目录。

## 常见问题

- **扩展加载报 `Tool "subagent" conflicts` 之类的冲突**：`pi-subagents` 被装了两份（全局 Pi 包 + 仓库 `pi/node_modules` 里的旧 bundle）。删掉仓库内副本：`rm -rf pi/node_modules pi/package-lock.json` 后重开会话。
- **改动不生效**：扩展在会话启动时加载，必须**新开 pi 会话**。
- **doctor 报环境变量缺失**：provider 不会注册，但不影响其他功能；按需 export 即可。
