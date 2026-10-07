# CyberBrain 安装指南

> 给 LLM / 安装者看的完整安装流程。按顺序执行，不要跳步。
>
> Codex 与 Pi 是独立 host adapter：分别安装、分别更新、分别卸载。共享 skills 仍在 `plugins/*/skills` 单源加载；不要把一个 host 的命令、路径或运行时 API 套到另一个 host。

安装与升级均以当前仓库为准，不逐文件叠加旧版本，不要求用户执行版本间手工迁移。已有安装统一执行对应 host 的「更新」流程。全量更新只覆盖该 host 安装器拥有的资源，不包括清空用户配置目录。

## 共用克隆

两个 host 共用同一份仓库，克隆一次即可：

```bash
mkdir -p ~/soft
git clone https://github.com/ansatzX/CyberBrain.git ~/soft/CyberBrain
cd ~/soft/CyberBrain
```

下文示例均以该路径为准。仓库已在别处时，把路径换成实际克隆目录；Codex 本地 marketplace 会记下绝对路径，移动克隆后需重新 `marketplace add`。

支持平台：macOS 或 Linux。

---

## Tachikoma 外部 CLI 配置

Tachikoma 的 skills 不负责安装或升级外部 CLI。若准备使用 Gemini CLI，先在安装/启用 Tachikoma 前关闭它的自动更新；这是持久的 Gemini 用户设置，对 Codex 和 Pi 启动的 Gemini CLI 都生效。

合并下面的键到 `~/.gemini/settings.json`，保留现有设置。如果设置了 `GEMINI_CLI_HOME`，Gemini 的用户配置位于 `$GEMINI_CLI_HOME/.gemini/settings.json`，请改实际使用的文件：

```json
{
  "general": {
    "enableAutoUpdate": false
  }
}
```

`general.enableAutoUpdate` 默认是 `true`。项目 `.gemini/settings.json` 可以覆盖用户设置，系统 settings 还可以覆盖两者；确认最终生效值为 `false` 后再通过 Tachikoma 启动 Gemini。若不能确认，就先不要启动。`general.enableAutoUpdateNotification` 只控制更新通知，不会阻止更新。Tachikoma 不会运行 Gemini CLI/package 或 extension 更新命令，除非用户明确要求升级；也不会擅自把系统包安装切换成 npm 全局安装。

---

## Codex

Codex 侧是本地 marketplace 插件，外加 `awesome-agent-select` 的显式 agent-role 安装器。只装插件不会让 Codex 看见 agent 角色。

### 前置条件

- `codex` CLI 已安装且在 PATH 中（`codex --version` 可见）
- Bash（`tools/awesome-agent-select-codex-agents.sh` 与其委托的 `plugins/awesome-agent-select/tools/manage-codex-agents.sh`）

自定义 Codex home 时设置 `CODEX_HOME`（默认 `~/.codex`）。`codex plugin` 写入该目录的 `config.toml` 与插件缓存；agent 安装器必须用同一个 home：`--codex-home "$CODEX_HOME"`（未设置时默认 `~/.codex`）。后续运行 Codex 也要使用同一 `CODEX_HOME`。

安装器不管理 `auth.json`、API 密钥、会话、模型偏好或用户 config 里与 CyberBrain 无关的键。

### 安装步骤

```bash
cd ~/soft/CyberBrain

# 1. 注册本地 marketplace（名称来自 .agents/plugins/marketplace.json：CyberBrain）
codex plugin marketplace add ~/soft/CyberBrain

# 2. 安装三个已发布插件（写入 $CODEX_HOME/config.toml，并复制到插件缓存）
codex plugin add awesome-agent-select@CyberBrain
codex plugin add tachikoma@CyberBrain
codex plugin add brain@CyberBrain

# 3. 显式安装 Codex agent roles（复制 agents/*.toml 到 $CODEX_HOME/agents/，并写归属清单）
bash tools/awesome-agent-select-codex-agents.sh install

# 4. 验证
codex plugin list --marketplace CyberBrain
bash tools/awesome-agent-select-codex-agents.sh doctor
```

`doctor` 输出 `Doctor OK` 表示托管的 agent 文件与源 TOML 一致、清单存在、且没有未迁完的旧 symlink。`codex plugin list --marketplace CyberBrain` 应显示三个插件均为 `installed, enabled`。

