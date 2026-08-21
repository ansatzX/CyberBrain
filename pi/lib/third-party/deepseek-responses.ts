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
export const DEEPSEEK_RESPONSES_PROVIDER_ID = "deepseek-responses";

export function deepSeekResponsesProviderConfig() {
	return {
		name: "DeepSeek (Responses API)",
		baseUrl: "https://api.deepseek.com",
		api: "openai-responses",
		apiKey: "$DEEPSEEK_API_KEY",
		models: [
			{
				id: "deepseek-v4-flash",
				name: "deepseek-v4-flash-response",
				reasoning: true,
				input: ["text"],
				contextWindow: 1_000_000,
				maxTokens: 384_000,
				cost: { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0 },
				// DeepSeek 思考档位映射（Responses API reasoning.effort）：
				// 官方有效档位仅 none/low/high/max；off 默认发 "none"。
				// minimal/medium 置 null 禁用（API 对未知档位静默容忍但并非真实档位），
				// xhigh 对 flash 无意义（坍缩为 high），刻意不提供。
				thinkingLevelMap: {
					minimal: null,
					low: "low",
					medium: null,
					high: "high",
					max: "max",
				},
			},
			{
				id: "deepseek-v4-flash-vision-exp",
				name: "deepseek-v4-flash-vision-exp-response",
				reasoning: true,
				input: ["text", "image"],
				contextWindow: 1_000_000,
				maxTokens: 384_000,
				// 定价与 flash 完全一致（官方已公布）。
				// 图片按尺寸换算为 token，与文本 token 一并按输入单价计费。
				cost: { input: 0.14, output: 0.28, cacheRead: 0.0028, cacheWrite: 0 },
				thinkingLevelMap: {
					minimal: null,
					low: "low",
					medium: null,
					high: "high",
					max: "max",
				},
			},
			{
				id: "deepseek-v4-pro",
				name: "deepseek-v4-pro-response",
				reasoning: true,
				input: ["text"],
				contextWindow: 1_000_000,
				maxTokens: 384_000,
				cost: { input: 0.435, output: 0.87, cacheRead: 0.003625, cacheWrite: 0 },
				// DeepSeek 思考档位映射（Responses API reasoning.effort）：
				// 官方有效档位仅 none/low/high/max；off 默认发 "none"。
				// minimal/medium 置 null 禁用（API 对未知档位静默容忍但并非真实档位）。
				// pro 的 low 请求服务端会映射为 high（非真实独立档位），因此 low 也置 null；
				// xhigh 服务端映射为 max，max 已直接暴露，刻意不重复提供。
				thinkingLevelMap: {
					minimal: null,
					low: null,
					medium: null,
					high: "high",
					max: "max",
				},
			},
		],
	};
}

export function registerDeepSeekResponses(pi: Registrar, _env: Env = process.env): void {
	pi.registerProvider(DEEPSEEK_RESPONSES_PROVIDER_ID, deepSeekResponsesProviderConfig());
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
 * `registerDeepSeekResponses` because registration is synchronous and must not
 * become dependent on disk I/O: a failed or slow refresh can never prevent the
 * provider from being usable in-process.
 */
export async function refreshDeepSeekResponsesModelsJson(
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
				providerId: DEEPSEEK_RESPONSES_PROVIDER_ID,
				config: deepSeekResponsesProviderConfig(),
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
	if (env.CYBERBRAIN_DEEPSEEK_WEB_SEARCH === "0") return;
	pi.on("before_provider_request", (event, ctx) => {
		const payload = event.payload as {
			input?: unknown;
			tools?: Array<{ type?: string }>;
			[key: string]: unknown;
		};
		if (!ctx.model || ctx.model.provider !== "deepseek-responses" || !Array.isArray(payload.input)) {
			return undefined;
		}
		const tools = Array.isArray(payload.tools) ? payload.tools : [];
		if (tools.some((tool) => tool.type === "web_search")) return undefined;
		return { ...payload, tools: [...tools, { type: "web_search" }] };
	});
}
