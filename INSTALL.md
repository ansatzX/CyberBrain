# CyberBrain 安装指南（Pi）

> 给 LLM / 安装者看的完整安装流程。按顺序执行，不要跳步。

安装与升级均以当前仓库的完整 Pi 包为准，不逐文件叠加旧版本，不要求用户执行版本间手工迁移。已有安装统一执行下方「更新」流程；全量更新指包管理的扩展、skills、slash 默认定义和子代理，不包括清空用户配置目录。

## 依赖项

本项目（`cyberbrain-pi`）依赖：

| 依赖 | 作用 | 安装方式 |
| --- | --- | --- |
| `pi-subagents` (npm) | 子代理委派扩展（单次调用 / workflowScript 编排） | 作为独立 Pi 包安装：`pi install npm:pi-subagents`（下方第 2 步） |
| `pi-lens` (npm) | 实时代码反馈（LSP / linters / formatters / type-checking） | 作为独立 Pi 包安装：`pi install npm:pi-lens`（下方第 2 步） |
| `AIHUBMIX_API_KEY` | AIHubMix provider | 可选环境变量；缺失时仅禁用该 provider |
| `DEEPSEEK_API_KEY` | `deepseek-full`（Anthropic / Responses 共用） | 可选环境变量；缺失时该 provider 不可调用 |
| `CUHKSZ_API_KEY` | CUHKSZ provider | 可选环境变量；缺失时仅禁用该 provider |

TypeScript 测试与 doctor 语法检查使用 Node 内置的 type stripping（Node 22.6+），无需 npm 依赖。

## 前置条件

- `pi` CLI 已安装且在 PATH 中（`pi --version` 可见）
- Node.js 22.6+（doctor 与测试用内置 type stripping 跑 TS：22.6 起支持，23.6+ 默认开启，推荐 24）
- Python 3（`tools/manage-pi.sh` 安装器需要）
- macOS 或 Linux（当前自动安装器的支持平台）

## 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/ansatzX/CyberBrain.git ~/soft/CyberBrain
cd ~/soft/CyberBrain

# 2. 安装必需依赖（全局 Pi 包，跟随上游最新版）
pi install npm:pi-subagents
pi install npm:pi-lens

# 3. 注册完整本地包到 Pi（写入所选 agent home 的 settings.json）
bash tools/manage-pi.sh install

