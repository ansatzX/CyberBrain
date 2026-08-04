# Cyberbrain Pi Support Design

日期：2026-08-04
状态：设计已逐节批准，待用户审阅书面规格

## 目标

将 Cyberbrain 从“Codex-only plugin marketplace”升级为个人 Agent 配置的唯一事实源：Codex 与 pi 是并列宿主适配层。现有 Codex marketplace 与 installer 保持可用；新增 pi package、迁移安装器、provider 适配与个性化扩展管理。

## 仓库架构

```text
Cyberbrain/
├── .agents/plugins/marketplace.json
├── plugins/                              # Codex 插件 + 共享 skills
│   ├── brain/
│   ├── tachikoma/
│   └── awesome-agent-select/
├── pi/                                   # cyberbrain-pi package
│   ├── package.json
│   ├── README.md
│   ├── extensions/
│   │   ├── goal.ts
│   │   ├── slash-framework.ts
│   │   ├── utility-commands.ts
│   │   └── third-party-all-in-one.ts
│   ├── lib/
│   │   ├── goal-core.ts
│   │   ├── slash-core.ts
│   │   └── third-party/
│   │       ├── aihubmix.ts
│   │       └── deepseek-responses.ts
│   ├── slashes/
│   │   ├── python.md
│   │   └── review.md
│   ├── skills/
│   │   └── pi-extension-dev/
│   └── test/
├── tools/
│   ├── manage-pi.sh
│   └── awesome-agent-select-codex-agents.sh
├── README.md
├── PI_SUPPORT.md
└── CODEX_PLUGIN_SYSTEM.md
```

首期不把现有 Codex 目录重排为 `hosts/codex`；`pi/` 是独立增量适配层。未来只有出现真实共享实现时才抽取 `shared/`，不预建空洞抽象。

## Pi Package

单一 package：`cyberbrain-pi`。

```json
{
  "name": "cyberbrain-pi",
  "private": true,
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions/*.ts"],
    "skills": [
      "./skills",
      "../plugins/brain/skills",
      "../plugins/tachikoma/skills",
      "../plugins/awesome-agent-select/skills"
    ]
  }
}
```

Cyberbrain 本地 clone 是事实源。安装器执行：

```bash
pi install /absolute/path/to/Cyberbrain/pi
```

pi 的 local package loader 会将 manifest 条目相对于 package root 解析；在本地完整 clone 模式下允许 `../plugins/...`，使 Codex 与 pi 共用同一份 SKILL.md，不复制、不生成镜像。

该设计不支持把 `pi/` 子目录单独发布为自包含 npm 包；若未来需要发布，必须重新设计资源边界。

## 资源所有权

Cyberbrain 管理：

- 自有 pi extensions、lib 与测试；
- 内置 slash prompt；
- `pi-extension-dev` skill；
- AIHubMix 与 DeepSeek Responses provider；
- DeepSeek hosted web-search hook；
- 安装、迁移、doctor、卸载脚本；
- 现有 `plugins/*/skills` 的 pi 加载入口。

Cyberbrain 不管理：

- `~/.pi/agent/auth.json`；
- API key；
- sessions、cache、goals 等运行时数据；
- theme、thinking、defaultProvider/defaultModel、enabledModels 等用户偏好；
- Superpowers、Lark 等第三方资源；
- home 中用户自行添加的 slash override。

Cyberbrain 不合并或覆盖 `settings.json`、`models.json`。安装 package 时由 `pi install` 自己维护 package 设置。DeepSeek Responses 从 `models.json` 迁移为 package 内 provider extension，API key 继续读取 `DEEPSEEK_API_KEY`。

## Third-Party All-in-One Extension

`third-party-all-in-one` 是统一 extension 入口，不是 provider 名称。运行时 provider ID 保持：

```text
aihubmix/...
deepseek-responses/...
```

内部职责：

```text
third-party-all-in-one
├── AIHubMix provider adapter
└── DeepSeek Responses provider adapter
    └── hosted web_search
```

DeepSeek hosted web-search：

- 默认启用；
- 仅修改 `provider === "deepseek-responses"` 的 Responses payload；
- 不影响 AIHubMix 或其他 provider；
- 通过 `CYBERBRAIN_DEEPSEEK_WEB_SEARCH=0` 关闭；
- 注入标准 `{ "type": "web_search" }`，不添加未经验证的 provider 私有字段；
- pi 当前不单独渲染 `web_search_call`，功能依赖 provider 最终文本输出。

AIHubMix 保留 fresh-cache-first、原子 cache、secret redaction 和降级逻辑。

## Shared Skills

pi package 暴露现有全部 Cyberbrain skills：

- Brain 全部 skills，包括 `codex-compatible`；
- Tachikoma 全部 CLI skills；
- `awesome-agent-select/team-leader`。

技能正文继续位于现有 `plugins/*/skills`，Codex 与 pi 使用同一份文件。pi 只会常驻技能 metadata，全文按需读取。遇到宿主不匹配能力（例如 Codex 专属 sandbox 或 pi 无原生 MAS）时，技能必须报告能力边界，不得伪造工具。

## Slash 加载与覆盖

Cyberbrain 默认 slash：

```text
Cyberbrain/pi/slashes/*.md
```

机器本地 override：

```text
~/.pi/agent/slashes/*.md
```

