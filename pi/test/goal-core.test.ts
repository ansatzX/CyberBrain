import { test } from "node:test";
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import goalExtension, { goalSetObjective, shouldQueueGoalContinuation } from "../extensions/goal.ts";
import { goalFilePath, getSessionThreadId, loadGoal, saveGoal, createGoal, archiveGoal, updateGoalStatus, registerBlockedOccurrence, objectiveUpdatedPrompt, continuationPrompt, toolGetGoal, toolCreateGoal, toolUpdateGoal, shouldContinue, pauseGoal, resumeGoal, isSameBlockedCondition, DEFAULT_TURN_BUDGET, DEFAULT_IDLE_BUDGET, DEFAULT_ERROR_BUDGET, type GoalState } from "../lib/goal-core.ts";

// 用环境变量覆盖存储目录，避免污染真实 ~/.pi/agent/goals
process.env.PI_GOAL_TEST_DIR = mkdtempSync(join(tmpdir(), "goal-test-"));

test("createGoal 写入文件并可读回", () => {
	const g = createGoal("thread-1", "完成重构");
	assert.equal(g.status, "active");
	const loaded = loadGoal("thread-1");
	assert.ok(loaded);
	assert.equal(loaded.objective, "完成重构");
	assert.equal(loaded.blocked_streak, 0);
});

test("createGoal 已有 active 时抛错", () => {
	assert.throws(() => createGoal("thread-1", "第二个目标"));
});

test("archiveGoal 置 abandoned", () => {
	const g = archiveGoal("thread-1", "不需要了");
	assert.ok(g);
	assert.equal(g.status, "abandoned");
	assert.equal(loadGoal("thread-1")?.status, "abandoned");
});

test("archiveGoal 无目标时返回 null", () => {
	assert.equal(archiveGoal("thread-404", "x"), null);
});