也可在 `codex` 交互会话里用 `/plugins`，切到 **CyberBrain** 页安装或开关插件；这不能替代第 3 步的显式 agent 安装器。按 Space 可切换已装插件的 enabled 状态。

Tachikoma 技能不会安装 Gemini CLI、Grok Build、OpenCode、Qwen、GitHub Copilot CLI、Kimi Code 或 Pi；那些 CLI 需自行安装，并在使用前核对当前接口。

### Codex sandbox configuration

Codex usually reads `$CODEX_HOME/config.toml` (`~/.codex/config.toml` by default). Use absolute paths in TOML strings; do not rely on `~` or `$HOME` expansion. Merge these entries into the existing file rather than creating duplicate tables:

```toml
# Root-level settings go before named tables.
sandbox_mode = "workspace-write"
approval_policy = "on-request"
approvals_reviewer = "auto_review"

[projects."/ABSOLUTE/PATH/TO/CyberBrain"]
trust_level = "trusted"

[marketplaces.CyberBrain]
source_type = "local"
source = "/ABSOLUTE/PATH/TO/CyberBrain"

[plugins."brain@CyberBrain"]
enabled = true

[plugins."tachikoma@CyberBrain"]
enabled = true

[sandbox_workspace_write]
network_access = true
writable_roots = [
  "/ABSOLUTE/HOME/.codex",
  "/ABSOLUTE/HOME/.gemini",
  "/ABSOLUTE/HOME/.kimi-code",
  "/ABSOLUTE/HOME/.config/opencode",
  "/ABSOLUTE/HOME/.local/share/opencode",
  "/ABSOLUTE/HOME/.local/state/opencode",
  "/ABSOLUTE/HOME/.cache/opencode",
  "/ABSOLUTE/HOME/.pi/agent",
  "/ABSOLUTE/HOME/.qwen",
  "/ABSOLUTE/HOME/.grok",
]
```

Replace both path placeholders with real absolute paths. The list is an example for this setup, not a required set: include only state directories for CLIs you run. Grok Build uses `~/.grok` by default and honors `GROK_HOME`; include the actual configured directory only if the CLI needs to write there. Pi may use a different directory when `PI_CODING_AGENT_DIR` is set.

These settings have separate roles: `workspace-write` limits filesystem writes, `on-request` controls when Codex asks for approval, `auto_review` routes supported approval decisions through Guardian, and `network_access` enables network access in the workspace-write sandbox. Auto-review does not add writable paths or enable an external CLI's own auto-approval mode. Avoid making the whole home directory writable.

Do not add obsolete `[features.guardianv2]` / `thread_context` settings. Remove an obsolete `type` field from MCP definitions if current Codex reports it as unrecognized, and check profile overrides as well as the main config.

Validate without printing config contents:

```bash
python - <<'PY'
from pathlib import Path
import tomllib

path = Path.home() / ".codex" / "config.toml"
with path.open("rb") as stream:
    tomllib.load(stream)
print(f"TOML OK: {path}")
PY
codex --strict-config --version
codex features list
```

Back up the config before editing. Fully restart Codex after changing sandbox or approval settings; an existing session keeps the policy it started with.

### 安装后生效内容

新开 Codex 会话后可用：

- **marketplace**：`config.toml` 中的 `[marketplaces.CyberBrain]`，本地源指向该克隆
- **插件**（本地 marketplace 插件副本缓存于 `$CODEX_HOME/plugins/cache/CyberBrain/<plugin>/local`，不是运行时直接读仓库工作树）：
  - `awesome-agent-select`：`team-leader` skill；agent 角色仍须显式安装器
  - `tachikoma`：外部 CLI 协调 skills（`codex`、`gemini-cli`、`grok`、`opencode`、`qwen`、`github-copilot-cli`、`kimi-code`、`pi`）
  - `brain`：审计与推理 skills（`using-ansatz-brain`、`state-machine`、`agentic-search`、`codex-compatible`、`think-before-you-calculate`、`epistemic-systems-audit`、`whole-object-responsibility`、`tame-dev-workflows`）