加载规则：

1. 加载 package 默认；
2. 加载 home override；
3. 相同 `namespace:name` 时 home 覆盖 package；
4. 启动时输出一次 override warning；
5. installer 迁移当前 `python.md`、`review.md` 后删除 home 副本，因此正常状态使用仓库默认。

格式：

```yaml
---
name: review
namespace: ansatz
description: 双轴代码审查
scope: once
---
Prompt body...
```

- 默认 namespace：`ansatz`；
- 默认 scope：`once`；
- `once` 在一次 agent run 后自动退出；
- `session` 保持到 `/ansatz:name off` 或 `/ansatz:mode off`；
- prompt 只由 `before_agent_start` 注入一次；命令参数只作为用户任务消息发送。

不改用 pi 原生 prompt templates，因为当前框架需要 system prompt 注入、once/session 生命周期、home override 与 hook 行为。

## Installer

入口：

```bash
bash tools/manage-pi.sh install [--dry-run]
bash tools/manage-pi.sh update [--dry-run]
bash tools/manage-pi.sh doctor
bash tools/manage-pi.sh uninstall [--dry-run] [--restore-legacy]
```

### install

1. 定位仓库根和 `pi/` package；
2. 检查 pi CLI；
3. 检测 `~/.pi/agent` 中当前散落的 Cyberbrain 自有文件；
4. 只接管与 package 相同或属于已知旧版本的文件；未知内容冲突则停止；
5. 备份到 `~/.pi/agent/backups/cyberbrain-pi/<timestamp>/`；
6. 删除已接管旧文件，避免重复扩展和命令 `:1/:2`；
7. 执行 `pi install <repo>/pi`；
8. 写 `~/.pi/agent/.cyberbrain-pi.manifest.json`。

manifest 记录：clone 路径、package source、安装时间、installer 版本、迁移文件和备份目录。

### update

- 检查 package source 仍指向当前 clone；
- 再次迁移新出现的已知旧文件；
- reconcile/update local package；
- 不执行 `git pull`；
- 不修改 home slash override。

### doctor

只读检查：pi CLI、package 注册、clone 路径、manifest、资源发现、重复旧扩展、provider 环境变量、provider 注册、语法/测试 smoke、home slash 覆盖。

### uninstall

- `pi remove <repo>/pi`；
- 删除 installer manifest；
- 不删除 goals、sessions、cache；
- 不恢复旧散落文件，除非 `--restore-legacy`。

所有修改型命令支持 `--dry-run`。installer 不碰 `auth.json`，不读取、复制或记录 API key，不覆盖未知文件；先备份后删除。

## 首次迁移范围

迁移当前 Cyberbrain 自有资源：

```text
~/.pi/agent/extensions/
  aihubmix.ts
  codex-slash.ts
  goal.ts
  slash-framework.ts
  web-search.ts
~/.pi/agent/lib/
  goal-core.ts
  goal-core.test.ts
  slash-core.ts
  slash-core.test.ts
  web-search-core.ts
  web-search-core.test.ts
~/.pi/agent/slashes/
  python.md
  review.md
~/.pi/agent/skills/pi-extension-dev/
```

`superpowers.ts` symlink和其他第三方资源不迁移、不删除。

旧资源先备份。uninstall 默认不恢复旧版本；`--restore-legacy` 才恢复。

## 测试

### 单元测试

```text
pi/test/
├── goal-core.test.ts
├── slash-core.test.ts
└── third-party-all-in-one.test.ts
```

覆盖：goal JSON/旧格式迁移/状态机/按 turn blocked audit/pause-resume；slash 解析/scope/override；AIHubMix cache；DeepSeek provider；web-search 默认开启与关闭。

### Installer 测试

临时 HOME + fake pi，覆盖：install、重复安装、未知冲突、备份迁移、doctor、uninstall、restore、dry-run 零写入。

### Pi 集成 smoke

验证 local package install/remove、无重复命令后缀、provider 注册、全部 shared skills 发现、package slash + home override、goal 生命周期。

## 跨平台

- package/extensions：macOS、Linux、Windows；
- POSIX installer：首版正式支持 macOS/Linux；
- Windows 可直接 `pi install <repo>/pi`，自动迁移 installer 暂不承诺；后续可补 PowerShell。

## 文档边界

- 根 README：Cyberbrain 是个人 Agent 配置总仓库；分别提供 Codex/pi 安装入口；
- 根 AGENTS.md：定义共享层与 host adapter 边界；
- CODEX_PLUGIN_SYSTEM.md：仅描述 Codex adapter，不再定义整个仓库；
- 新增 PI_SUPPORT.md；
- 新增 pi/README.md。

Codex 专属文件使用 `~/.codex` 和 Codex 工具名；pi 专属文件使用 `~/.pi/agent` 和 pi API。host adapter 不互相翻译、复制实现。

## 成功标准

- Cyberbrain clone 是所有自有 pi 配置的唯一事实源；
- clean `~/.pi/agent` 可一条 install 命令启用；
- 现有机器可无损迁移；
- Codex marketplace 与 agent installer 不回归；
- pi package 不管理用户偏好和凭据；
- package 默认 slash 可被 home override；
- 全部现有 Cyberbrain skills 可被 pi 发现；
- 所有测试、doctor 与集成 smoke 通过。
