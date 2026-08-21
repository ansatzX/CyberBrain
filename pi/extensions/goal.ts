// goal.ts — goal v2 扩展壳（命令层 + 工具层 + 事件层）
// 架构：goal-core.ts 纯逻辑 + 本文件 pi API 挂接（对齐 codex ext/goal/）

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	loadGoal, createGoal, archiveGoal,
	objectiveUpdatedPrompt, continuationPrompt,
	toolGetGoal, toolCreateGoal, toolUpdateGoal, shouldContinue,
	pauseGoal, resumeGoal, getSessionThreadId, recordContinuationTurn, toolCallMakesProgress, type GoalState,
} from "../lib/goal-core.ts";

export function goalSetObjective(args: string): string | null {
	const match = args.trim().match(/^set(?:\s+|$)([\s\S]*)$/i);
	if (!match) return null;
	const objective = match[1].trim();
	return objective || null;
}

/** A settled active goal gets one follow-up; terminal, paused, and queued goals do not. */
export function shouldQueueGoalContinuation(goal: GoalState | null, alreadyQueued: boolean): boolean {
	return Boolean(goal && shouldContinue(goal) && !alreadyQueued);
}

export default function goalExtension(pi: ExtensionAPI) {
	const activeTurnIds = new Map<string, string>();
	const queuedContinuations = new Set<string>();
	// Progress-making tool calls in the current agent run, per thread. A goal
	// turn that only inspects state changed nothing observable — it restated its
	// own status — and is what the idle budget is meant to catch.
	const turnToolCalls = new Map<string, number>();
	// Error reported by the most recent agent_end, per thread. agent_settled
	// carries no payload, so the failure has to be captured when agent_end
	// delivers the messages and consumed at the settle boundary.
	const turnErrors = new Map<string, string>();
	const threadIdFor = (ctx: { sessionManager: { getSessionFile(): string | undefined } }): string =>
		getSessionThreadId(ctx.sessionManager.getSessionFile());
	const turnIdFor = (threadId: string): string =>
		activeTurnIds.get(threadId) || `untracked-${threadId}`;

	pi.on("turn_start", async (event, ctx) => {
		activeTurnIds.set(threadIdFor(ctx), `${event.timestamp}:${event.turnIndex}`);
	});

	// Progress is judged on tool *results*, not tool calls: a failed call is a
	// stall, not work, and only the result carries isError.
	pi.on("tool_result", async (event, ctx) => {
		if (!toolCallMakesProgress(event.toolName, event.input, Boolean(event.isError))) return undefined;
		const threadId = threadIdFor(ctx);
		turnToolCalls.set(threadId, (turnToolCalls.get(threadId) ?? 0) + 1);
		return undefined;
	});

	// A queued continuation has been consumed once its agent run begins. The
	// guard prevents duplicate settled handlers from queueing a second follow-up
	// for the same idle boundary without suppressing the next work cycle.
	pi.on("agent_start", async (_event, ctx) => {
		const threadId = threadIdFor(ctx);
		queuedContinuations.delete(threadId);
		turnToolCalls.set(threadId, 0);
		turnErrors.delete(threadId);
	});

	// agent_end fires once per low-level run and carries the messages; a failed
	// run ends with an assistant message whose stopReason is "error". "aborted"
	// is excluded on purpose: that is the user pressing Esc, not a broken state.
	pi.on("agent_end", async (event, ctx) => {
		const threadId = threadIdFor(ctx);
		const messages = (event.messages ?? []) as Array<{ stopReason?: string; errorMessage?: string }>;
		const failed = messages.findLast((message) => message.stopReason === "error");
		if (failed) turnErrors.set(threadId, failed.errorMessage?.trim() || "unknown model or runtime error");
		else turnErrors.delete(threadId);
	});

	// ---------- 命令层 ----------
	pi.registerCommand("ansatz:goal", {
		description: "Set or view the goal for a long-running task (like Codex /goal)",
		getArgumentCompletions: (prefix: string) => {
			const subs = ["set", "view", "clear", "pause", "resume"].filter((s) => s.startsWith(prefix.toLowerCase()));
			return subs.length > 0 ? subs.map((s) => ({ value: s, label: s })) : null;
		},
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			const lower = trimmed.toLowerCase();
			const threadId = threadIdFor(ctx);

			// view（任何状态都展示）
			if (!trimmed || lower === "view") {
				const g = loadGoal(threadId);
				if (!g) {
					ctx.ui.notify("No goal set for this session. Use /ansatz:goal set <objective> to create one.", "info");
					return;
				}
				const items = [
					`Goal: ${g.objective}`,
					`Status: ${g.status}`,
					`Created: ${g.created_at}`,
					`Updated: ${g.updated_at}`,
					`Blocked streak: ${g.blocked_streak}`,
				];
				if (g.blocked_condition) items.push(`Blocking condition: ${g.blocked_condition}`);
				if (g.status_reason) items.push(`Reason: ${g.status_reason}`);
				// A stalled goal is recoverable; say so, otherwise the only discoverable
				// exit looks like `clear`, which discards the objective and its history.
				if (g.status === "blocked" || g.status === "paused") {
					items.push(`Next: /ansatz:goal resume to continue, or /ansatz:goal clear to abandon.`);
				}
				if (ctx.hasUI) {
					await ctx.ui.select("Current Goal", items);
				} else {
					ctx.ui.notify(items.join("\n"), "info");
				}
				return;
			}

			// clear
			if (lower === "clear" || lower.startsWith("clear ")) {
				const reason = trimmed.slice("clear".length).trim();
				const g = archiveGoal(threadId, reason);
				if (!g) {
					ctx.ui.notify("No goal to clear.", "info");
					return;
				}
				// archiveGoal leaves terminal goals untouched, so do not claim otherwise.
				if (g.status !== "abandoned") {
					ctx.ui.notify(`Goal is already ${g.status}; nothing to clear.`, "info");
					return;
				}
				ctx.ui.notify("Goal cleared (abandoned).", "info");
				return;
			}

			// pause
			if (lower === "pause") {
				const r = pauseGoal(threadId);
				if (!r.ok) {
					ctx.ui.notify(r.error, "error");
					return;
				}
				ctx.ui.notify("Goal paused. Use /ansatz:goal resume to continue.", "info");
				return;
			}

			// resume
			if (lower === "resume") {
				const r = resumeGoal(threadId);
				if (!r.ok) {
					ctx.ui.notify(r.error, "error");
					return;
				}
				ctx.ui.notify("Goal resumed. Starting one explicit continuation turn.", "info");
				// Resume is an explicit user action, so it may start exactly one turn.
				pi.sendUserMessage(continuationPrompt(r.goal));
				return;
			}

			// Set requires an explicit subcommand so a typo cannot start an agent turn.
			const objective = goalSetObjective(trimmed);
			if (!objective) {
				ctx.ui.notify("Usage: /ansatz:goal set <objective>", "error");
				return;
			}
			let goal;
			try {
				goal = createGoal(threadId, objective);
			} catch (e) {
				ctx.ui.notify((e as Error).message, "error");
				return;
			}
			ctx.ui.notify(`Goal set: ${objective}`, "info");
			pi.sendUserMessage(objectiveUpdatedPrompt(goal));
		},
	});

	// ---------- 工具层（模型入口） ----------
	pi.registerTool({
		name: "get_goal",
		label: "Get goal",
		description: "Get the current goal for this session, including status and blocked audit state.",
		parameters: { type: "object", properties: {} },
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const threadId = threadIdFor(ctx);
			return { content: [{ type: "text", text: toolGetGoal(threadId) }], details: {} };
		},
	});

	pi.registerTool({
		name: "create_goal",
		label: "Create goal",
		description: "Create a goal only when explicitly requested by the user or system/developer instructions; do not infer goals from ordinary tasks. Fails if an unfinished goal exists.",
		parameters: {
			type: "object",
			properties: { objective: { type: "string", description: "Required. The concrete objective to start pursuing." } },
			required: ["objective"],
		},
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const threadId = threadIdFor(ctx);
			const objective = (params.objective as string) || "";
			return { content: [{ type: "text", text: toolCreateGoal(threadId, objective) }], details: {} };
		},
	});

	pi.registerTool({
		name: "update_goal",
		label: "Update goal",
		description: "Update the existing goal. Use only to mark the goal achieved (status=complete, when the objective is actually achieved and no required work remains) or genuinely blocked (status=blocked, only after the same blocking condition has been explicitly reported in at least three distinct goal turns). Do not use for hard/slow/uncertain work. Always provide a reason.",
		parameters: {
			type: "object",
			properties: {
				status: { type: "string", enum: ["complete", "blocked"], description: "complete or blocked" },
				reason: { type: "string", description: "Required. Why this status applies." },
			},
			required: ["status", "reason"],
		},
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const threadId = threadIdFor(ctx);
			const status = params.status as "complete" | "blocked";
			const reason = (params.reason as string) || "";
			const text = toolUpdateGoal(threadId, status, reason, turnIdFor(threadId));
			if (text.startsWith("error:")) {
				return { content: [{ type: "text", text }], details: {} };
			}
			ctx.ui.notify(`Goal marked ${status}: ${reason}`, "info");
			return { content: [{ type: "text", text }], details: {} };
		},
	});

	// ---------- 续跑层 ----------
	// Goal continuation is intentionally driven by agent_settled: after each
	// completed model run, an active goal receives one next-turn prompt. A
	// per-thread guard makes this idempotent for a single idle boundary.
	//
	// Budgets are charged here, before the next prompt is queued: this is the
	// only place that knows a continuation turn actually completed. Exhausting a
	// budget parks the goal as paused, so the loop stops without losing the
	// objective.
	pi.on("agent_settled", async (_event, ctx) => {
		const threadId = threadIdFor(ctx);
		const goal = loadGoal(threadId);
		if (!shouldQueueGoalContinuation(goal, queuedContinuations.has(threadId))) return;

		const madeProgress = (turnToolCalls.get(threadId) ?? 0) > 0;
		turnToolCalls.set(threadId, 0);
		const erroredReason = turnErrors.get(threadId);
		turnErrors.delete(threadId);
		const outcome = recordContinuationTurn(threadId, { madeProgress, erroredReason });
		if (!outcome) return;
		if (outcome.kind === "paused") {
			ctx.ui.notify(outcome.reason, erroredReason ? "warning" : "info");
			return;
		}

		queuedContinuations.add(threadId);
		pi.sendUserMessage(continuationPrompt(outcome.goal), { deliverAs: "followUp" });
	});
}