- **agent roles**：`$CODEX_HOME/agents/*.toml` 中的 10 个角色（`api-documenter`、`code-reviewer`、`llm-architect`、`mcp-developer`、`performance-engineer`、`qa-expert`、`test-automator`、`tooling-engineer`、`typescript-pro`、`tachikoma-runner`）。Codex 启动时从该目录发现角色；安装器会写 `.awesome-agent-select.manifest`，之后 `doctor` / `uninstall` 只动这份清单拥有的文件

插件安装单独完成时，上述 TOML **不会**出现在 `$CODEX_HOME/agents/`。这是当前唯一受支持的 Codex agent-role 安装路径；不要用 hook 或手工 symlink。

### 更新 Codex

每次升级都更新当前克隆中的插件快照与托管 agent 文件。先检查工作区；有未提交修改时保留并处理冲突，不强制重置仓库。

本地 marketplace **不支持** `codex plugin marketplace upgrade CyberBrain`（该命令只刷新 Git marketplace）。更新方式是 `git pull` 后再 `plugin add`：即使版本号未变，`plugin add` 也会重写缓存副本。

```bash
cd ~/soft/CyberBrain
git pull --ff-only
codex plugin add awesome-agent-select@CyberBrain
codex plugin add tachikoma@CyberBrain
codex plugin add brain@CyberBrain
bash tools/awesome-agent-select-codex-agents.sh install
codex plugin list --marketplace CyberBrain
bash tools/awesome-agent-select-codex-agents.sh doctor
```

完成后**新开 Codex 会话**。只 `git pull` 而不重新 `plugin add`，Codex 仍使用旧的插件缓存。Agent 角色另有一份 `$CODEX_HOME/agents/` 副本，必须再跑显式安装器。`doctor` 检查托管文件健康，不代表正在运行的 Codex 进程已经加载新角色或新 skills。

若目标文件已存在且不属于本安装器（也不是可识别的旧 symlink），安装器会跳过并警告，不会覆盖用户文件。

### 卸载 Codex

```bash
cd ~/soft/CyberBrain
bash tools/awesome-agent-select-codex-agents.sh uninstall
codex plugin remove awesome-agent-select@CyberBrain
codex plugin remove tachikoma@CyberBrain
codex plugin remove brain@CyberBrain
codex plugin marketplace remove CyberBrain
```

先卸托管 agent 文件，再卸插件与 marketplace。`plugin remove` 删除插件缓存与 config 中的插件条目，**不会**自动删除 `$CODEX_HOME/agents/*.toml`；Codex 本身也没有卸载 hook 来做这件事。

只移除 marketplace 注册、插件缓存和安装器拥有的 agent 文件，不动 credentials / sessions / 其他插件。若曾用旧的 symlink 流程，可再运行 `bash tools/cleanup-agent-symlinks.sh`；它会删除 `$CODEX_HOME/agents/` 下**全部** symlink（不只是 CyberBrain），普通文件不动。

### 常见问题

- **插件已装但看不到 agent 角色**：`codex plugin add` 不够。必须跑 `bash tools/awesome-agent-select-codex-agents.sh install`，并**新开 Codex 会话**。
- **改了仓库里的 skill，Codex 仍用旧内容**：本地 marketplace 安装的是缓存快照。重新 `codex plugin add <plugin>@CyberBrain`，再新开会话。角色 TOML 还要再跑显式安装器。
- **`marketplace upgrade CyberBrain` 报错**：本地源不是 Git marketplace。用上面的「更新」流程。
- **安装器提示 `Skipped unmanaged file`**：目标路径已有非本清单、也不是可识别旧 symlink 的文件。不要删整个 `~/.codex`；确认该文件归属后再决定保留、移走或授权覆盖。
- **自定义 `CODEX_HOME` 后 doctor 找不到文件**：`codex plugin` 与 agent 安装器、以及之后运行 Codex，必须指向同一 home。
- **提示路径不安全或冲突**：不要绕过检查或清空配置目录。确认 `CODEX_HOME`、agents 目录和清单后再重试。

---

## Pi

Pi 侧是本地包 `cyberbrain-pi`（扩展、providers、slash 默认定义、子代理和共享 skills）。安装与升级均以当前仓库的完整 Pi 包为准，不逐文件叠加旧版本。已有安装统一执行下方「更新」流程；全量更新指包管理的扩展、skills、slash 默认定义和子代理，不包括清空用户配置目录。

### 依赖项

