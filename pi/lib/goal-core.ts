import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { agentDir } from "./agent-paths.ts";
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
	/** Continuation turns consumed since the goal was created or last resumed. */
	turn_count: number;
	/** Consecutive continuation turns that produced no observable work. */
	idle_streak: number;
	/** Consecutive continuation turns that ended in a model/runtime error. */
	error_streak: number;
	/** Model turns and wall deadline since creation/resume; optional for old files. */
	model_turn_count?: number;
	deadline_at?: number | null;
}

export type GoalStatus = GoalState["status"];
export type UpdateGoalOutcome = { ok: true; goal: GoalState } | { ok: false; error: string };
export type PauseGoalOutcome = { ok: true; goal: GoalState } | { ok: false; error: string };

const VALID_STATUS = new Set<GoalStatus>(["active", "paused", "blocked", "complete", "abandoned"]);

/**
 * Automatic stop conditions.
 *
 * Goal continuation is unattended by design: nothing but the model's own
 * `update_goal` call, or a human running `/ansatz:goal pause`, stops the loop.
 * These budgets are the fallback brake for when neither happens. Exceeding one
 * parks the goal as `paused` — never a terminal state — so `resume` continues
 * the same objective with its history intact.
 *
 * Both are deliberately small by default and overridable per environment;
 * no budget is compiled in as a constant.
 */
export const DEFAULT_TURN_BUDGET = 10;
export const DEFAULT_IDLE_BUDGET = 3;
/**
 * Consecutive errored turns tolerated before the goal stops.
 *
 * Codex blocks its goal on the first settled turn error, reasoning that the
 * turn already exhausted its retries, so continuing only loops and burns
 * tokens (codex-rs/ext/goal/src/extension.rs:293-300). A small streak is used
 * here instead of 1 because a single transient provider error is worth one
 * retry, while a genuinely broken state repeats immediately.
 */
export const DEFAULT_ERROR_BUDGET = 2;
export const DEFAULT_MODEL_TURN_BUDGET = 100;
export const DEFAULT_TIME_BUDGET_MS = 30 * 60 * 1000;

export function modelTurnBudget(): number {
	return positiveIntFromEnv("CYBERBRAIN_GOAL_MODEL_TURN_BUDGET", DEFAULT_MODEL_TURN_BUDGET);
}

function newDeadline(): number | null {
	const ms = positiveIntFromEnv("CYBERBRAIN_GOAL_TIME_BUDGET_MS", DEFAULT_TIME_BUDGET_MS);
	return Number.isFinite(ms) ? Date.now() + ms : null;
}

function positiveIntFromEnv(name: string, fallback: number): number {
	const raw = process.env[name]?.trim();
	if (!raw) return fallback;
	if (raw.toLowerCase() === "off" || raw === "0") return Number.POSITIVE_INFINITY;
	const parsed = Number(raw);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Max continuation turns before auto-pause. `CYBERBRAIN_GOAL_TURN_BUDGET=off` disables. */
export function turnBudget(): number {
	return positiveIntFromEnv("CYBERBRAIN_GOAL_TURN_BUDGET", DEFAULT_TURN_BUDGET);
}

/** Max consecutive no-progress turns before auto-pause. `CYBERBRAIN_GOAL_IDLE_BUDGET=off` disables. */
export function idleBudget(): number {
	return positiveIntFromEnv("CYBERBRAIN_GOAL_IDLE_BUDGET", DEFAULT_IDLE_BUDGET);
}

/** Max consecutive errored turns before auto-pause. `CYBERBRAIN_GOAL_ERROR_BUDGET=off` disables. */
export function errorBudget(): number {
	return positiveIntFromEnv("CYBERBRAIN_GOAL_ERROR_BUDGET", DEFAULT_ERROR_BUDGET);
}

function goalsDir(): string {
	return process.env.PI_GOAL_TEST_DIR || join(agentDir(), "goals");
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
		// turn_count/idle_streak are intentionally not required: goal files written
		// before budgets existed must still load. loadGoal backfills them.
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
		turn_count: 0,
		idle_streak: 0,
		error_streak: 0,
	};
}

