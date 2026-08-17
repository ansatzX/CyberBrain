import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface GoalState {
	thread_id: string;
	goal_id: string;
	objective: string;
	status: "active" | "paused" | "blocked" | "complete" | "abandoned";
	created_at: string;
	updated_at: string;
	blocked_streak: number;
	blocked_condition: string | null;
	last_blocked_turn_id: string | null;
	status_reason: string | null;
}

export type GoalStatus = GoalState["status"];
export type UpdateGoalOutcome = { ok: true; goal: GoalState } | { ok: false; error: string };
export type PauseGoalOutcome = { ok: true; goal: GoalState } | { ok: false; error: string };

const VALID_STATUS = new Set<GoalStatus>(["active", "paused", "blocked", "complete", "abandoned"]);

function goalsDir(): string {
	return process.env.PI_GOAL_TEST_DIR || join(homedir(), ".pi", "agent", "goals");
}

const EPHEMERAL_THREAD_ID = `ephemeral-${randomUUID()}`;

export function getSessionThreadId(sessionFile: string | undefined): string {
	if (!sessionFile) return EPHEMERAL_THREAD_ID;
	return createHash("sha1").update(sessionFile).digest("hex").slice(0, 16);
}

function goalHash(threadId: string): string {
	return createHash("sha1").update(threadId).digest("hex").slice(0, 16);
}

export function goalFilePath(threadId: string): string {
	return join(goalsDir(), `${goalHash(threadId)}.json`);
}

function legacyGoalFilePath(threadId: string): string {
	return join(goalsDir(), `${goalHash(threadId)}.md`);
}

function isGoalState(value: unknown): value is GoalState {
	if (!value || typeof value !== "object") return false;
	const goal = value as Partial<GoalState>;
	return (
		typeof goal.thread_id === "string" &&
		typeof goal.goal_id === "string" &&
		typeof goal.objective === "string" &&
		VALID_STATUS.has(goal.status as GoalStatus) &&
		typeof goal.created_at === "string" &&
		typeof goal.updated_at === "string" &&
		typeof goal.blocked_streak === "number" &&
		(goal.blocked_condition === null || typeof goal.blocked_condition === "string") &&
		(goal.last_blocked_turn_id === null || typeof goal.last_blocked_turn_id === "string") &&
		(goal.status_reason === null || typeof goal.status_reason === "string")
	);
}

function parseLegacyGoal(raw: string): GoalState | null {
	const frontmatter = raw.match(/^---\n([\s\S]*?)\n---\n/);
	if (!frontmatter) return null;
	const get = (key: string): string => {
		const match = frontmatter[1].match(new RegExp(`^${key}:[ \\t]*(.*)$`, "m"));
		return match ? match[1].trim() : "";
	};
	const status = get("status") as GoalStatus;
	if (!VALID_STATUS.has(status)) return null;
	const unescapeNewlines = (value: string): string => value.replace(/\\n/g, "\n");
	return {
		thread_id: get("thread_id"),
		goal_id: get("goal_id"),
		objective: unescapeNewlines(get("objective")),
		status,
		created_at: get("created_at"),
		updated_at: get("updated_at"),
		blocked_streak: Number(get("blocked_streak")) || 0,
		blocked_condition: get("blocked_condition") || null,
		last_blocked_turn_id: null,
		status_reason: get("complete_reason") || null,
	};
}

export function loadGoal(threadId: string): GoalState | null {
	const jsonPath = goalFilePath(threadId);
	if (existsSync(jsonPath)) {
		try {
			const parsed: unknown = JSON.parse(readFileSync(jsonPath, "utf8"));
			return isGoalState(parsed) ? parsed : null;
		} catch {
			return null;
		}
	}

	const legacyPath = legacyGoalFilePath(threadId);
	if (!existsSync(legacyPath)) return null;
	const migrated = parseLegacyGoal(readFileSync(legacyPath, "utf8"));
	if (!migrated) return null;
	saveGoal(migrated);
	rmSync(legacyPath, { force: true });
	return migrated;
}

