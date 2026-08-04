/**
 * Prompt-as-config slash framework.
 *
 * Each ~/.pi/agent/slashes/*.md file registers /<namespace>:<name>.
 * The prompt is injected once through before_agent_start; command arguments are
 * sent as the user task, avoiding duplicate prompt text in the activating turn.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildSlashMessage,
	loadSlashDefinitions,
	mergeSlashDefinitions,
	shouldPersistMode,
	type SlashDef,
} from "../lib/slash-core.ts";

const PACKAGE_SLASHES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../slashes");
const HOME_SLASHES_DIR = join(homedir(), ".pi", "agent", "slashes");

export default function slashFramework(pi: ExtensionAPI) {
	let activeMode: SlashDef | null = null;
	const definitions = mergeSlashDefinitions(
		loadSlashDefinitions(PACKAGE_SLASHES_DIR),
		loadSlashDefinitions(HOME_SLASHES_DIR),
		(message) => console.warn(message),
	);

	for (const definition of definitions) {
		const commandName = `${definition.namespace}:${definition.name}`;
		pi.registerCommand(commandName, {
			description: definition.description,
			getArgumentCompletions: (prefix: string) => {
				const matches = ["off"].filter((item) => item.startsWith(prefix.toLowerCase()));
				return matches.length > 0 ? matches.map((item) => ({ value: item, label: item })) : null;
			},
			handler: async (args, ctx) => {
				const trimmed = args.trim();
				if (trimmed.toLowerCase() === "off") {
					if (
						activeMode &&
						activeMode.name === definition.name &&
						activeMode.namespace === definition.namespace
					) {
						activeMode = null;
						ctx.ui.notify(`Mode ${commandName} exited.`, "info");
					} else {
						ctx.ui.notify(`Mode ${commandName} is not active.`, "info");
					}
					return;
				}

				activeMode = definition;
				ctx.ui.notify(
					`Mode ${commandName} active (${definition.scope === "session" ? "session" : "one run"}).`,
					"info",
				);
				const message = buildSlashMessage(trimmed);
				if (message) pi.sendUserMessage(message);
			},
		});
	}

	pi.registerCommand("ansatz:mode", {
		description: "Show active slash mode, list available modes, or 'off' to exit",
		getArgumentCompletions: (prefix: string) => {
			const matches = ["off"].filter((item) => item.startsWith(prefix.toLowerCase()));
			return matches.length > 0 ? matches.map((item) => ({ value: item, label: item })) : null;
		},
		handler: async (args, ctx) => {
			if (args.trim().toLowerCase() === "off") {
				if (!activeMode) {
					ctx.ui.notify("No active mode.", "info");
					return;
				}
				const name = `${activeMode.namespace}:${activeMode.name}`;
				activeMode = null;
				ctx.ui.notify(`Mode ${name} exited.`, "info");
				return;
			}
			const lines = [
				activeMode
					? `Active mode: ${activeMode.namespace}:${activeMode.name} (${activeMode.scope})`
					: "Active mode: none",
				"--- Available slashes ---",
				...(definitions.length
					? definitions.map(
							(definition) =>
								`/${definition.namespace}:${definition.name} [${definition.scope}] — ${definition.description}`,
						)
					: ["(none in ~/.pi/agent/slashes/)"]),
			];
			if (ctx.hasUI) await ctx.ui.select("Slash modes", lines);
			else ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	pi.on("before_agent_start", async (event) => {
		if (!activeMode) return undefined;
		return { systemPrompt: `${event.systemPrompt}\n\n${activeMode.prompt}` };
	});

	pi.on("agent_end", async () => {
		if (activeMode && !shouldPersistMode(activeMode.scope)) activeMode = null;
	});
}
