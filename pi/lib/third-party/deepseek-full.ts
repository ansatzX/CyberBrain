import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
	defaultModelsJsonPath,
	refreshModelsJsonProvider,
	type ModelsJsonDependencies,
} from "./models-json.ts";

type Registrar = Pick<ExtensionAPI, "registerProvider">;
type HookRegistrar = Pick<ExtensionAPI, "on">;
type Env = Record<string, string | undefined>;

/**
 * Single source of truth for the provider definition.
 *
 * It is shared by the in-process `registerProvider` call and the models.json
 * refresh, so the two can never drift into advertising different models.
 */
export const DEEPSEEK_PROVIDER_ID = "deepseek-full";
export const DEFAULT_DEEPSEEK_PROTOCOL = "anthropic";
export function deepSeekProtocol(env: Env = process.env): "anthropic" | "responses" {
	const protocol = env.CYBERBRAIN_DEEPSEEK_PROTOCOL?.trim().toLowerCase() || DEFAULT_DEEPSEEK_PROTOCOL;
	if (protocol !== "anthropic" && protocol !== "responses") {
		throw new Error("CYBERBRAIN_DEEPSEEK_PROTOCOL must be anthropic or responses");
	}
	return protocol;
}

export function deepSeekProviderConfig(env: Env = process.env) {
	const protocol = deepSeekProtocol(env);
	const compat = protocol === "anthropic"
		? { forceAdaptiveThinking: true, allowEmptySignature: true }
		: undefined;
	// Verified 2026-09-15: https://api-docs.deepseek.com/quick_start/pricing/
	// Pi stores one price per model. Use peak USD / 1M tokens for estimates;
	// actual off-peak rates are half these values.
	const flash = {
		id: "deepseek-flash",
		name: "deepseek-flash",
		reasoning: true,
		input: ["text", "image"],
		contextWindow: 1_000_000,
		maxTokens: 384_000,
		cost: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0 },
		thinkingLevelMap: {
			minimal: null,
			low: "low",
			medium: null,
			high: "high",
			max: "max",
		},
		...(compat ? { compat } : {}),
	};
	return {
		name: "DeepSeek Full · 全功能",
		baseUrl: protocol === "anthropic" ? "https://api.deepseek.com/anthropic" : "https://api.deepseek.com",
		api: protocol === "anthropic" ? "anthropic-messages" : "openai-responses",
		apiKey: "$DEEPSEEK_API_KEY",
		models: [
			flash,
			{
				id: "deepseek-v4-pro",
				name: "deepseek-v4-pro",
				reasoning: true,
				input: ["text"],
				contextWindow: 1_000_000,
				maxTokens: 384_000,
				cost: { input: 1.32, output: 3.96, cacheRead: 0.044, cacheWrite: 0 },
				// Preserve Pro's existing high/max selection.
				thinkingLevelMap: {
					minimal: null,
					low: null,
					medium: null,
					high: "high",
					max: "max",
				},
				...(compat ? { compat } : {}),
			},
		],
	};
}

export function registerDeepSeek(pi: Registrar, env: Env = process.env): void {
	pi.registerProvider(DEEPSEEK_PROVIDER_ID, deepSeekProviderConfig(env));
}

function modelsJsonRefreshEnabled(environment: Env): boolean {
	const flag = environment.CYBERBRAIN_DEEPSEEK_MODELS_JSON_REFRESH?.trim().toLowerCase();
	return flag !== "0" && flag !== "false" && flag !== "off" && flag !== "no";
}

/**
 * Mirror the provider into models.json.
 *
 * `registerProvider` only affects the running pi process, so consumers that
 * read models.json directly never see this provider. Kept separate from
 * `registerDeepSeek` because registration is synchronous and must not
 * become dependent on disk I/O: a failed or slow refresh can never prevent the
 * provider from being usable in-process.
 */
export async function refreshDeepSeekModelsJson(
	environment: Env = process.env,
	dependencies: { modelsJson?: ModelsJsonDependencies; warn?: (message: string) => void } = {},
): Promise<void> {
	if (!modelsJsonRefreshEnabled(environment)) return;
	const warn = dependencies.warn ?? ((message: string) => console.warn(message));
	try {
		await refreshModelsJsonProvider(
			{
				path:
					environment.CYBERBRAIN_DEEPSEEK_MODELS_JSON_PATH?.trim() ||
					defaultModelsJsonPath(environment),
				providerId: DEEPSEEK_PROVIDER_ID,
				config: deepSeekProviderConfig(environment),
				replaceProviderIds: ["deepseek-responses"],
			},
			dependencies.modelsJson,
		);
	} catch (error) {
		warn(
			`DeepSeek models.json refresh failed (provider still registered in-process): ${(error as Error).message}`,
		);
	}
}

export function installDeepSeekWebSearch(pi: HookRegistrar, env: Env = process.env): void {
	const protocol = deepSeekProtocol(env);
	if (env.CYBERBRAIN_DEEPSEEK_WEB_SEARCH === "0") return;
	pi.on("before_provider_request", (event, ctx) => {
		const payload = event.payload as {
			input?: unknown;
			messages?: unknown;
			tools?: Array<{ type?: string; name?: string }>;
			[key: string]: unknown;
		};
		if (!ctx.model || ctx.model.provider !== DEEPSEEK_PROVIDER_ID ||
			!['deepseek-flash', 'deepseek-v4-pro'].includes(String(payload.model))) {
			return undefined;
		}
		const tools = Array.isArray(payload.tools) ? payload.tools : [];
		if (protocol === "anthropic") {
			if (!Array.isArray(payload.messages)) return undefined;
			// Do not collide with either an existing server search or a client tool.
			if (tools.some(tool => tool.name === "web_search" || tool.type?.startsWith("web_search"))) return undefined;
			return { ...payload, tools: [...tools, { type: "web_search_20250305", name: "web_search", max_uses: 3 }] };
		}
		// The official Responses Flash route ignored search in live testing.
		if (payload.model !== "deepseek-v4-pro" || !Array.isArray(payload.input)) return undefined;
		if (tools.some(tool => tool.type === "web_search" || tool.type === "web_search_preview")) return undefined;
		return { ...payload, tools: [...tools, { type: "web_search" }] };
	});
}
