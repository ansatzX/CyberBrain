import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Registrar = Pick<ExtensionAPI, "registerProvider">;
type HookRegistrar = Pick<ExtensionAPI, "on">;
type Env = Record<string, string | undefined>;

export function registerDeepSeekResponses(pi: Registrar, _env: Env = process.env): void {
	pi.registerProvider("deepseek-responses", {
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
				contextWindow: 131072,
				maxTokens: 8192,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			},
		],
	});
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
