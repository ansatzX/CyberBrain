# Spec Kit：源码地图（内部参考）

## 当前快照

- 本图以 `.brain/vendor/spec-kit` 为源码根；active 快照是 **1.0.8**，初始化为 Codex integration、`--skills`；`.agents/skills/` 当前有 10 个核心 skill。
- `.specify/workflows/workflow-registry.json` 记录 bundled `speckit` workflow **1.0.1**：`specify → plan → tasks → implement`，中间有两个 review gate。
- 以下基于 active skill、脚本、模板和 workflow 源码，未执行开发工作流。

## 10 个核心 skill

- `speckit-specify`：自然语言需求 → `specs/<feature>/spec.md`，按编号策略写 `.specify/feature.json`。
- `speckit-clarify`：读取当前 spec，最多问 5 个定向问题，把答案增量写回 spec。
- `speckit-constitution`：按解析后的 constitution template 交互式覆盖 `.specify/memory/constitution.md`，不改模板源。
- `speckit-plan`：读取 spec/constitution；写 `plan.md`、`research.md`、`data-model.md`、`quickstart.md` 和可选 `contracts/`。
- `speckit-tasks`：读取 plan/spec 等设计文档；按 user story 和依赖生成 `tasks.md`。
- `speckit-implement`：逐项执行并勾选 tasks，按项目实际情况写代码、测试和忽略文件。
- `speckit-analyze`：分析正文不修改 spec/plan/tasks，检查一致性、覆盖和 constitution 冲突；前置解析和 hooks 不保证零写入（见下）。
- `speckit-converge`：对照现有代码和三件套，仅向 `tasks.md` 追加 `Phase N: Convergence`；无缺口时不写。
- `speckit-checklist`：生成 reviewer-owned 的需求质量 checklist；`[x]` 表示需求质量已审，不表示实现完成。
- `speckit-taskstoissues`：把 tasks 转成 GitHub issues；先读取 `git config --get remote.origin.url`，仅对 GitHub remote 继续，用 GitHub MCP `list_issues`（含 open/closed，游标分页）按 `T\d{3,}` 去重，再通过 GitHub MCP 创建 issue，标题为 `T001: ...`；该 skill 没有 `gh` fallback。

## 状态、脚本与模板

```text
constitution (可先行)
  -> specify -> clarify(可选) -> plan -> tasks -> implement
                              -> analyze / converge / checklist / taskstoissues
```

- `.specify/` 是实例状态：`init-options.json`、`integration.json`、`feature.json`、`memory/constitution.md`、模板和 workflow registry；feature 文档在 `specs/<feature>/`。
- `common.sh:get_feature_paths` 先取 `SPECIFY_FEATURE_DIRECTORY`，否则读 `.specify/feature.json` 的 `feature_directory`；没有这两者就报错，不按 git 分支猜目录。`CURRENT_BRANCH` 只是显式 `SPECIFY_FEATURE` 或 feature 目录 basename 的输出字段。
- `check-prerequisites.sh` 输出 feature/doc 路径；`create-new-feature.sh` 建目录、spec 和 feature state；`setup-plan.sh`、`setup-tasks.sh` 解析模板并输出 JSON；`resolve-template.sh` 依次考虑 project override、preset、extension、core。
- 各 skill 文本包含对 `.specify/extensions.yml` 的 before/after hook 处理说明；这属于上游 skill 指令，宿主是否执行不由 frontmatter 或 Markdown 自动强制。
- `analyze` 调用 `check-prerequisites.sh --json --require-tasks --include-tasks`；设置 `SPECIFY_FEATURE_DIRECTORY` 时，普通 `get_feature_paths` 可持久化 `.specify/feature.json`。mandatory hooks 还要求实际执行命令，副作用取决于 hook。`--paths-only` 虽使用 `--no-persist`，但也跳过前置验证，不能直接替换原调用来宣称安全只读。
- 五个主要模板是 `spec`、`plan`、`tasks`、`checklist`、`constitution`；override/preset/extension 层可改变最终内容，故模板不能当成固定接口。

## 组合边界

- `specify/clarify/plan/tasks` 与 Superpowers 的 brainstorming/plans、OpenSpec 的 propose/update 都处理规划，但中心状态和批准边界不同。
- `analyze` 的主产物是只读分析报告，`converge` 的主操作是 append-only 补任务；两者的前置解析和 hooks 要单独检查。`checklist` 和 `taskstoissues` 是面向 reviewer/协作系统的旁路输出。
- 裁剪时同时保留 `spec.md`、`plan.md`、`tasks.md`、constitution、脚本路径和 hook 写入边界；本图只提供功能地图，不替用户指定 SDD 纪律。