本项目（`cyberbrain-pi`）依赖：

| 依赖 | 作用 | 安装方式 |
| --- | --- | --- |
| `pi-subagents` (npm) | 子代理委派扩展（单次调用 / workflowScript 编排） | 作为独立 Pi 包安装：`pi install npm:pi-subagents`（下方第 2 步） |
| `pi-lens` (npm) | 实时代码反馈（LSP / linters / formatters / type-checking） | 作为独立 Pi 包安装：`pi install npm:pi-lens`（下方第 2 步） |
| `@aihubmix/pi-provider-aihubmix` (npm) | 官方 AIHubMix provider（模型、认证、协议路由）；本仓库扩展只把 base URL 切到 Preferred 端点并镜像 models.json，不改官方包 | 作为独立 Pi 包安装：`pi install npm:@aihubmix/pi-provider-aihubmix`（下方第 2 步） |
| `AIHUBMIX_API_KEY` | AIHubMix provider | 可选环境变量；缺失时仅禁用该 provider |
| `DEEPSEEK_API_KEY` | `deepseek-full`（Anthropic / Responses 共用） | 可选环境变量；缺失时该 provider 不可调用 |
| `CUHKSZ_API_KEY` | CUHKSZ provider | 可选环境变量；缺失时仅禁用该 provider |

TypeScript 测试与 doctor 语法检查使用 Node 内置的 type stripping（Node 22.6+），无需 npm 依赖。

### 前置条件

- `pi` CLI 已安装且在 PATH 中（`pi --version` 可见）
- Node.js 22.6+（doctor 与测试用内置 type stripping 跑 TS：22.6 起支持，23.6+ 默认开启，推荐 24）
- Python 3（`tools/manage-pi.sh` 安装器需要）

### 安装步骤

```bash
cd ~/soft/CyberBrain

# 1. 安装必需依赖（全局 Pi 包，跟随上游最新版）
pi install npm:pi-subagents
pi install npm:pi-lens
pi install npm:@aihubmix/pi-provider-aihubmix

# 2. 注册完整本地包到 Pi（写入所选 agent home 的 settings.json）
bash tools/manage-pi.sh install

# 3. 验证
bash tools/manage-pi.sh doctor
```

`doctor` 全绿（`Doctor OK`）即安装成功。默认只检查包注册、旧文件冲突和一次性加载全部运行时代码；缺失的 provider key 仅显示为 `DISABLED` / `UNAVAILABLE`，不会让检查失败。开发者需要完整测试时显式运行 `bash tools/manage-pi.sh doctor --full`，避免新机器安装被完整测试套件拖慢。

自定义配置目录可用 `PI_CODING_AGENT_DIR`，安装命令也支持 `--pi-home /path/to/agent`（优先于环境变量）。安装器会把选定目录传给 Pi 子进程；后续运行 Pi 时也需使用同一 `PI_CODING_AGENT_DIR`。goal、slash 覆盖、provider cache 和 models.json 均跟随该目录。

安装器管理包注册及其拥有的资源，保留用户密钥、模型偏好、会话、goal、缓存和自定义覆盖。遇到归属不明或用户修改的文件冲突应停止并报告，不用删除整个配置目录来实现「全量替代」。

### 安装后生效内容

新开 pi 会话后可用：