export function loadGoal(threadId: string): GoalState | null {
	const jsonPath = goalFilePath(threadId);
	if (existsSync(jsonPath)) {
		try {
			const parsed: unknown = JSON.parse(readFileSync(jsonPath, "utf8"));
			if (!isGoalState(parsed)) return null;
			// Backfill budget counters for goals created before they existed.
			if (typeof parsed.turn_count !== "number") parsed.turn_count = 0;
			if (typeof parsed.idle_streak !== "number") parsed.idle_streak = 0;
			if (typeof parsed.error_streak !== "number") parsed.error_streak = 0;
			return parsed;
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

/**
 * Run a read-modify-write cycle under a cross-process lock.
 *
 * `saveGoal`'s rename makes a single write atomic, but the blocked audit reads
 * a counter, increments it, and writes it back. Two processes interleaving in
 * that window both read the same streak and one increment is lost — measured as
 * 3 recorded occurrences from 5 concurrent writers. Because the audit gates a
 * terminal state on an exact count of three, a lost update silently moves the
 * threshold.
 *
 * `mkdir` is atomic and serves as the mutex. Timeout fails without mutation.
 * Age alone cannot prove the owner is dead (suspend, slow I/O, another host).
 * Orphan locks require stopping all writers before explicit removal.
 */
const LOCK_RETRY_MS = 15;
const LOCK_MAX_ATTEMPTS = 200;

function withGoalLock<T>(threadId: string, mutate: () => T): T {
	const lockPath = `${goalFilePath(threadId)}.lock`;
	mkdirSync(dirname(lockPath), { recursive: true });
	let held = false;

	for (let attempt = 0; attempt < LOCK_MAX_ATTEMPTS; attempt += 1) {
		try {
			mkdirSync(lockPath);
			held = true;
			break;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
			sleepSync(LOCK_RETRY_MS);
		}
	}

	if (!held) throw new Error(`Goal lock timed out: ${lockPath}. State unchanged. Stop all writers before removing an orphaned lock and retrying.`);
	try {
		return mutate();
	} finally {
		if (held) rmSync(lockPath, { recursive: true, force: true });
	}
}

/**
 * Block the thread without burning CPU.
 *
 * `Atomics.wait` parks the thread in the kernel; a busy-wait loop would spin a
 * core for the whole retry budget. The buffer is never notified, so the wait
 * always runs to its timeout — it is a sleep, not a handoff.
 */
const SLEEP_BUFFER = new Int32Array(new SharedArrayBuffer(4));

function sleepSync(milliseconds: number): void {
	Atomics.wait(SLEEP_BUFFER, 0, 0, milliseconds);
}

export function createGoal(threadId: string, objective: string): GoalState {
	return withGoalLock(threadId, () => {
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
			turn_count: 0,
			idle_streak: 0,
			error_streak: 0,
			model_turn_count: 0,
			deadline_at: newDeadline(),
		};
		saveGoal(goal);
		return goal;
	});
}

/**
 * Abandon an unfinished goal.
 *
 * Terminal goals are left untouched: rewriting a `complete` goal into
 * `abandoned` would destroy the completion reason and misreport a finished
 * objective as given up. `clear` on an already-terminal goal is therefore a
 * no-op that returns the existing record unchanged.
 */
export function archiveGoal(threadId: string, reason: string): GoalState | null {
	return withGoalLock(threadId, () => {
		const goal = loadGoal(threadId);
		if (!goal) return null;
		if (goal.status === "complete" || goal.status === "abandoned") return goal;
		goal.status = "abandoned";
		goal.updated_at = new Date().toISOString();
		goal.status_reason = reason || "cleared via /ansatz:goal clear";
		saveGoal(goal);
		return goal;
	});
}

function normalizeBlockedCondition(condition: string): string {
	return condition.trim().replace(/\s+/g, " ");
}

/**
 * Decide whether two blocked reports describe the same obstruction.
 *
 * The audit used to require byte-identical text, which a real model almost
 * never produces: "waiting for the API" and "API still not live" are the same
 * obstruction, but the streak reset to 1 every turn, so the three-turn brake
 * could never engage. Measured: five genuine stall reports left streak at 1.
 *
 * Overlap is scored against the *smaller* token set (overlap coefficient), not
 * their union. Jaccard was tried first and rejected: restatements are usually
 * asymmetric — "waiting for API" vs "API still not live" shares only 1 of 5
 * union tokens (0.20) while clearly describing one obstruction. Dividing by the
 * smaller set scores that 0.33 and a genuinely different obstruction 0.00.
 *
 * CJK text has no word breaks, so it degrades to character bigrams rather than
 * comparing one giant token.
 */
const BLOCKED_SIMILARITY_THRESHOLD = 0.3;
const FILLER_TOKENS = new Set([
	"the", "a", "an", "is", "are", "was", "were", "be", "been", "still", "yet",
	"for", "on", "to", "of", "and", "or", "not", "no", "it", "this", "that",
	"\u4e86", "\u7684", "\u5728", "\u8fd8", "\u4ecd", "\u4ecd\u7136", "\u6b63\u5728", "\u5c1a\u672a", "\u8fd8\u6ca1", "\u4e00\u76f4",
]);

function conditionTokens(condition: string): Set<string> {
	const text = condition.toLowerCase();
	const tokens = new Set<string>();
	for (const word of text.split(/[^\p{L}\p{N}]+/u)) {
		if (!word) continue;
		// Scripts without spaces (CJK) collapse to one token; use bigrams instead.
		if (/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+$/u.test(word)) {
			if (word.length === 1) {
				tokens.add(word);
				continue;
			}
			for (let index = 0; index < word.length - 1; index += 1) {
				const bigram = word.slice(index, index + 2);
				if (!FILLER_TOKENS.has(bigram)) tokens.add(bigram);
			}
			continue;
		}
		if (!FILLER_TOKENS.has(word)) tokens.add(word);
	}
	return tokens;
}

export function isSameBlockedCondition(left: string, right: string): boolean {
	const a = normalizeBlockedCondition(left);
	const b = normalizeBlockedCondition(right);
	if (a === b) return true;

	const leftTokens = conditionTokens(a);
	const rightTokens = conditionTokens(b);
	if (leftTokens.size === 0 || rightTokens.size === 0) return false;

	let shared = 0;
	for (const token of leftTokens) if (rightTokens.has(token)) shared += 1;
	const smaller = Math.min(leftTokens.size, rightTokens.size);
	return shared / smaller >= BLOCKED_SIMILARITY_THRESHOLD;
}

/**
 * Record an explicit blocked report from one goal turn.
 *
 * A new turn cannot reliably tell whether the model made progress: a settled
 * model may have used no tools, or may simply be waiting for an external
 * decision. Therefore only an explicit update_goal(status="blocked") report
 * participates in this audit. A materially different condition starts a new
 * three-turn audit; restatements of the same obstruction accumulate across
 * distinct turns (see isSameBlockedCondition).
 */
export function registerBlockedOccurrence(threadId: string, turnId: string, condition: string): void {
	withGoalLock(threadId, () => registerBlockedOccurrenceLocked(threadId, turnId, condition));
}

/** Caller must already hold the goal lock. */
function registerBlockedOccurrenceLocked(threadId: string, turnId: string, condition: string): void {
	const goal = loadGoal(threadId);
	if (!goal || goal.status !== "active" || goal.last_blocked_turn_id === turnId) return;

	const normalizedCondition = normalizeBlockedCondition(condition);
	if (!goal.blocked_condition || !isSameBlockedCondition(goal.blocked_condition, normalizedCondition)) {
		goal.blocked_streak = 0;
	}
	goal.blocked_streak += 1;
	// Keep the first phrasing of a recurring obstruction so the recorded reason
	// stays stable while the model paraphrases around it.
	if (goal.blocked_streak === 1) goal.blocked_condition = normalizedCondition;
	goal.last_blocked_turn_id = turnId;
	goal.updated_at = new Date().toISOString();
	saveGoal(goal);
}

// The whole audit — read streak, increment, re-read, promote to blocked — runs
// under one lock so a concurrent writer cannot land between the increment and
// the threshold check.
export function updateGoalStatus(
	threadId: string,
	status: "complete" | "blocked",
	reason: string,
	turnId: string,
): UpdateGoalOutcome {
	return withGoalLock(threadId, (): UpdateGoalOutcome => {
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

		registerBlockedOccurrenceLocked(threadId, turnId, reason.trim());
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
	});
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
		`continuation_turns: ${goal.turn_count}`,
		`model_turns: ${goal.model_turn_count ?? 0}`,
		`deadline: ${goal.deadline_at == null ? "none" : new Date(goal.deadline_at).toISOString()}`,
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

export type TurnProgress = {
	madeProgress: boolean;
	/** Set when the turn settled on a model/runtime error, after retries. */
	erroredReason?: string;
};

/**
 * Tools that change state the goal could be judged against.
 *
 * The first version counted *any* tool call as progress, which the idle budget
 * cannot survive: a model that loops on `read`/`grep`/`git status` looks busy
 * forever while producing nothing. Only mutations and their verification count.
 *
 * `bash` is deliberately absent — it is the ambiguous case, resolved separately
 * by inspecting the command (see bashCommandMutates).
 */
const MUTATING_TOOLS = new Set(["write", "edit", "multiedit", "notebook_edit", "apply_patch", "str_replace"]);

/** Read-only tools, plus the goal tools themselves: never progress on their own. */
const INSPECTION_TOOLS = new Set([
	"read", "grep", "glob", "find", "ls", "list", "web_search", "web_fetch",
	"get_goal", "create_goal", "update_goal",
	"lens_diagnostics", "lsp_diagnostics", "symbol_search", "project_report",
	"module_report", "read_symbol", "read_enclosing",
]);

/**
 * Decide whether a bash command did something a goal can be judged against.
 *
 * Inspection commands (`git status`, `ls`, `cat`) are how a stalled model looks
 * busy, so they must not count. Anything not recognized as read-only counts as
 * work: under-counting would stop a genuinely productive run, which is the more
 * damaging error — over-counting merely delays the idle brake, and the turn
 * budget still bounds the run.
 */
const READ_ONLY_BASH = /^(?:ls|cat|head|tail|less|more|pwd|echo|printf|which|type|file|stat|wc|find|grep|rg|ag|ack|fd|tree|du|df|ps|top|env|printenv|date|whoami|id|uname|history|man|help)\b/;
const READ_ONLY_SUBCOMMANDS = /^(?:git\s+(?:status|log|diff|show|branch|remote|config\s+--get|rev-parse|describe|blame|ls-files|shortlog|reflog|stash\s+list|tag\s*$)|npm\s+(?:ls|list|view|outdated|info)|jq\b|yq\b|docker\s+(?:ps|images|logs|inspect)|kubectl\s+(?:get|describe|logs))/;

export function bashCommandMutates(command: string): boolean {
	// A compound command counts as work if any segment does.
	const segments = command
		.split(/(?:&&|\|\||;|\n)/)
		.map((segment) => segment.trim().replace(/^[(\s]+/, ""))
		.filter(Boolean);
	if (segments.length === 0) return false;

	return segments.some((segment) => {
		// A redirect writes a file regardless of the leading command.
		if (/(?<![<>])>{1,2}(?!&)/.test(segment)) return true;
		if (READ_ONLY_SUBCOMMANDS.test(segment)) return false;
		if (READ_ONLY_BASH.test(segment)) return false;
		return true;
	});
}

/**
 * Classify one tool call as progress or inspection.
 *
 * A failed call is never progress: a model retrying a broken command is the
 * exact stall the idle budget exists to catch.
 */
export function toolCallMakesProgress(toolName: string, input: unknown, isError: boolean): boolean {
	if (isError) return false;
	if (INSPECTION_TOOLS.has(toolName)) return false;
	if (MUTATING_TOOLS.has(toolName)) return true;
	if (toolName === "bash") {
		const command = (input as { command?: unknown } | null)?.command;
		return typeof command === "string" ? bashCommandMutates(command) : true;
	}
	// Unknown tools (MCP, subagents, custom) are assumed to do real work.
	return true;
}
export type TurnBudgetOutcome =
	| { kind: "continue"; goal: GoalState }
	| { kind: "paused"; goal: GoalState; reason: string };

/**
 * Account for one completed continuation turn and apply the automatic brakes.
 *
 * Continuation is otherwise unbounded: without this, a goal that the model
 * never marks complete drives turns forever. Three independent budgets apply.
 *
 * - turn budget: total continuation turns, the blunt backstop.
 * - idle budget: consecutive turns with no observable work, which catches a
 *   model re-auditing its own state instead of acting. Any turn that does work
 *   resets the idle counter, so productive long runs are unaffected.
 * - error budget: consecutive turns that ended in a model/runtime error. Pi
 *   only settles a turn once retries and auto-compaction are exhausted, so a
 *   settled error is already terminal for that turn; continuing past a
 *   repeating one loops on a broken state and burns tokens.
 *
 * Exhausting any budget parks the goal as `paused`, never terminal: the
 * objective, history, and goal_id survive, and `resume` clears the counters so
 * an operator can grant another budget without re-stating the objective.
 */
export function recordContinuationTurn(threadId: string, progress: TurnProgress): TurnBudgetOutcome | null {
	return withGoalLock(threadId, (): TurnBudgetOutcome | null => {
		const goal = loadGoal(threadId);
		if (!goal || goal.status !== "active") return null;

		goal.turn_count += 1;
		goal.idle_streak = progress.madeProgress ? 0 : goal.idle_streak + 1;
		// An errored turn cannot also be a productive one, so the error streak is
		// tracked independently and only a clean turn clears it.
		goal.error_streak = progress.erroredReason ? goal.error_streak + 1 : 0;
		goal.updated_at = new Date().toISOString();

		const turns = turnBudget();
		const idle = idleBudget();
		const errors = errorBudget();
		let reason: string | null = null;
		// Checked before the other budgets: a repeating error is the most specific
		// diagnosis available, and reporting it as "no progress" would hide the
		// actual failure from whoever resumes the goal.
		if (goal.error_streak >= errors) {
			reason = `Auto-paused after ${goal.error_streak} consecutive errored turns (error budget ${errors}). Last error: ${progress.erroredReason}. Fix the underlying failure, then use /ansatz:goal resume, or /ansatz:goal clear to abandon.`;
		} else if (goal.turn_count >= turns) {
			reason = `Auto-paused after ${goal.turn_count} continuation turns (turn budget ${turns}). Use /ansatz:goal resume to grant another budget, or /ansatz:goal clear to abandon.`;
		} else if (goal.idle_streak >= idle) {
			reason = `Auto-paused after ${goal.idle_streak} consecutive turns with no observable progress (idle budget ${idle}). Use /ansatz:goal resume to continue, or /ansatz:goal clear to abandon.`;
		}

		if (!reason) {
			saveGoal(goal);
			return { kind: "continue", goal };
		}

		goal.status = "paused";
		goal.status_reason = reason;
		saveGoal(goal);
		return { kind: "paused", goal, reason };
	});
}

export function pauseGoal(threadId: string, reason = "Paused by user."): PauseGoalOutcome {
	return withGoalLock(threadId, (): PauseGoalOutcome => {
		const goal = loadGoal(threadId);
		if (!goal) return { ok: false, error: "No goal exists for this session." };
		if (goal.status !== "active") return { ok: false, error: `Only active goals can be paused (current: ${goal.status}).` };
		goal.status = "paused";
		goal.status_reason = reason;
		goal.updated_at = new Date().toISOString();
		saveGoal(goal);
		return { ok: true, goal };
	});
}

/**
 * Resume a paused or blocked goal.
 *
 * `blocked` means "the same external condition stopped progress in at least
 * three distinct turns" — it is a stall report, not an outcome. When the
 * external condition clears, the objective is still the objective, so resuming
 * must be possible without destroying the goal. Requiring `clear` here would
 * force the user to discard the objective, its history, and its goal_id just to
 * retry, and `createGoal` already tells them to "Clear or resume it first".
 *
 * The blocked audit is reset on resume: the next stall must re-establish its
 * own three-turn evidence rather than inheriting a satisfied streak.
 */
export function resumeGoal(threadId: string): PauseGoalOutcome {
	return withGoalLock(threadId, (): PauseGoalOutcome => {
		const goal = loadGoal(threadId);
		if (!goal) return { ok: false, error: "No goal exists for this session." };
		if (goal.status !== "paused" && goal.status !== "blocked") {
			return { ok: false, error: `Only paused or blocked goals can be resumed (current: ${goal.status}).` };
		}
		goal.status = "active";
		goal.blocked_streak = 0;
		goal.blocked_condition = null;
		goal.last_blocked_turn_id = null;
		goal.status_reason = null;
		// Resume is an operator granting a fresh budget; keeping the old counters
		// would re-trip the brake on the very next turn.
		goal.turn_count = 0;
		goal.idle_streak = 0;
		goal.error_streak = 0;
		goal.model_turn_count = 0;
		goal.deadline_at = newDeadline();
		goal.updated_at = new Date().toISOString();
		saveGoal(goal);
		return { ok: true, goal };
	});
}

/** Count each model turn before it starts; never depend on agent_settled. */
export function checkExecutionBudget(threadId: string, countTurn = false): GoalState | null {
	return withGoalLock(threadId, () => {
		const goal = loadGoal(threadId);
		if (!goal || goal.status !== "active") return goal;
		if (goal.deadline_at === undefined) goal.deadline_at = newDeadline();
		let reason: string | null = null;
		if (goal.deadline_at !== null && Date.now() >= goal.deadline_at) {
			reason = "Auto-paused: wall-time budget exhausted. Use /ansatz:goal resume to continue.";
		} else if (countTurn && (goal.model_turn_count ?? 0) >= modelTurnBudget()) {
			reason = "Auto-paused: model-turn budget exhausted. Use /ansatz:goal resume to continue.";
		}
		if (reason) { goal.status = "paused"; goal.status_reason = reason; }
		else if (countTurn) goal.model_turn_count = (goal.model_turn_count ?? 0) + 1;
		goal.updated_at = new Date().toISOString();
		saveGoal(goal);
		return goal;
	});
}