test("saveGoal 以 JSON 可逆保存任意字符串", () => {
	const g: GoalState = {
		thread_id: "thread-2", goal_id: "g-2", objective: "多行\n目标: \\n literal",
		status: "blocked", created_at: "2026-08-03T00:00:00Z", updated_at: "2026-08-03T01:00:00Z",
		blocked_streak: 2, blocked_condition: "网络:\n不可用", last_blocked_turn_id: "turn-2", status_reason: null,
		turn_count: 4, idle_streak: 1, error_streak: 2,
	};
	saveGoal(g);
	const loaded = loadGoal("thread-2");
	assert.deepEqual(loaded, g);
	assert.match(readFileSync(goalFilePath("thread-2"), "utf8"), /^\{/);
});

// 旧 goal 文件没有预算字段，加入预算后必须仍能加载——否则升级会静默丢失在跑的目标。
test("旧 goal 文件缺少预算字段仍可加载并回填", () => {
	const legacy = {
		thread_id: "thread-legacy-budget", goal_id: "g-legacy", objective: "旧目标",
		status: "active", created_at: "2026-08-03T00:00:00Z", updated_at: "2026-08-03T00:00:00Z",
		blocked_streak: 0, blocked_condition: null, last_blocked_turn_id: null, status_reason: null,
	};
	writeFileSync(goalFilePath("thread-legacy-budget"), `${JSON.stringify(legacy, null, 2)}\n`);
	const loaded = loadGoal("thread-legacy-budget");
	assert.equal(loaded?.objective, "旧目标", "旧文件不得被当作非法状态丢弃");
	assert.equal(loaded?.turn_count, 0);
	assert.equal(loaded?.idle_streak, 0);
});

test("loadGoal 自动迁移旧 md 状态到 JSON", () => {
	const threadId = "legacy-thread";
	const legacyPath = goalFilePath(threadId).replace(/\.json$/, ".md");
	writeFileSync(legacyPath, `---\nthread_id: ${threadId}\ngoal_id: legacy-goal\nstatus: complete\ncreated_at: 2026-08-03T00:00:00Z\nupdated_at: 2026-08-03T01:00:00Z\nblocked_streak: 1\nblocked_condition: old block\ncomplete_reason: migrated\nobjective: old\\nobjective\n---\n`);
	const goal = loadGoal(threadId);
	assert.ok(goal);
	assert.equal(goal.objective, "old\nobjective");
	assert.equal(goal.status_reason, "migrated");
	assert.equal(existsSync(legacyPath), false);
	assert.equal(existsSync(goalFilePath(threadId)), true);
});

test("goalFilePath 按 threadId 哈希隔离并使用 JSON", () => {
	const p1 = goalFilePath("a");
	const p2 = goalFilePath("b");
	assert.notEqual(p1, p2);
	assert.ok(p1.endsWith(".json"));
});

// ---------- Task 2: 状态机校验 ----------

test("updateGoalStatus complete 需 reason", () => {
	createGoal("thread-c1", "目标");
	const r = updateGoalStatus("thread-c1", "complete", "", "turn-1");
	assert.equal(r.ok, false);
	if (!r.ok) assert.match(r.error, /reason/i);
});

test("updateGoalStatus complete 通过并记录 reason", () => {
	const r = updateGoalStatus("thread-c1", "complete", "全部测试通过", "turn-2");
	assert.equal(r.ok, true);
	if (r.ok) {
		assert.equal(r.goal.status, "complete");
		assert.equal(r.goal.status_reason, "全部测试通过");
	}
});

test("updateGoalStatus blocked 需 streak >= 3", () => {
	createGoal("thread-c2", "目标");
	const r1 = updateGoalStatus("thread-c2", "blocked", "网络断", "turn-0");
	assert.equal(r1.ok, false);
	if (!r1.ok) assert.match(r1.error, /3/);
});

test("updateGoalStatus blocked streak 累积", () => {
	registerBlockedOccurrence("thread-c2", "turn-1", "网络断");
	registerBlockedOccurrence("thread-c2", "turn-2", "网络断");
	const r = updateGoalStatus("thread-c2", "blocked", "网络断", "turn-3");
	assert.equal(r.ok, true);
	if (r.ok) assert.equal(r.goal.status, "blocked");
});

test("同一个 turn 只能计一次 blocked，跨 turn 才累积", () => {
	createGoal("thread-c4", "目标");
	registerBlockedOccurrence("thread-c4", "turn-1", "网络断了");
	registerBlockedOccurrence("thread-c4", "turn-1", "权限不足");
	registerBlockedOccurrence("thread-c4", "turn-2", "网络断了");
	const g = loadGoal("thread-c4");
	assert.ok(g);
	assert.equal(g.blocked_streak, 2);
	assert.equal(g.last_blocked_turn_id, "turn-2");
});

test("不同 blocked condition 开始新的 audit", () => {
	createGoal("thread-c5", "目标");
	registerBlockedOccurrence("thread-c5", "turn-1", "网络断了");
	registerBlockedOccurrence("thread-c5", "turn-2", "权限不足");
	const g = loadGoal("thread-c5");
	assert.ok(g);
	assert.equal(g.blocked_streak, 1);
	assert.equal(g.blocked_condition, "权限不足");
	assert.equal(g.last_blocked_turn_id, "turn-2");
});

test("相同 blocked condition 可跨后续 turn 累积", () => {
	createGoal("thread-c6", "目标");
	registerBlockedOccurrence("thread-c6", "turn-1", "等待 owner 授权");
	registerBlockedOccurrence("thread-c6", "turn-3", "等待  owner\n授权");
	const g = loadGoal("thread-c6");
	assert.ok(g);
	assert.equal(g.blocked_streak, 2);
	assert.equal(g.blocked_condition, "等待 owner 授权");
});

test("blocked goal 仍未完成，createGoal 必须拒绝覆盖", () => {
	createGoal("thread-c3", "新目标");
	registerBlockedOccurrence("thread-c3", "turn-1", "x");
	registerBlockedOccurrence("thread-c3", "turn-2", "x");
	updateGoalStatus("thread-c3", "blocked", "x", "turn-3");
	assert.throws(() => createGoal("thread-c3", "重建目标"), /unfinished goal/);
});

// ---------- Task 3: 注入文本 ----------

test("objectiveUpdatedPrompt 包含目标且不引用文件路径", () => {
	const g = loadGoal("thread-1");
	assert.ok(g);
	const p = objectiveUpdatedPrompt(g);
	assert.match(p, /完成重构/);
	assert.ok(!p.includes("write 工具")); // v2 模型不写文件
	assert.ok(!p.includes("goals.md"));
});

test("continuationPrompt 包含行为规范", () => {
	const g = loadGoal("thread-c1");
	assert.ok(g);
	const p = continuationPrompt(g);
	assert.match(p, /目标/);
	assert.match(p, /update_goal/);
	assert.match(p, /blocked/);
	assert.ok(!p.includes("Progress")); // v2 无步骤列表
});

test("goal continuation 仅对未排队的 active goal 允许", () => {
	const active: GoalState = {
		thread_id: "t", goal_id: "g", objective: "目标", status: "active",
		created_at: "", updated_at: "", blocked_streak: 0, blocked_condition: null,
		last_blocked_turn_id: null, status_reason: null,
	};
	assert.equal(shouldQueueGoalContinuation(active, false), true);
	assert.equal(shouldQueueGoalContinuation(active, true), false);
	assert.equal(shouldQueueGoalContinuation({ ...active, status: "blocked" }, false), false);
	assert.equal(shouldQueueGoalContinuation(null, false), false);
});

test("agent_settled 为 active goal 排入一次后续工作并在下一 run 后允许再排", async () => {
	const handlers = new Map<string, (event: unknown, ctx: any) => Promise<void>>();
	const sent: Array<{ content: string; options: unknown }> = [];
	goalExtension({
		on(event: string, handler: (event: unknown, ctx: any) => Promise<void>) { handlers.set(event, handler); },
		registerCommand() {}, registerTool() {},
		sendUserMessage(content: string, options: unknown) { sent.push({ content, options }); },
	} as any);

	const sessionFile = "/tmp/goal-extension-cycle.jsonl";
	const ctx = { sessionManager: { getSessionFile: () => sessionFile }, ui: { notify() {} }, isIdle: () => true, hasPendingMessages: () => false, abort() {} };
	createGoal(getSessionThreadId(sessionFile), "循环目标");
	await handlers.get("agent_settled")?.({}, ctx);
	await handlers.get("agent_settled")?.({}, ctx);
	await tick();
	assert.equal(sent.length, 1);
	assert.equal(sent[0].options, undefined);
	await handlers.get("agent_start")?.({}, ctx);
	await handlers.get("agent_settled")?.({}, ctx);
	await tick();
	assert.equal(sent.length, 2);
	updateGoalStatus(getSessionThreadId(sessionFile), "complete", "完成", "turn-1");
	await handlers.get("agent_start")?.({}, ctx);
	await handlers.get("agent_settled")?.({}, ctx);
	assert.equal(sent.length, 2);
});

test("agent_settled 不为 paused、blocked 或 abandoned goal 排入后续工作", async () => {
	for (const status of ["paused", "blocked", "abandoned"] as const) {
		const handlers = new Map<string, (event: unknown, ctx: any) => Promise<void>>();
		const sent: string[] = [];
		goalExtension({
			on(event: string, handler: (event: unknown, ctx: any) => Promise<void>) { handlers.set(event, handler); },
			registerCommand() {}, registerTool() {},
			sendUserMessage(content: string) { sent.push(content); },
		} as any);
		const sessionFile = `/tmp/goal-extension-${status}.jsonl`;
		const threadId = getSessionThreadId(sessionFile);
		const goal = createGoal(threadId, `${status} 目标`);
		saveGoal({ ...goal, status });
		const ctx = { sessionManager: { getSessionFile: () => sessionFile }, ui: { notify() {} } };
		await handlers.get("agent_settled")?.({}, ctx);
		assert.equal(sent.length, 0, status);
	}
});

test("goal set 仅接受显式 set 子命令", () => {
	assert.equal(goalSetObjective("set 重构目标"), "重构目标");
	assert.equal(goalSetObjective("SET\t重构目标"), "重构目标");
	assert.equal(goalSetObjective("set"), null);
	assert.equal(goalSetObjective("目标"), null);
	assert.equal(goalSetObjective("setup 目标"), null);
});

// ---------- 工具 handler 纯函数 ----------

test("toolGetGoal 无目标返回提示", () => {
	assert.match(toolGetGoal("thread-tool-404"), /No goal/);
});

test("toolGetGoal 返回状态文本", () => {
	createGoal("thread-tool-1", "工具目标");
	const t = toolGetGoal("thread-tool-1");
	assert.match(t, /工具目标/);
	assert.match(t, /status: active/);
});

test("toolCreateGoal 返回行为要求", () => {
	const t = toolCreateGoal("thread-tool-2", "创建目标");
	assert.match(t, /Goal created: 创建目标/);
	assert.match(t, /update_goal/); // 行为要求随结果返回
});

test("toolCreateGoal 已有 active 返回 error", () => {
	const t = toolCreateGoal("thread-tool-2", "重复创建");
	assert.match(t, /^error:/);
	assert.match(t, /unfinished goal/);
});

test("toolCreateGoal 空 objective 返回 error", () => {
	assert.match(toolCreateGoal("thread-tool-3", "  "), /^error:/);
});

test("toolUpdateGoal blocked 未满 3 轮返回 error 含进度", () => {
	createGoal("thread-tool-4", "目标");
	const t1 = toolUpdateGoal("thread-tool-4", "blocked", "卡住", "turn-1");
	assert.match(t1, /^error:/);
	assert.match(t1, /1\/3/);
	assert.match(t1, /explicitly reported/);
	const t2 = toolUpdateGoal("thread-tool-4", "blocked", "卡住", "turn-2");
	assert.match(t2, /2\/3/);
});

test("toolUpdateGoal blocked 第三轮成功", () => {
	const t = toolUpdateGoal("thread-tool-4", "blocked", "卡住", "turn-3");
	assert.match(t, /^Goal blocked:/);
});

test("toolUpdateGoal complete 成功", () => {
	createGoal("thread-tool-5", "目标");
	const t = toolUpdateGoal("thread-tool-5", "complete", "做完了", "turn-1");
	assert.match(t, /^Goal complete: 做完了/);
});

test("toolUpdateGoal 非法 status 返回 error", () => {
	const t = toolUpdateGoal("thread-tool-5", "paused" as "complete", "x", "turn-2");
	assert.match(t, /^error:/);
});

test("shouldContinue 仅 active 为 true，终态 false", () => {
	createGoal("thread-tool-6", "目标");
	const g = loadGoal("thread-tool-6");
	assert.ok(g);
	assert.equal(shouldContinue(g), true); // active
	const done = { ...g, status: "complete" as const };
	assert.equal(shouldContinue(done), false);
	const blocked = { ...g, status: "blocked" as const };
	assert.equal(shouldContinue(blocked), false);
	const abandoned = { ...g, status: "abandoned" as const };
	assert.equal(shouldContinue(abandoned), false);
});

// ---------- pause / resume ----------

test("pauseGoal active → paused，续跑停止", () => {
	createGoal("thread-p1", "目标");
	const r = pauseGoal("thread-p1");
	assert.equal(r.ok, true);
	if (r.ok) {
		assert.equal(r.goal.status, "paused");
		assert.equal(shouldContinue(r.goal), false);
	}
});

test("pauseGoal 非 active 拒绝", () => {
	const r = pauseGoal("thread-p1"); // 已 paused
	assert.equal(r.ok, false);
	if (!r.ok) assert.match(r.error, /Only active goals/);
});

test("resumeGoal paused → active 且 streak 重置", () => {
	const r = resumeGoal("thread-p1");
	assert.equal(r.ok, true);
	if (r.ok) {
		assert.equal(r.goal.status, "active");
		assert.equal(r.goal.blocked_streak, 0);
		assert.equal(r.goal.blocked_condition, null);
		assert.equal(shouldContinue(r.goal), true);
	}
});

test("resumeGoal 非 paused/blocked 拒绝", () => {
	const r = resumeGoal("thread-p1"); // 已 active
	assert.equal(r.ok, false);
	if (!r.ok) assert.match(r.error, /Only paused or blocked goals/);
});

// blocked 是可恢复的停滞报告，不是结果。外部阻塞解除后必须能直接 resume，
// 否则用户只能 `clear` 丢掉整个 objective、历史与 goal_id 重建。
test("resumeGoal blocked → active 并重置 blocked 审计", () => {
	const thread = "thread-blocked-resume";
	createGoal(thread, "可恢复目标");
	for (const turn of ["t1", "t2", "t3"]) updateGoalStatus(thread, "blocked", "等待外部审批", turn);
	assert.equal(loadGoal(thread)?.status, "blocked");

	const r = resumeGoal(thread);
	assert.equal(r.ok, true);
	if (r.ok) {
		assert.equal(r.goal.status, "active");
		assert.equal(r.goal.objective, "可恢复目标", "objective 必须完整保留");
		// 下一次停滞必须重新积满三轮证据，不能继承已满足的 streak。
		assert.equal(r.goal.blocked_streak, 0);
		assert.equal(r.goal.blocked_condition, null);
		assert.equal(r.goal.last_blocked_turn_id, null);
		assert.equal(r.goal.status_reason, null, "遗留的 blocked 理由不得冒充恢复后的状态说明");
		assert.equal(shouldContinue(r.goal), true, "恢复后必须重新参与续跑");
	}

	// 恢复后再次报阻必须从 1/3 重新计数。
	const retry = updateGoalStatus(thread, "blocked", "等待外部审批", "t4");
	assert.equal(retry.ok, false);
	if (!retry.ok) assert.match(retry.error, /1\/3/);
});

test("resumeGoal 拒绝终态 goal", () => {
	const thread = "thread-terminal-resume";
	createGoal(thread, "终态目标");
	updateGoalStatus(thread, "complete", "已完成", "t1");
	const r = resumeGoal(thread);
	assert.equal(r.ok, false, "complete 是真终态，不得被 resume 复活");

	archiveGoal(thread, "丢弃");
	assert.equal(resumeGoal(thread).ok, false, "abandoned 同样不得复活");
});

test("pause 后 createGoal 拒绝（非终态）", () => {
	pauseGoal("thread-p1");
	assert.throws(() => createGoal("thread-p1", "新目标"));
});

// —— 自动刹车：续跑本身无上限，预算是无人值守时的唯一兑底。
// 用真实事件序列驱动扩展（agent_start → tool_call* → agent_settled），
// 而非直接调 recordContinuationTurn，否则测不到接线是否真的接上了。
function budgetHarness(sessionFile: string) {
	const handlers = new Map<string, (event: unknown, ctx: unknown) => Promise<unknown>>();
	let sent = 0;
	goalExtension({
		on(event: string, handler: (event: unknown, ctx: unknown) => Promise<unknown>) {
			handlers.set(event, handler);
		},
		registerCommand() {},
		registerTool() {},
		sendUserMessage() {
			sent += 1;
		},
	} as never);
	const ctx = { sessionManager: { getSessionFile: () => sessionFile }, ui: { notify() {} }, isIdle: () => true, hasPendingMessages: () => false, abort() {} };
	return {
		get sent() {
			return sent;
		},
		async turn(
			toolNames: string[] = [],
			options: { isError?: boolean; command?: string; stopReason?: string; errorMessage?: string } = {},
		) {
			await handlers.get("agent_start")?.({}, ctx);
			for (const toolName of toolNames) {
				await handlers.get("tool_result")?.(
					{
						toolName,
						input: options.command === undefined ? {} : { command: options.command },
						isError: options.isError ?? false,
					},
					ctx,
				);
			}
			await handlers.get("agent_end")?.(
				{ messages: [{ stopReason: options.stopReason ?? "stop", errorMessage: options.errorMessage }] },
				ctx,
			);
			await handlers.get("agent_settled")?.({}, ctx);
			await tick();
		},
	};
}

test("轮数预算耗尽后自动 pause而非无限续跑", async () => {
	const sessionFile = "/tmp/goal-budget-turns.jsonl";
	const thread = getSessionThreadId(sessionFile);
	const harness = budgetHarness(sessionFile);
	createGoal(thread, "永不自证完成的目标");

	// 模型每轮都在干活（真实写入），但从不调 update_goal——最常见的跑飞形态。
	for (let index = 0; index < 50; index += 1) await harness.turn(["write"]);

	const goal = loadGoal(thread);
	assert.equal(goal?.status, "paused", "超预算必须停下来");
	assert.equal(goal?.turn_count, DEFAULT_TURN_BUDGET);
	assert.match(goal?.status_reason ?? "", /turn budget/);
	assert.ok(harness.sent < 50, `不得无限续跑（实发${harness.sent}条）`);
	// paused 不是终态：objective 与历史必须完整，resume 后重新获得预算。
	assert.equal(goal?.objective, "永不自证完成的目标");
	const resumed = resumeGoal(thread);
	assert.equal(resumed.ok, true);
	if (resumed.ok) assert.equal(resumed.goal.turn_count, 0, "resume 必须重置计数，否则下一轮立即再次跳闸");
});

test("空转预算捕捉无进展的自我审计循环", async () => {
	const previous = process.env.CYBERBRAIN_GOAL_TURN_BUDGET;
	// 抬高轮数预算，否则它会先触发，空转检测就测不到。
	process.env.CYBERBRAIN_GOAL_TURN_BUDGET = "50";
	try {
		const sessionFile = "/tmp/goal-budget-idle.jsonl";
		const thread = getSessionThreadId(sessionFile);
		const harness = budgetHarness(sessionFile);
		createGoal(thread, "空转目标");

		for (let index = 0; index < 20; index += 1) await harness.turn([]);

		const goal = loadGoal(thread);
		assert.equal(goal?.status, "paused");
		assert.equal(goal?.idle_streak, DEFAULT_IDLE_BUDGET);
		assert.match(goal?.status_reason ?? "", /no observable progress/);
	} finally {
		if (previous === undefined) delete process.env.CYBERBRAIN_GOAL_TURN_BUDGET;
		else process.env.CYBERBRAIN_GOAL_TURN_BUDGET = previous;
	}
});

test("干活的目标不被空转预算误伤，自报告工具不算进展", async () => {
	const previous = process.env.CYBERBRAIN_GOAL_TURN_BUDGET;
	process.env.CYBERBRAIN_GOAL_TURN_BUDGET = "50";
	try {
		const working = "/tmp/goal-budget-working.jsonl";
		const workingThread = getSessionThreadId(working);
		const workingHarness = budgetHarness(working);
		createGoal(workingThread, "持续干活");
		// 干活与空转交替：任何一轮真干活都应重置空转计数。
		for (const count of [3, 3, 0, 0, 5, 0, 0]) {
			await workingHarness.turn(Array.from({ length: count }, () => "write"));
		}
		assert.equal(loadGoal(workingThread)?.status, "active", "真在干活的目标不得被停掉");

		// 只查自己不算干活，否则空转预算永远无法触发。
		const selfOnly = "/tmp/goal-budget-self.jsonl";
		const selfThread = getSessionThreadId(selfOnly);
		const selfHarness = budgetHarness(selfOnly);
		createGoal(selfThread, "只审计自己");
		for (let index = 0; index < 10; index += 1) await selfHarness.turn(["get_goal"]);
		assert.equal(loadGoal(selfThread)?.status, "paused", "只调 get_goal 必须仍计为空转");
	} finally {
		if (previous === undefined) delete process.env.CYBERBRAIN_GOAL_TURN_BUDGET;
		else process.env.CYBERBRAIN_GOAL_TURN_BUDGET = previous;
	}
});

// —— blocked 审计：措辞漂移曾使三轮刹车永不生效。
// —— 错误刹车：Pi 只在重试与自动压缩耗尽后才 settle，
// 所以 settled 的错误已是该轮的终态；继续续跑只会在坏状态上循环烧 token。
// 对照 codex-rs/ext/goal/src/extension.rs:293-300 的同类判断。
test("连续错误 turn 耗尽错误预算后自动 pause", async () => {
	const previous = process.env.CYBERBRAIN_GOAL_TURN_BUDGET;
	process.env.CYBERBRAIN_GOAL_TURN_BUDGET = "50";
	try {
		const sessionFile = "/tmp/goal-error-streak.jsonl";
		const thread = getSessionThreadId(sessionFile);
		const harness = budgetHarness(sessionFile);
		createGoal(thread, "会报错的目标");

		for (let index = 0; index < 5; index += 1) {
			await harness.turn([], { stopReason: "error", errorMessage: "context length exceeded" });
		}

		const goal = loadGoal(thread);
		assert.equal(goal?.status, "paused", "连续错误必须停下来，不得无限重试");
		assert.equal(goal?.error_streak, DEFAULT_ERROR_BUDGET);
		assert.match(goal?.status_reason ?? "", /consecutive errored turns/);
		// 错误原文必须保留，否则 resume 的人不知道该修什么。
		assert.match(goal?.status_reason ?? "", /context length exceeded/);
		// 错误诊断优先于“无进展”：错误 turn 同样没有干活，不能被报成空转。
		assert.doesNotMatch(goal?.status_reason ?? "", /no observable progress/);
	} finally {
		if (previous === undefined) delete process.env.CYBERBRAIN_GOAL_TURN_BUDGET;
		else process.env.CYBERBRAIN_GOAL_TURN_BUDGET = previous;
	}
});

test("成功 turn 重置错误计数，偶发错误不停目标", async () => {
	const previous = process.env.CYBERBRAIN_GOAL_TURN_BUDGET;
	process.env.CYBERBRAIN_GOAL_TURN_BUDGET = "50";
	try {
		const sessionFile = "/tmp/goal-error-transient.jsonl";
		const thread = getSessionThreadId(sessionFile);
		const harness = budgetHarness(sessionFile);
		createGoal(thread, "偶发错误的目标");

		// 错误与成功交替：单次瞬时错误值得一次重试，不该终止长任务。
		for (const stopReason of ["error", "stop", "error", "stop", "error", "stop"]) {
			await harness.turn(["write"], {
				stopReason,
				errorMessage: stopReason === "error" ? "transient provider blip" : undefined,
			});
		}

		const goal = loadGoal(thread);
		assert.equal(goal?.status, "active", "偶发错误不得停掉正在推进的目标");
		assert.equal(goal?.error_streak, 0, "一个干净 turn 必须清零错误计数");
	} finally {
		if (previous === undefined) delete process.env.CYBERBRAIN_GOAL_TURN_BUDGET;
		else process.env.CYBERBRAIN_GOAL_TURN_BUDGET = previous;
	}
});

test("aborted 是用户中断，不计作错误", async () => {
	const previous = process.env.CYBERBRAIN_GOAL_TURN_BUDGET;
	process.env.CYBERBRAIN_GOAL_TURN_BUDGET = "50";
	try {
		const sessionFile = "/tmp/goal-error-aborted.jsonl";
		const thread = getSessionThreadId(sessionFile);
		const harness = budgetHarness(sessionFile);
		createGoal(thread, "被中断的目标");

		for (let index = 0; index < 4; index += 1) {
			await harness.turn(["write"], { stopReason: "aborted" });
		}

		const goal = loadGoal(thread);
		assert.equal(goal?.error_streak, 0, "Esc 中断不是坏状态，不得触发错误刹车");
		assert.equal(goal?.status, "paused");
		assert.equal(harness.sent, 0, "Esc must not schedule another run");
	} finally {
		if (previous === undefined) delete process.env.CYBERBRAIN_GOAL_TURN_BUDGET;
		else process.env.CYBERBRAIN_GOAL_TURN_BUDGET = previous;
	}
});

test("同一阻塞的不同措辞仍能累积到三轮", () => {
	const thread = "thread-blocked-paraphrase";
	createGoal(thread, "目标");
	const phrasings = ["等待 API 上线", "还在等 API", "API 仍未就绪"];
	phrasings.forEach((phrase, index) => {
		updateGoalStatus(thread, "blocked", phrase, `turn-${index}`);
	});
	assert.equal(loadGoal(thread)?.status, "blocked", "换着说法描述同一阻塞不得逃逸审计");
	assert.equal(loadGoal(thread)?.blocked_condition, "等待 API 上线", "应保留首次措辞");
});

test("不同阻塞各自重新举证", () => {
	const thread = "thread-blocked-distinct";
	createGoal(thread, "目标");
	["等待 API 上线", "磁盘空间不足", "需要人工审批"].forEach((phrase, index) => {
		updateGoalStatus(thread, "blocked", phrase, `turn-${index}`);
	});
	const goal = loadGoal(thread);
	assert.equal(goal?.status, "active", "三个不同阻塞不得凑满一次审计");
	assert.equal(goal?.blocked_streak, 1);
});

test("isSameBlockedCondition 区分重述与不同阻塞", () => {
	for (const [left, right] of [
		["等待 API 上线", "还在等 API"],
		["等待 API 上线", "API 仍未就绪"],
		["waiting for the API", "API still not live"],
		["waiting for review", "still waiting for review"],
	] as Array<[string, string]>) {
		assert.equal(isSameBlockedCondition(left, right), true, `${left} ≈ ${right}`);
	}
	for (const [left, right] of [
		["等待 API 上线", "磁盘空间不足"],
		["需要人工审批", "磁盘空间不足"],
		["waiting for the API", "disk is full"],
	] as Array<[string, string]>) {
		assert.equal(isSameBlockedCondition(left, right), false, `${left} ≠ ${right}`);
	}
});

// 清理测试目录
rmSync(process.env.PI_GOAL_TEST_DIR as string, { recursive: true, force: true });

// —— 跨进程并发：blocked 审计是 read-modify-write，无锁时会丢更新。
// 阀值是“恰好三次”，一次丢失就会静默移动终态门槛，故用真实多进程验证。
const goalCoreUrl = new URL("../lib/goal-core.ts", import.meta.url).href;

function runNode(source: string, directory: string): string {
	return execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", source], {
		env: { ...process.env, PI_GOAL_TEST_DIR: directory },
		encoding: "utf8",
	}).trim();
}

