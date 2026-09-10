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
 *   - 注入：set / resume 启动首轮；active goal 在 agent_settled 后自动排入一轮 continuation
 *   - 续跑：每个 idle boundary 最多排入一条 follow-up；complete/blocked/pause/clear 时停止
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getSessionThreadId, loadGoal } from "../lib/goal-core.ts";

export default function utilityCommands(pi: ExtensionAPI) {
	async function git(args: string[], cwd: string, timeout: number) {
		const result = await pi.exec("git", args, { cwd, timeout });
		if (result.code !== 0 || result.killed) {
			throw new Error(result.stderr.trim() || (result.killed ? "git timed out or was interrupted" : `git exited with code ${result.code}`));
		}
		return result;
	}
	// ---------- /diff ----------
	pi.registerCommand("ansatz:diff", {
		description: "Show working tree changes overview",
		handler: async (_args, ctx) => {
			try {
				const status = await git(["status", "--short"], ctx.cwd, 8000);
				const stat = await git(["diff", "--stat"], ctx.cwd, 8000);
				const staged = await git(["diff", "--cached", "--stat"], ctx.cwd, 8000);
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
				const branch = await git(["branch", "--show-current"], ctx.cwd, 5000);
				const dirty = await git(["status", "--porcelain"], ctx.cwd, 5000);
				lines.push(`branch: ${branch.stdout.trim() || "(detached)"}`, `dirty files: ${dirty.stdout.trim() ? dirty.stdout.trim().split("\n").length : 0}`);
			} catch (error) {
				lines.push(`git failed: ${(error as Error).message}`);
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