export function saveGoal(goal: GoalState): void {
	const path = goalFilePath(goal.thread_id);
	mkdirSync(dirname(path), { recursive: true });
	const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
	writeFileSync(temporaryPath, `${JSON.stringify(goal, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
	renameSync(temporaryPath, path);
}

export function createGoal(threadId: string, objective: string): GoalState {
	const existing = loadGoal(threadId);
	if (existing && ["active", "paused", "blocked"].includes(existing.status)) {
		throw new Error("An unfinished goal already exists. Clear or resume it first.");
	}
	const now = new Date().toISOString();
	const goal: GoalState = {
		thread_id: threadId,
		goal_id: randomUUID(),
		objective,
		status: "active",
		created_at: now,
		updated_at: now,
		blocked_streak: 0,
		blocked_condition: null,
		last_blocked_turn_id: null,
		status_reason: null,
	};
	saveGoal(goal);
	return goal;
}

export function archiveGoal(threadId: string, reason: string): GoalState | null {
	const goal = loadGoal(threadId);
	if (!goal) return null;
	goal.status = "abandoned";
	goal.updated_at = new Date().toISOString();
	goal.status_reason = reason || "cleared via /ansatz:goal clear";
	saveGoal(goal);
	return goal;
}

function normalizeBlockedCondition(condition: string): string {
	return condition.trim().replace(/\s+/g, " ");
}

/**
 * Record an explicit blocked report from one goal turn.
 *
 * A new turn cannot reliably tell whether the model made progress: a settled
 * model may have used no tools, or may simply be waiting for an external
 * decision. Therefore only an explicit update_goal(status="blocked") report
 * participates in this audit. A different reported condition starts a new
 * three-turn audit; the same condition accumulates across distinct turns.
 */
export function registerBlockedOccurrence(threadId: string, turnId: string, condition: string): void {
	const goal = loadGoal(threadId);
	if (!goal || goal.status !== "active" || goal.last_blocked_turn_id === turnId) return;

	const normalizedCondition = normalizeBlockedCondition(condition);
	if (goal.blocked_condition !== normalizedCondition) {
		goal.blocked_streak = 0;
	}
	goal.blocked_streak += 1;
	goal.blocked_condition = normalizedCondition;
	goal.last_blocked_turn_id = turnId;
	goal.updated_at = new Date().toISOString();
	saveGoal(goal);
}

export function updateGoalStatus(
	threadId: string,
	status: "complete" | "blocked",
	reason: string,
	turnId: string,
): UpdateGoalOutcome {
	const goal = loadGoal(threadId);
	if (!goal) return { ok: false, error: "No goal exists for this session." };
	if (goal.status !== "active") return { ok: false, error: `Goal is already ${goal.status}.` };
	if (!reason.trim()) return { ok: false, error: "A reason is required when updating goal status." };

	if (status === "complete") {
		goal.status = "complete";
		goal.status_reason = reason.trim();
		goal.updated_at = new Date().toISOString();
		saveGoal(goal);
		return { ok: true, goal };
	}

	registerBlockedOccurrence(threadId, turnId, reason.trim());
	const current = loadGoal(threadId);
	if (!current || current.blocked_streak < 3) {
		return {
			ok: false,
			error: `The same blocking condition must be explicitly reported in at least 3 distinct goal turns before marking blocked (currently ${current ? current.blocked_streak : 0}/3).`,
		};
	}
	current.status = "blocked";
	current.status_reason = reason.trim();
	current.updated_at = new Date().toISOString();
	saveGoal(current);
	return { ok: true, goal: current };
}

export function objectiveUpdatedPrompt(goal: GoalState): string {
	return [
		`新持久化目标已设置：${goal.objective}`,
		"",
		"行为要求：",
		"- 从当前工作区证据出发推进目标，不要重定义成功标准。",
		"- 目标达成后调用 update_goal 工具，status=\"complete\"，附理由。",
		"- 同一阻塞在至少 3 个不同 goal turn 中被显式报告后，才可调用 update_goal，status=\"blocked\"。",
		"- 目标状态可通过 get_goal 工具随时查询。",
	].join("\n");
}

export function continuationPrompt(goal: GoalState): string {
	return [
		`继续推进持久化目标：${goal.objective}`,
		"",
		"行为要求：",
		"- 目标跨轮次持续存在；本轮回合不必缩小目标范围。",
		"- 以当前工作区和外部状态为权威证据，先检查现状再决定下一步。",
		"- 完成审计：标记 complete 前必须逐条验证目标要求已被当前状态满足；证据不足就继续干活。",
		"- 若存在仍可执行、可验证的下一步，执行它；不要只重复无信息增益的状态审计。",
		"- 若同一外部条件使本轮没有可执行下一步或新证据，调用 update_goal(status=\"blocked\", reason=<稳定且具体的同一原因>) 登记它；前两次 1/3、2/3 仍需等待自动下一轮，第三次会停止。",
		"- 调用 update_goal 工具，status=\"complete\" 并附理由；只有同一阻塞在至少 3 个不同 goal turn 中被显式报告后才能 status=\"blocked\"。",
		"- 不要因为难、慢或成本原因标记 complete/blocked。",
		"- 目标状态可通过 get_goal 工具查询。",
	].join("\n");
}

export function toolGetGoal(threadId: string): string {
	const goal = loadGoal(threadId);
	if (!goal) return "No goal set for this session.";
	return [
		`objective: ${goal.objective}`,
		`status: ${goal.status}`,
		`created_at: ${goal.created_at}`,
		`updated_at: ${goal.updated_at}`,
		`blocked_streak: ${goal.blocked_streak}`,
		`blocked_condition: ${goal.blocked_condition || "none"}`,
		`status_reason: ${goal.status_reason || "none"}`,
	].join("\n");
}

export function toolCreateGoal(threadId: string, objective: string): string {
	if (!objective.trim()) return "error: objective is required";
	try {
		const goal = createGoal(threadId, objective.trim());
		return `Goal created: ${goal.objective}\n\n${objectiveUpdatedPrompt(goal)}`;
	} catch (error) {
		return `error: ${(error as Error).message}`;
	}
}

export function toolUpdateGoal(
	threadId: string,
	status: "complete" | "blocked",
	reason: string,
	turnId: string,
): string {
	if (status !== "complete" && status !== "blocked") return "error: status must be complete or blocked";
	const result = updateGoalStatus(threadId, status, reason, turnId);
	if (!result.ok) return `error: ${result.error}`;
	return `Goal ${status}: ${result.goal.status_reason}`;
}

export function shouldContinue(goal: GoalState): boolean {
	return goal.status === "active";
}

export function pauseGoal(threadId: string): PauseGoalOutcome {
	const goal = loadGoal(threadId);
	if (!goal) return { ok: false, error: "No goal exists for this session." };
	if (goal.status !== "active") return { ok: false, error: `Only active goals can be paused (current: ${goal.status}).` };
	goal.status = "paused";
	goal.updated_at = new Date().toISOString();
	saveGoal(goal);
	return { ok: true, goal };
}

export function resumeGoal(threadId: string): PauseGoalOutcome {
	const goal = loadGoal(threadId);
	if (!goal) return { ok: false, error: "No goal exists for this session." };
	if (goal.status !== "paused") return { ok: false, error: `Only paused goals can be resumed (current: ${goal.status}).` };
	goal.status = "active";
	goal.blocked_streak = 0;
	goal.blocked_condition = null;
	goal.last_blocked_turn_id = null;
	goal.updated_at = new Date().toISOString();
	saveGoal(goal);
	return { ok: true, goal };
}