- **扩展命令**：`/ansatz:goal`（长任务目标：`set` / `view` / `pause` / `resume` / `clear`；active 目标在每轮结束后自动续跑，受下方五项预算约束）、`/ansatz:diff`、`/ansatz:status`、slash 模式框架（`/ansatz:review`、`/ansatz:py`、`/ansatz:mode`）
- **providers**：`aihubmix/*`（把官方插件的 Default base URL `https://aihubmix.com` 在运行时切到 Preferred base URL `https://api.inferera.com`，含目录端点；本仓库不改官方包。协议按目录 `endpoints` 字段逐模型决定：claude-*开放 claude_api 走 anthropic、gemini-* 开放 gemini_api 走 gemini、开放 responses 的优先 responses、其余 chat；未声明路由的推理模型改走家族原生协议（claude→anthropic、gemini→gemini、其余→responses），因为本网关的 chat 路由会忽略思考档位（已实测））、`deepseek-full/deepseek-flash` / `deepseek-v4-pro`（V4.1 Flash 支持图片；1M 上下文、384K 最大输出；两者均支持 off/low/high/max，Pi 的 off 对应 Responses 的 none）、`cuhksz/glm-5-fp8`（固定唯一模型，256K / 262144 tokens 上下文，每次启动写回 `models.json`）
- **pi-subagents**：子代理委派引擎（单次调用 / workflowScript 串行与并行编排 / async supervision），作为独立 Pi 包从所选配置目录加载（默认 `~/.pi/agent/npm`）
- **pi-lens**：实时代码反馈（LSP / linters / formatters / type-checking），作为全局 Pi 包从 `~/.pi/agent/npm` 加载
- **集群技能**：`agent-cluster`（多代理启动/监督/fan-in）+ `pick-model`（按次委派的模型与思考档位选择）
- **子代理角色**：`pi/subagents/awesome-agent-select/` 生成的 10 个 `cyberbrain.<role>` 代理（如 `/run cyberbrain.code-reviewer`）。Pi 在包发现后即可使用，不需要 Codex 那套显式 TOML 安装器
- **共享 skills**：`plugins/brain`、`plugins/tachikoma`、`plugins/awesome-agent-select` 下的所有 skill

Tachikoma 通过 Pi 执行任务时，每次调用都会传 `--no-lens`，避免 pi-lens 的自动诊断和上下文注入干扰被委派 agent 自主完成任务。该开关只作用于这次进程；普通交互式 Pi 仍可使用 pi-lens。不要为了绕过 pi-lens 而关闭所有扩展或 skills，那会影响 provider 与其他配置。

### 环境变量

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

### 更新 Pi

每次升级都更新完整包，不从旧版本复制单个扩展或 skill。先检查工作区；有未提交修改时保留并处理冲突，不强制重置仓库。

```bash
cd ~/soft/CyberBrain
git pull --ff-only
bash tools/manage-pi.sh update
bash tools/manage-pi.sh doctor
```

完成后退出旧 Pi 进程再启动，并检查扩展发现、实际模型选择器及所需命令；Raft 刷新模型目录。`doctor` 检查安装健康，不代表用户筛选、长期运行进程或外部界面都已采用最新资源。

### 卸载 Pi

```bash
cd ~/soft/CyberBrain
bash tools/manage-pi.sh uninstall
```

只移除包注册和安装清单，不动 credentials / sessions / goals / cache。若安装时迁移过可识别的旧资源，可用 `bash tools/manage-pi.sh uninstall --restore-legacy` 按清单备份恢复；中断后重跑同一命令即可，已精确恢复的资源会跳过，已注销的包不会再删一次，用户改过的目标仍拒绝覆盖。

### 常见问题

- **扩展加载报 `Tool "subagent" conflicts` 之类的冲突**：先检查包清单、扩展发现路径和 `pi/node_modules`，确认是否重复加载。不要直接删除整个依赖目录或锁文件；查明重复项归属、获得移除授权并做好可恢复备份后，仅处理已确认的重复项，再重开会话。
- **安装提示路径或清单不安全**：不要绕过检查或清空配置目录。确认选定 Pi home、软链接父目录和恢复清单；嵌套未知链接、越界路径和用户修改会阻止操作。
- **提示另一个安装任务正在运行**：等待该任务退出再重试。安装、更新、卸载共用操作系统文件锁，进程退出自动释放；不要删除锁文件来强行并行执行。
- **改动不生效**：扩展在会话启动时加载，必须**新开 pi 会话**。
- **doctor 显示 `DISABLED` / `UNAVAILABLE`**：对应 provider key 未配置（doctor 只报告 `deepseek-full` / `cuhksz`）。`cuhksz` 不注册，`deepseek-full` 不可调用；`aihubmix` 的 provider 本体由官方 npm 包提供，本仓库只在本仓库代码里把它的 base URL 切到 Preferred 端点（默认 `https://api.inferera.com`）并镜像 `models.json`，不改官方包。均不影响安装健康状态与其他功能，按需 export 即可。

最新模型配置核对于 2026-09-15：[官方模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)。仅登记 `deepseek-flash` 和 `deepseek-v4-pro`，旧 Flash 别名不再登记。费用估算按高峰价，实际低谷价减半。启动时 `models.json` 镜像同步采用同一份模型配置。
