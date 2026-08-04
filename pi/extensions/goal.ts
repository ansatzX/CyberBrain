// goal.ts — goal v2 扩展壳（命令层 + 工具层 + 事件层）
// 架构：goal-core.ts 纯逻辑 + 本文件 pi API 挂接（对齐 codex ext/goal/）

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	loadGoal, createGoal, archiveGoal,
	objectiveUpdatedPrompt, continuationPrompt,
	toolGetGoal, toolCreateGoal, toolUpdateGoal, shouldContinue,
	pauseGoal, resumeGoal, getSessionThreadId, resetBlockedAuditAfterUnblockedTurn,
} from "../lib/goal-core.ts";

export default function goalExtension(pi: ExtensionAPI) {
	const activeTurnIds = new Map<string, string>();
	const threadIdFor = (ctx: { sessionManager: { getSessionFile(): string | undefined } }): string =>
		getSessionThreadId(ctx.sessionManager.getSessionFile());
	const turnIdFor = (threadId: string): string =>
		activeTurnIds.get(threadId) || `untracked-${threadId}`;

	pi.on("turn_start", async (event, ctx) => {
		const threadId = threadIdFor(ctx);
		const previousTurnId = activeTurnIds.get(threadId);
		if (previousTurnId) resetBlockedAuditAfterUnblockedTurn(threadId, previousTurnId);
		activeTurnIds.set(threadId, `${event.timestamp}:${event.turnIndex}`);
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
				ctx.ui.notify("Goal resumed. Auto-continue active again.", "info");
				// 恢复后立即推一轮（对齐 codex resume 后 idle 即续跑）
				pi.sendUserMessage(continuationPrompt(r.goal));
				return;
			}

			// set
			const text = lower.startsWith("set") ? trimmed.slice(3).trim() : trimmed;
			if (!text) {
				ctx.ui.notify("Usage: /ansatz:goal set <objective>", "error");
				return;
			}
			let goal;
			try {
				goal = createGoal(threadId, text);
			} catch (e) {
				ctx.ui.notify((e as Error).message, "error");
				return;
			}
			ctx.ui.notify(`Goal set: ${text}`, "info");
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
		description: "Update the existing goal. Use only to mark the goal achieved (status=complete, when the objective is actually achieved and no required work remains) or genuinely blocked (status=blocked, only after the same blocking condition has recurred for at least three consecutive goal turns). Do not use for hard/slow/uncertain work. Always provide a reason.",
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

	// ---------- 续跑层（对齐 codex on_thread_idle：事件驱动、零间隔） ----------
	pi.on("agent_settled", async (_event, ctx) => {
		const threadId = threadIdFor(ctx);
		const g = loadGoal(threadId);
		if (!g || !shouldContinue(g)) return; // 仅 active 续跑；complete/blocked/abandoned 即停
		ctx.ui.notify("Goal auto-continue: nudging agent", "info");
		pi.sendUserMessage(continuationPrompt(g), { deliverAs: "followUp" });
	});
}
