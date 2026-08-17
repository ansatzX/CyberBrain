import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { goalSetObjective } from "../extensions/goal.ts";
import { goalFilePath, loadGoal, saveGoal, createGoal, archiveGoal, updateGoalStatus, registerBlockedOccurrence, objectiveUpdatedPrompt, continuationPrompt, toolGetGoal, toolCreateGoal, toolUpdateGoal, shouldContinue, pauseGoal, resumeGoal, type GoalState } from "../lib/goal-core.ts";

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
	};
	saveGoal(g);
	const loaded = loadGoal("thread-2");
	assert.deepEqual(loaded, g);
	assert.match(readFileSync(goalFilePath("thread-2"), "utf8"), /^\{/);
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

test("goal extension 不包含 agent_settled 自动续跑 hook", () => {
	const extension = readFileSync(new URL("../extensions/goal.ts", import.meta.url), "utf8");
	assert.doesNotMatch(extension, /pi\.on\("agent_settled"/);
	assert.doesNotMatch(extension, /Goal auto-continue/);
	assert.match(extension, /Starting one explicit continuation turn/);
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

test("resumeGoal 非 paused 拒绝", () => {
	const r = resumeGoal("thread-p1"); // 已 active
	assert.equal(r.ok, false);
	if (!r.ok) assert.match(r.error, /Only paused goals/);
});

test("pause 后 createGoal 拒绝（非终态）", () => {
	pauseGoal("thread-p1");
	assert.throws(() => createGoal("thread-p1", "新目标"));
});

// 清理测试目录
rmSync(process.env.PI_GOAL_TEST_DIR as string, { recursive: true, force: true });