# 4. 验证
bash tools/manage-pi.sh doctor
```

`doctor` 全绿（`Doctor OK`）即安装成功。默认只检查包注册、旧文件冲突和一次性加载全部运行时代码；缺失的 provider key 仅显示为 `DISABLED` / `UNAVAILABLE`，不会让检查失败。开发者需要完整测试时显式运行 `bash tools/manage-pi.sh doctor --full`，避免新机器安装被完整测试套件拖慢。

自定义配置目录可用 `PI_CODING_AGENT_DIR`，安装命令也支持 `--pi-home /path/to/agent`（优先于环境变量）。安装器会把选定目录传给 Pi 子进程；后续运行 Pi 时也需使用同一 `PI_CODING_AGENT_DIR`。goal、slash 覆盖、provider cache 和 models.json 均跟随该目录。

安装器管理包注册及其拥有的资源，保留用户密钥、模型偏好、会话、goal、缓存和自定义覆盖。遇到归属不明或用户修改的文件冲突应停止并报告，不用删除整个配置目录来实现「全量替代」。

## 安装后生效内容

新开 pi 会话后可用：

- **扩展命令**：`/ansatz:goal`（长任务目标：`set` / `view` / `pause` / `resume` / `clear`；active 目标在每轮结束后自动续跑，受下方五项预算约束）、`/ansatz:diff`、`/ansatz:status`、slash 模式框架（`/ansatz:review`、`/ansatz:python`）
- **providers**：`aihubmix/*`（实时模型发现）、`deepseek-full/deepseek-flash` / `deepseek-v4-pro`（V4.1 Flash 支持图片；1M 上下文、384K 最大输出；flash 支持 low/high/max，pro 支持 high/max）、`cuhksz/glm-5-fp8`（固定唯一模型，256K / 262144 tokens 上下文，每次启动写回 `models.json`）
- **pi-subagents**：子代理委派引擎（单次调用 / workflowScript 串行与并行编排 / async supervision），作为独立 Pi 包从所选配置目录加载（默认 `~/.pi/agent/npm`）
- **pi-lens**：实时代码反馈（LSP / linters / formatters / type-checking），作为全局 Pi 包从 `~/.pi/agent/npm` 加载
- **集群技能**：`agent-cluster`（多代理启动/监督/fan-in）+ `pick-model`（按次委派的模型与思考档位选择）
- **子代理角色**：`pi/subagents/awesome-agent-select/` 生成的 10 个 `cyberbrain.<role>` 代理（如 `/run cyberbrain.code-reviewer`）
- **共享 skills**：`plugins/brain`、`plugins/tachikoma`、`plugins/awesome-agent-select` 下的所有 skill

## 环境变量

```bash
export AIHUBMIX_API_KEY="sk-..."
export DEEPSEEK_API_KEY="sk-..."
export CUHKSZ_API_KEY="..."   # 自建 CUHKSZ 部署；不配则 cuhksz provider 直接失效
```

可选：`AIHUBMIX_ORIGIN`、`AIHUBMIX_CACHE_PATH`、`CYBERBRAIN_DEEPSEEK_PROTOCOL=anthropic|responses`（默认 `anthropic`）、`CYBERBRAIN_DEEPSEEK_WEB_SEARCH=0`（关闭两种协议的自动搜索注入）、`CUHKSZ_ORIGIN`、`CUHKSZ_CACHE_PATH`。Anthropic 模式为 Flash/Pro 注入搜索，单次请求 `max_uses: 3`；Responses 模式仅 Pro 注入搜索。CUHKSZ 固定只登记 `glm-5-fp8`；旧 `CUHKSZ_MODELS` 不再生效，缓存和探测不会覆盖 256K 上下文设置。

DeepSeek 扩展入口为 `pi/extensions/deepseek-full.ts`，展示名称 `DeepSeek Full · 全功能`，provider ID 为 `deepseek-full`，与内置 `deepseek` 区分。默认使用 Anthropic 兼容接口；设置 `CYBERBRAIN_DEEPSEEK_PROTOCOL=responses` 后重启可切回 Responses。模型目录由扩展启动时同步；Raft 等目录消费者须刷新模型目录。

```bash
CYBERBRAIN_DEEPSEEK_PROTOCOL=anthropic pi  # 默认协议，Flash 支持服务端搜索
CYBERBRAIN_DEEPSEEK_PROTOCOL=responses pi  # 保留的 Responses 路径，搜索仅 Pro
```

协议环境变量作用于该 Pi 进程；不会自动修改已运行的 Pi/Raft 进程环境。模型筛选应使用当前 `deepseek-full/<model>` 标识；筛选属于用户偏好，修改前需有授权。

`AIHUBMIX_API_KEY` 未设置或为空白时，AIHubMix 静默跳过启动，不发现模型、不注册 provider、不写 `models.json`。`cuhksz` 缺 key 时不注册、不请求，只告警一行。`deepseek-full` 可完成静态登记，但没有 key 时不可调用。

models.json 镜像（`registerProvider` 只对当前 pi 进程生效，直接读 `models.json` 的消费方看不到，故每次启动会把三个 provider 写回文件）：

- `AIHUBMIX_MODELS_JSON_PATH` / `CYBERBRAIN_DEEPSEEK_MODELS_JSON_PATH` / `CUHKSZ_MODELS_JSON_PATH`：覆盖目标文件（默认 `$PI_CODING_AGENT_DIR/models.json`，否则 `~/.pi/agent/models.json`）。
- `AIHUBMIX_MODELS_JSON_REFRESH=off` / `CYBERBRAIN_DEEPSEEK_MODELS_JSON_REFRESH=off` / `CUHKSZ_MODELS_JSON_REFRESH=off`：关闭对应 provider 的写入。

刷新只重写自己那一段，保留其余 key；写入前先备份为 `models.json.bak`，失败只告警，不阻断进程内的 provider 注册。

goal 自动刹车（无人值守时防止无限续跑；设为 `off` 或 `0` 关闭）：

- `CYBERBRAIN_GOAL_TURN_BUDGET`：续跑总轮数上限（默认 10）。
- `CYBERBRAIN_GOAL_IDLE_BUDGET`：连续「无实质进展」轮数上限（默认 3；该轮未调用任何会改变状态的工具即记为空转，只读工具、失败调用、`get_goal` 等自报告工具均不算进展）。
- `CYBERBRAIN_GOAL_ERROR_BUDGET`：连续报错轮数上限（默认 2）。Pi 只在重试与自动压缩耗尽后才 settle，所以 settled 的错误已是该轮终态；一个干净 turn 即清零，用户 Esc（`aborted`）不计入。
- `CYBERBRAIN_GOAL_MODEL_TURN_BUDGET`：模型轮次上限（默认 100），在单次运行的工具循环中也计数，超限前暂停并请求中断。
- `CYBERBRAIN_GOAL_TIME_BUDGET_MS`：从创建或显式 resume 起的墙钟时间上限（默认 1800000 毫秒，即 30 分钟）。定时器在模型或工具无响应时也请求中断；自动续跑不重置期限。

触发后目标转为 `paused` 而非终态：objective、历史与 `goal_id` 全部保留，`/ansatz:goal resume` 即可重新获得一份预算继续推进。

Esc 会暂停目标并取消待续跑；pause、clear 和关闭会话也取消待续跑。重启、reload 或重新进入会话后，遗留 active 目标转为 paused，直接 `/ansatz:goal resume` 恢复。中断依赖 Pi 的取消机制，不能强杀忽略取消信号的外部任务。

目标状态锁获取超时会报错且不写入，也不按锁年龄强行接管。若确认为崩溃遗留锁，先停止全部写入进程，再删除报错指明的那一个锁目录并重试。

## 更新

每次升级都更新完整包，不从旧版本复制单个扩展或 skill。先检查工作区；有未提交修改时保留并处理冲突，不强制重置仓库。

```bash
cd ~/soft/CyberBrain
git pull --ff-only
bash tools/manage-pi.sh update
bash tools/manage-pi.sh doctor
```

完成后退出旧 Pi 进程再启动，并检查扩展发现、实际模型选择器及所需命令；Raft 刷新模型目录。`doctor` 检查安装健康，不代表用户筛选、长期运行进程或外部界面都已采用最新资源。

## 卸载

```bash
cd ~/soft/CyberBrain
bash tools/manage-pi.sh uninstall
```

只移除包注册和安装清单，不动 credentials / sessions / goals / cache。

## 常见问题

- **扩展加载报 `Tool "subagent" conflicts` 之类的冲突**：先检查包清单、扩展发现路径和 `pi/node_modules`，确认是否重复加载。不要直接删除整个依赖目录或锁文件；查明重复项归属、获得移除授权并做好可恢复备份后，仅处理已确认的重复项，再重开会话。
- **安装提示路径或清单不安全**：不要绕过检查或清空配置目录。确认选定 Pi home、软链接父目录和恢复清单；嵌套未知链接、越界路径和用户修改会阻止操作。
- **提示另一个安装任务正在运行**：等待该任务退出再重试。安装、更新、卸载共用操作系统文件锁，进程退出自动释放；不要删除锁文件来强行并行执行。
- **改动不生效**：扩展在会话启动时加载，必须**新开 pi 会话**。
- **doctor 显示 `DISABLED` / `UNAVAILABLE`**：对应 provider key 未配置。`aihubmix` / `cuhksz` 不注册，`deepseek-full` 不可调用；均不影响安装健康状态与其他功能，按需 export 即可。

最新模型配置核对于 2026-09-15：[官方模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)。仅登记 `deepseek-flash` 和 `deepseek-v4-pro`，旧 Flash 别名不再登记。费用估算按高峰价，实际低谷价减半。启动时 `models.json` 镜像同步采用同一份模型配置。
