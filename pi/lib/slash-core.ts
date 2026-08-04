import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type SlashScope = "once" | "session";

export interface SlashDef {
	name: string;
	namespace: string;
	description: string;
	prompt: string;
	scope: SlashScope;
}

function frontmatterValue(frontmatter: string, key: string): string {
	const match = frontmatter.match(new RegExp(`^${key}:[ \\t]*(.*)$`, "m"));
	return match ? match[1].trim() : "";
}

export function loadSlashDefinitions(directory: string): SlashDef[] {
	if (!existsSync(directory)) return [];
	const definitions: SlashDef[] = [];
	for (const filename of readdirSync(directory).sort()) {
		if (!filename.endsWith(".md")) continue;
		const raw = readFileSync(join(directory, filename), "utf8");
		const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
		if (!match) continue;
		const name = frontmatterValue(match[1], "name");
		const description = frontmatterValue(match[1], "description");
		if (!name || !description) continue;
		const scopeValue = frontmatterValue(match[1], "scope");
		const scope: SlashScope = scopeValue === "session" ? "session" : "once";
		definitions.push({
			name,
			namespace: frontmatterValue(match[1], "namespace") || "ansatz",
			description,
			prompt: raw.slice(match[0].length).trim(),
			scope,
		});
	}
	return definitions;
}

export function buildSlashMessage(argumentsText: string): string | null {
	const trimmed = argumentsText.trim();
	return trimmed ? `任务：${trimmed}` : null;
}

export function shouldPersistMode(scope: SlashScope): boolean {
	return scope === "session";
}

export function mergeSlashDefinitions(
	packageDefinitions: SlashDef[],
	homeDefinitions: SlashDef[],
	warn: (message: string) => void,
): SlashDef[] {
	const merged = new Map<string, SlashDef>();
	for (const definition of packageDefinitions) {
		merged.set(`${definition.namespace}:${definition.name}`, definition);
	}
	for (const definition of homeDefinitions) {
		const key = `${definition.namespace}:${definition.name}`;
		if (merged.has(key)) warn(`Home slash override replaces Cyberbrain /${key}`);
		merged.set(key, definition);
	}
	return [...merged.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([, definition]) => definition);
}
