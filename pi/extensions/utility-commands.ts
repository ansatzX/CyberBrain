/**
 * Cyberbrain Pi utility commands
 *
 * 保留的 harness 工具命令：
 *   /ansatz:diff   — 工作区改动概览
 *   /ansatz:status — git + goal + 会话状态
 *
 * goal 系统已迁移到 extensions/goal.ts（v2）：
 *   - 存储/状态机/校验：lib/goal-core.ts（纯逻辑，可单测）
 *   - 模型入口：get_goal / create_goal / update_goal 工具
 *   - 注入：仅在显式 set / resume 时发送一轮，日常零注入
 *   - active goal 会保留状态；后续工作由用户输入或显式 resume 启动
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getSessionThreadId, loadGoal } from "../lib/goal-core.ts";

export default function utilityCommands(pi: ExtensionAPI) {
	// ---------- /diff ----------
	pi.registerCommand("ansatz:diff", {
		description: "Show working tree changes overview",
		handler: async (_args, ctx) => {
			try {
				const status = await pi.exec("git", ["status", "--short"], { timeout: 8000 });
				const stat = await pi.exec("git", ["diff", "--stat"], { timeout: 8000 });
				const staged = await pi.exec("git", ["diff", "--cached", "--stat"], { timeout: 8000 });
				const parts = [
					`--- git status ---\n${status.stdout.trim() || "(clean)"}`,
					`--- unstaged ---\n${stat.stdout.trim() || "(none)"}`,
					`--- staged ---\n${staged.stdout.trim() || "(none)"}`,
				];
				if (ctx.hasUI) {
					await ctx.ui.select("Working tree", parts.join("\n\n").split("\n"));
				} else {
					ctx.ui.notify(parts.join("\n\n"), "info");
				}
			} catch (e) {
				ctx.ui.notify(`git failed: ${(e as Error).message}`, "error");
			}
		},
	});

	// ---------- /status ----------
	pi.registerCommand("ansatz:status", {
		description: "Show repo, goal, and session status",
		handler: async (_args, ctx) => {
			const lines: string[] = [];
			try {
				const branch = await pi.exec("git", ["branch", "--show-current"], { timeout: 5000 });
				const dirty = await pi.exec("git", ["status", "--porcelain"], { timeout: 5000 });
				lines.push(`branch: ${branch.stdout.trim() || "(detached)"}`, `dirty files: ${dirty.stdout.trim() ? dirty.stdout.trim().split("\n").length : 0}`);
			} catch {
				lines.push("branch: (not a git repo)");
			}
			// goal 状态来自 goal-core（v2）
			const threadId = getSessionThreadId(ctx.sessionManager.getSessionFile());
			const g = loadGoal(threadId);
			if (g && g.status === "active") {
				lines.push(`goal: ACTIVE — ${g.objective} (blocked streak ${g.blocked_streak})`);
			} else if (g) {
				lines.push(`goal: ${g.status} — ${g.objective}`);
			} else {
				lines.push("goal: none");
			}
			const model = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "none";
			lines.push(`session: ${ctx.sessionManager.getSessionFile() || "ephemeral"}`, `model: ${model}`);
			if (ctx.hasUI) {
				await ctx.ui.select("Status", lines);
			} else {
				ctx.ui.notify(lines.join("\n"), "info");
			}
		},
	});
}
