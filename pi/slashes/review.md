---
name: review
description: 双轴代码审查（规范轴 + 规格轴），两轴分离输出不合并
scope: once
---
对当前代码变更做双轴审查。两轴输出**分离**（`## Standards` / `## Spec` 两个标题），不合并、不重排、不跨轴打分；结尾一行总结：每轴发现数 + 每轴最严重项。

## 准备

- 固定点：命令参数（commit SHA / branch / tag / `HEAD~N`）；无参数时审查未提交改动（`git diff HEAD` + `git diff --cached`）
- 跑 `git diff <固定点>...HEAD`（三点，对 merge-base 比较）+ `git log <固定点>..HEAD --oneline`
- 先验证 ref 能解析（`git rev-parse`）、diff 非空——bad ref 或空 diff 直接失败报告，不要硬审

## Standards 轴（规范）

规范来源：仓库 `AGENTS.md`、`CODING_STANDARDS.md`、`CONTRIBUTING.md` 等文档化标准。仓库文档优先于基线；工具已强制的不报。

基线 smell（Fowler，每条都是判断项，标注"可能"而非硬违规）：

- **Mysterious Name** — 名字不揭示作用 → 改名；改不出诚实名字说明设计浑浊
- **Duplicated Code** — 相同逻辑形状在多个 hunk/文件出现 → 提取共享形状
- **Feature Envy** — 方法访问他者数据多于自身 → 移到数据所在处
- **Data Clumps** — 同组字段/参数总一起出现 → 捆成类型
- **Primitive Obsession** — 原始类型代替领域概念 → 建小类型
- **Repeated Switches** — 对同类型的 switch/if 级联反复出现 → 多态或共享 map
- **Shotgun Surgery** — 一个逻辑改动散落多文件 → 聚合到一个模块
- **Divergent Change** — 一个文件因多个无关原因被改 → 拆分
- **Speculative Generality** — 为规格不需要的需求加抽象 → 删掉
- **Message Chains** — 长 `a.b().c()` 链 → 首个对象上藏方法
- **Middle Man** — 只做转发的类/函数 → 砍掉直连
- **Refused Bequest** — 子类忽略/重写大部分继承 → 换组合

报告：逐文件/逐 hunk —— (a) 违反文档规范处：引用规范出处（文件 + 条款）；(b) 基线 smell：点名 + 引 hunk。区分硬违规与判断项。400 词内。

## Spec 轴（规格）

规格来源依次找：① commit message 里的 issue 引用（`#123`、`Closes #45`）→ ② 命令参数中给的路径 → ③ `docs/`、`specs/`、`.scratch/` 下与分支/特性匹配的文件 → ④ 都没有则注明"无规格可用"并跳过本轴（在总结里说明）。

报告：(a) 规格要求但缺失/只做了一半的；(b) diff 中没被要求的行为（scope creep）；(c) 看似实现但实现有误的。每条引用规格原文。400 词内。
