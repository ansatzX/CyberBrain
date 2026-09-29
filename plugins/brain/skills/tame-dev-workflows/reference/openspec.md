# OpenSpec：源码地图（内部参考）

## 当前快照与生成边界

- npm 实现位于 `.brain/vendor/_tools/openspec-npm/node_modules/@fission-ai/openspec/{dist,schemas}`，包版本 **1.13.1**，Node 要求 `>=20.19.0`，CLI bin 为 `bin/openspec.js`。
- active `.brain/vendor/openspec/.agents/skills/` 只生成 6 个 skill：`explore`、`propose`、`apply-change`、`update-change`、`sync-specs`、`archive-change`；frontmatter 的 `generatedBy` 为 `1.13.1`。
- 包内 `dist/core/shared/skill-generation.js` 另外列出 `new`、`continue`、`ff`、`bulk-archive`、`verify`、`onboard` 六个 workflow，所以可生成的 workflow 是 12 个；它们不等于 active vendor 已安装的 skill。`getFeedbackSkillTemplate()` 另提供 feedback 模板，也不在这 6 个生成物中。

## 已生成 6 个 skill

- `openspec-explore`：只读探索和澄清；可读代码、配置和 specs；若要捕获已确认的 change artifact，先声明文件范围并取得确认；不实现代码。
- `openspec-propose`：创建 change 并按 schema/artifact graph 生成 proposal、delta specs、design、tasks；完成规划后停止，不顺手改代码。
- `openspec-apply-change`：通过 `status`/`instructions` 读取 schema、上下文文件和 tasks，逐项实现并更新 task 状态；缺 artifact 时回到规划边界。
- `openspec-update-change`：只修订既有 planning artifacts，按 `existingOutputPaths` 保持一致；CLI `update` 刷新生成文件是另一条路径。
- `openspec-sync-specs`：把 delta spec 的 ADDED/MODIFIED/REMOVED/RENAMED 合并到主 `openspec/specs/**/spec.md`，再 `validate --specs`；不移动 change。
- `openspec-archive-change`：检查 artifact/task 状态，处理 delta spec 的同步选择，随后把 change 移到日期目录；不完整项可警告并在确认后继续，delta 同步也可以选择跳过，不能当成必然硬闸门。

## CLI、状态与 schema

```text
context/list(root/store) -> new change -> status -> instructions(artifact)
      -> proposal/specs/design/tasks -> apply -> validate -> sync/archive
```

- 生成 skill 的 `allowed-tools: Bash(openspec:*)` 是文件中的协作契约；宿主是否强制执行需另验，不能把 frontmatter 当成宿主权限系统。
- `context --json` 提供已解析 root 与 working set；`list --json` 提供清单及 root 信息；`status`/`instructions` 按所选 change、artifact 和操作提供 schema、状态、planning/artifact 路径与依赖信息。不能假定每条命令都返回 `planningHome`、`changeRoot`、`artifactPaths` 全集。选择 standalone store 后，支持的后续命令持续带 `--store`。
- 默认 `schemas/spec-driven/schema.yaml` 定义 proposal/specs/design/tasks 及 requires/apply 边；项目 schema 可改变 artifact id、路径和依赖，不能把四个文件名当成所有 schema 的硬编码接口。
- 项目状态位于 `openspec/`：`changes/<name>/`、`specs/`、`changes/archive/`、`config.yaml`；store 注册表和 `config` pointer 可把 root 指到外部 store。
- `dist` 的 artifact graph、status/instructions、delta merger、validator、root/store resolver 和 archive 实现是 skill 依赖的操作层；skills 主要承载协作协议和确认边界。

## 包内额外能力

- `new` 创建 change，`continue` 按 graph 生成下一个 ready artifact，`ff` 连续生成规划 artifacts；`bulk-archive` 批量归档并报告 ready/skipped/failed；`verify` 对照实现与 artifacts 输出 findings；`onboard` 演示完整流程。
- `verify` 是 workflow ID，生成的 skill 目录/名称为 `openspec-verify-change`（映射见 `dist/core/shared/skill-generation.js`）；不能据此推断存在名为 `openspec-verify` 的 skill。该流程的文件搜索与人工推断不能替代真实运行验证。
- `feedback` 模板要求先匿名化并展示草稿、取得用户确认；`dist/commands/feedback.js` 通过 `gh` 向 `Fission-AI/OpenSpec` 提交，缺少 CLI/认证或失败时给手工 issue URL。它是包内可用能力，不是当前 6-skill vendor 的生成物。

## 裁剪边界

- `propose/update` 与 Superpowers/Spec Kit 规划组件相邻；`apply` 与 SDD 执行相邻；`sync` 与 `archive` 都能触及主 specs，但 archive 还移动 change。
- 裁剪时把 artifact graph、root/store 解析、delta 合并、验证和归档移动视为不同责任单元；本图只说明可组合部件，不替用户选择 OpenSpec 流程。
- 以上只检查本地 1.13.1 `dist`、`schemas` 和 active 生成物；未运行 CLI、未写 `openspec/`、未提交 feedback，也未验证宿主加载行为。