test("并发进程下 blocked 计数不丢更新", async () => {
	const directory = mkdtempSync(join(tmpdir(), "goal-lock-"));
	try {
		runNode(`const m = await import(${JSON.stringify(goalCoreUrl)}); m.createGoal("shared", "目标");`, directory);

		const writerCount = 5;
		// 必须并行派发：execFileSync 会逐个阻塞等待子进程退出，
		// 那样 load/save 窗口永不交叠，本测试会因为“从未真正并发”而假通过。
		await Promise.all(
			Array.from({ length: writerCount }, (_unused, index) => {
				const source = `import(${JSON.stringify(goalCoreUrl)}).then((m) => m.registerBlockedOccurrence("shared", "turn-${index}", "同一原因"));`;
				return new Promise<void>((resolve, reject) => {
					const child = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", source], {
						env: { ...process.env, PI_GOAL_TEST_DIR: directory },
						stdio: "ignore",
					});
					child.on("error", reject);
					child.on("exit", (code) =>
						code === 0 ? resolve() : reject(new Error(`writer ${index} exited with ${code}`)),
					);
				});
			}),
		);

		const streak = runNode(
			`const m = await import(${JSON.stringify(goalCoreUrl)}); process.stdout.write(String(m.loadGoal("shared").blocked_streak));`,
			directory,
		);
		assert.equal(streak, String(writerCount), "每个不同 turn 的报阻都必须被计入");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

// clear 是用户显式动作，但不得因此重写已经结束的目标：
// 把 complete 改成 abandoned 会销毁完成理由，并把已交付的目标误报为放弃。
test("archiveGoal 不得改写终态 goal", () => {
	const thread = "thread-archive-terminal";
	createGoal(thread, "已完成目标");
	updateGoalStatus(thread, "complete", "顺利做完", "t1");
	const before = loadGoal(thread);

	const returned = archiveGoal(thread, "随手清理");
	const after = loadGoal(thread);
	assert.equal(after?.status, "complete", "complete 必须保持不变");
	assert.equal(after?.status_reason, "顺利做完", "完成理由不得被 clear 理由覆盖");
	assert.equal(after?.updated_at, before?.updated_at, "no-op 不得扰动时间戳");
	assert.notEqual(returned, null, "目标仍存在，不应返回 null");

	// abandoned 同样是终态：重复 clear 不得刷新理由。
	const second = "thread-archive-twice";
	createGoal(second, "放弃目标");
	archiveGoal(second, "第一次放弃");
	archiveGoal(second, "第二次放弃");
	assert.equal(loadGoal(second)?.status_reason, "第一次放弃");
});

test("archiveGoal 仍可清理未完成的 goal", () => {
	for (const [thread, prepare] of [
		["thread-clear-active", () => undefined],
		["thread-clear-paused", (id: string) => pauseGoal(id)],
	] as Array<[string, (id: string) => unknown]>) {
		createGoal(thread, "未完成目标");
		prepare(thread);
		archiveGoal(thread, "不要了");
		assert.equal(loadGoal(thread)?.status, "abandoned", thread);
	}
});

// 锁的等待必须是真睡眠而非忙等。忙等版本在等锁期间会满占一核（实测
// user ≈ wall），Atomics.wait 则把线程挂起在内核（实测 user 远小于 wall）。
// 断言 CPU 时间而非实现细节，因为前者才是真正要保障的性质。
test("locked writes fail closed without burning CPU or stealing old locks", () => {
	const directory = mkdtempSync(join(tmpdir(), "goal-lock-timeout-"));
	try {
		runNode(`const m = await import(${JSON.stringify(goalCoreUrl)}); m.createGoal("t", "目标");`, directory);
		const path = runNode(`const m = await import(${JSON.stringify(goalCoreUrl)}); process.stdout.write(m.goalFilePath("t"));`, directory);
		const before = readFileSync(path, "utf8");
		mkdirSync(path + ".lock");
		const oldTime = new Date(Date.now() - 60000);
		utimesSync(path + ".lock", oldTime, oldTime);
		const result = JSON.parse(runNode(`const m = await import(${JSON.stringify(goalCoreUrl)});
			const start = Date.now(), cpuStart = process.cpuUsage(); let error = "";
			try { m.pauseGoal("t"); } catch(e) { error = e.message; }
			const cpu = process.cpuUsage(cpuStart);
			process.stdout.write(JSON.stringify({error, wall: Date.now()-start, cpu: (cpu.user+cpu.system)/1000}));`, directory));
		assert.match(result.error, /Goal lock timed out/);
		assert.ok(result.wall >= 2500);
		assert.ok(result.cpu < result.wall * 0.6);
		assert.equal(readFileSync(path, "utf8"), before);
		assert.equal(existsSync(path + ".lock"), true);
		// Once the owner releases the lock, writes work again.
		rmSync(path + ".lock", {recursive:true});
		runNode(`const m = await import(${JSON.stringify(goalCoreUrl)}); m.pauseGoal("t");`, directory);
		assert.equal(JSON.parse(readFileSync(path,"utf8")).status,"paused");
	} finally { rmSync(directory, {recursive:true,force:true}); }
});

function lifecycleHarness(name: string) {
	const file = "/tmp/goal-lifecycle-" + name + ".jsonl";
	const thread = getSessionThreadId(file);
	const handlers = new Map<string, any>();
	const commands = new Map<string, any>();
	let sent = 0, aborted = 0;
	const ctx = {
		sessionManager: {getSessionFile: () => file}, ui: {notify() {}},
		isIdle: () => true, hasPendingMessages: () => false,
		abort: () => { aborted++; },
	};
	goalExtension({on: (e: string,h: any) => handlers.set(e,h),
		registerCommand: (name: string, command: any) => commands.set(name,command),
		registerTool() {}, sendUserMessage: () => {sent++;},
	} as any);
	return {thread, ctx, get sent(){return sent;}, get aborted(){return aborted;},
		fire: (event: string, payload: any = {}) => handlers.get(event)?.(payload,ctx),
		command: (text: string) => commands.get("ansatz:goal").handler(text,ctx),
	};
}

test("restart pauses active goal and resume preserves identity", async () => {
	const h=lifecycleHarness("restart");const goal=createGoal(h.thread,"recover me");
	await h.fire("session_start",{reason:"startup"});
	assert.equal(loadGoal(h.thread)?.status,"paused");assert.equal(h.sent,0);
	await h.command("resume");
	assert.equal(loadGoal(h.thread)?.goal_id,goal.goal_id);
	assert.equal(loadGoal(h.thread)?.status,"active");assert.equal(h.sent,1);
	await h.fire("session_shutdown");
});

test("pause and shutdown cancel pending continuation before dispatch", async () => {
	for(const operation of ["pause","clear","shutdown"]) {
		const h=lifecycleHarness("cancel-"+operation);createGoal(h.thread,"do work");
		const pending=h.fire("agent_settled");
		if(operation==="shutdown") await h.fire("session_shutdown"); else await h.command(operation);
		await pending;await tick();assert.equal(h.sent,0);
	}
});

test("model-turn budget stops a tool loop before agent_settled", async () => {
	const previous=process.env.CYBERBRAIN_GOAL_MODEL_TURN_BUDGET;
	process.env.CYBERBRAIN_GOAL_MODEL_TURN_BUDGET="2";
	const h=lifecycleHarness("model-turns");
	try {
		createGoal(h.thread,"bounded loop");await h.fire("agent_start");
		for(let i=0;i<3;i++) await h.fire("turn_start",{timestamp:Date.now(),turnIndex:i});
		assert.equal(loadGoal(h.thread)?.model_turn_count,2);
		assert.equal(loadGoal(h.thread)?.turn_count,0);
		assert.equal(loadGoal(h.thread)?.status,"paused");assert.equal(h.aborted,1);
		await h.fire("agent_settled");assert.equal(h.sent,0);
		await h.command("resume");assert.equal(loadGoal(h.thread)?.model_turn_count,0);
	} finally {
		if(previous===undefined) delete process.env.CYBERBRAIN_GOAL_MODEL_TURN_BUDGET;
		else process.env.CYBERBRAIN_GOAL_MODEL_TURN_BUDGET=previous;
		await h.fire("session_shutdown");
	}
});

test("wall deadline aborts a run with no further model or tool events", async () => {
	const h=lifecycleHarness("timeout");const goal=createGoal(h.thread,"hanging call");
	saveGoal({...goal,deadline_at:Date.now()+40});
	await h.fire("agent_start");await new Promise(resolve=>setTimeout(resolve,90));
	assert.equal(loadGoal(h.thread)?.status,"paused");assert.equal(h.aborted,1);
	assert.match(loadGoal(h.thread)?.status_reason??"",/wall-time/);
	await h.fire("agent_settled");assert.equal(h.sent,0);
	await h.fire("session_shutdown");
});
