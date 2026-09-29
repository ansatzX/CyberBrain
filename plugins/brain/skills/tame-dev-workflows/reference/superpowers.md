# Superpowers：源码地图（内部参考）

## 当前快照

- 本图以 `.brain/vendor/superpowers` 为源码根；active vendor 是 **6.4.1**，`.codex-plugin/plugin.json` 和 `package.json` 都声明该版本。
- Codex manifest 暴露 `./skills/`，且 `hooks` 明确为 `{}`。快照仍有 `hooks/session-start` 等文件，但不能据此说 Codex 已加载 hook；脚本里的多宿主分支也不是 Brain 的路由实现。
- 当前有 15 个 `skills/*/SKILL.md`；以下来自本地源码阅读，未执行上游工作流。

## 组件地图

- `using-superpowers`：会话起点的技能选择和优先级；按宿主读取相应 `references/*-tools.md`。
- `brainstorming`：澄清意图、约束和成功标准；架构路径写 `docs/superpowers/specs/YYYY-MM-DD-*-design.md`，有界任务可停在对话设计；视觉伴侣是可选 server。
- `writing-plans`：把 spec/需求拆成可测试任务，写 `docs/superpowers/plans/YYYY-MM-DD-*.md`。
- `test-driven-development`：实现前的红—绿—重构循环；测试写作细节在 `writing-good-tests.md`。
- `systematic-debugging`：从症状到根因；按需读取 tracing/defense/waiting 参考和 `find-polluter.sh`。
- `using-git-worktrees`：按宿主能力隔离工作树和项目初始化状态。
- `subagent-driven-development`：按计划派实现者和 reviewer；在 `.superpowers/sdd/<plan>/` 保存 brief、report、review、`progress.md`。
- `executing-plans`：当前会话内执行计划；沿用同一 ledger，末尾生成全分支 review package；有子代理能力时派 reviewer，无子代理时按文档自行 self-review。
- `dispatching-parallel-agents`：只并行调度互不共享状态的独立任务。
- `requesting-code-review` / `receiving-code-review`：审查请求和逐项回应的双向接口。
- `verification-before-completion`：用新鲜命令证据支撑完成/通过声明。
- `finishing-a-development-branch`：测试后处理合并、PR、保留或清理等收尾选择。
- `diagnosing-superpowers`：从 transcript 取证，按维度生成 case/report；可选 issue/bundle，写入 `~/.superpowers/diagnosing-superpowers/`。
- `writing-skills`：以压力场景驱动技能的创建、修改和验证。

## 连接与裁剪

```text
using-superpowers -> brainstorming -> writing-plans
                               -> subagent-driven-development | executing-plans
                               -> TDD / debugging / review -> verification -> finishing
```

- SDD 和 inline execution 都把计划、任务 brief、测试和 review 记录到 `.superpowers/sdd/`；前者有逐任务实现/review，后者自行执行并做一次全分支 review。
- `requesting-code-review` 和 SDD 依赖 git SHA、计划/工作树及 reviewer；`executing-plans` 在有子代理时派全分支 reviewer，否则自行 self-review。`finishing` 依赖项目自身测试命令；brainstorming 的 server、diagnosing 的 transcript/home 读取属于额外 I/O。
- 需求澄清/计划、执行、TDD/debugging、验证和 review 分别与 Spec Kit/OpenSpec 的相邻组件重叠；文件格式、状态路径和批准边界不同，后续组合时需保留这些差异。
- 可独立取出的组件包括 SDD 的 prompts/scripts、diagnosing 的 prompts/templates、debugging 的 references 和 brainstorming server；它们都带有具体状态或宿主路径。

## 支撑文件与边界

- SDD 的实现/审查 prompts 和 `subagent-driven-development/scripts/{sdd-workspace,task-brief,review-package}`，inline execution 的 `executing-plans/scripts/{task-start,task-done}`，以及各 review prompt 是主要可移植部件。
- 这些脚本不是通用 tasks 接口：`task-brief` 按 `Task N` 数字标题提取任务，`task-done` 会向 workspace 的 `progress.md` 写完成记录。接入 Spec Kit 的 `T001` 任务和单一完成状态，必须配套适配任务格式、revision、恢复和清理逻辑，不能仅修改 `SKILL.md`。
- `using-superpowers/references/codex-tools.md` 才是 Codex 工具路径证据；其他宿主 references 不能证明本仓库支持那些宿主。
- 裁剪时保留所选组件的输入、停止条件、持久化路径和验证出口；本地图只说明连接关系，不替用户选择开发哲学。
