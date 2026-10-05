import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
	defaultModelsJsonPath,
	refreshModelsJsonProvider,
} from "../lib/third-party/models-json.ts";
import {
	fetchOriginModels,
	rebaseNativeProvider,
	resolveProtocol,
} from "../lib/third-party/aihubmix.ts";
import { availableModel, detailedModel, runAIHubMix } from "./fixtures.ts";

function providerConfig(models: unknown[] = [{ id: "m1", name: "M1" }]) {
	return {
		name: "AIHubMix",
		baseUrl: "https://example.test/v1",
		apiKey: "$AIHUBMIX_API_KEY",
		api: "openai-completions",
		models,
	};
}

test("independent processes preserve every provider during overlapping refreshes", async () => {
	await withTempDir(async (dir) => {
		const path = join(dir, "models.json");
		await writeFile(
			path,
			JSON.stringify({ providers: {}, userSetting: "keep" }),
		);
		const writer = fileURLToPath(
			new URL("./fixtures/models-json-writer.ts", import.meta.url),
		);
		await Promise.all(
			["a", "b", "c", "d"].map((id) =>
				promisify(execFile)(process.execPath, [writer, path, id]),
			),
		);
		const result = JSON.parse(await readFile(path, "utf8"));
		assert.deepEqual(Object.keys(result.providers).sort(), [
			"a",
			"b",
			"c",
			"d",
		]);
		assert.equal(result.userSetting, "keep");
		assert.ok(
			!(await readdir(dir)).some(
				(name) => name.endsWith(".lock") || name.endsWith(".tmp"),
			),
		);
	});
});

test("failed backup leaves original untouched and releases the writer lock", async () => {
	await withTempDir(async (dir) => {
		const path = join(dir, "models.json");
		const original = JSON.stringify({ providers: {}, userSetting: "keep" });
		await writeFile(path, original);
		await assert.rejects(
			refreshModelsJsonProvider(
				{ path, providerId: "a", config: providerConfig() },
				{
					copyFileImpl: async () => {
						throw new Error("backup denied");
					},
				},
			),
			/backup denied/,
		);
		assert.equal(await readFile(path, "utf8"), original);
		await refreshModelsJsonProvider({
			path,
			providerId: "b",
			config: providerConfig(),
		});
		assert.ok(JSON.parse(await readFile(path, "utf8")).providers.b);
	});
});

async function withTempDir(run: (dir: string) => Promise<void>) {
	const dir = await mkdtemp(join(tmpdir(), "models-json-test-"));
	try {
		await run(dir);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

test("defaultModelsJsonPath honors PI_CODING_AGENT_DIR and falls back to ~/.pi/agent", () => {
	assert.equal(
		defaultModelsJsonPath({ PI_CODING_AGENT_DIR: "/custom/agent" }),
		"/custom/agent/models.json",
	);
	assert.match(defaultModelsJsonPath({}), /\.pi\/agent\/models\.json$/);
});

test("creates models.json when the file does not exist", async () => {
	await withTempDir(async (dir) => {
		const path = join(dir, "models.json");
		const result = await refreshModelsJsonProvider({
			path,
			providerId: "aihubmix",
			config: providerConfig(),
		});
		assert.equal(result.status, "created");
		const written = JSON.parse(await readFile(path, "utf8"));
		assert.equal(written.providers.aihubmix.baseUrl, "https://example.test/v1");
		assert.equal(written.providers.aihubmix.apiKey, "$AIHUBMIX_API_KEY");
		assert.equal(written.providers.aihubmix.models.length, 1);
	});
});

test("preserves other providers and unknown top-level keys", async () => {
	await withTempDir(async (dir) => {
		const path = join(dir, "models.json");
		await writeFile(
			path,
			JSON.stringify(
				{
					providers: {
						"deepseek-responses": { baseUrl: "https://api.deepseek.com" },
					},
					someFutureKey: { nested: [1, 2, 3] },
				},
				null,
				2,
			),
		);
		const result = await refreshModelsJsonProvider({
			path,
			providerId: "aihubmix",
			config: providerConfig(),
		});
		assert.equal(result.status, "updated");
		const written = JSON.parse(await readFile(path, "utf8"));
		assert.equal(
			written.providers["deepseek-responses"].baseUrl,
			"https://api.deepseek.com",
		);
		assert.deepEqual(written.someFutureKey, { nested: [1, 2, 3] });
		assert.ok(written.providers.aihubmix);
	});
});

test("returns unchanged and performs no write when content is identical", async () => {
	await withTempDir(async (dir) => {
		const path = join(dir, "models.json");
		await refreshModelsJsonProvider({
			path,
			providerId: "aihubmix",
			config: providerConfig(),
		});

		let writes = 0;
		const { writeFile: realWriteFile } = await import("node:fs/promises");
		const result = await refreshModelsJsonProvider(
			{ path, providerId: "aihubmix", config: providerConfig() },
			{
				writeFileImpl: (async (...args: unknown[]) => {
					writes += 1;
					return (realWriteFile as (...a: unknown[]) => Promise<void>)(...args);
				}) as typeof realWriteFile,
			},
		);
		assert.equal(result.status, "unchanged");
		assert.equal(writes, 0);
	});
});

test("comparison ignores key ordering inside the provider config", async () => {
	await withTempDir(async (dir) => {
		const path = join(dir, "models.json");
		const config = providerConfig();
		await refreshModelsJsonProvider({ path, providerId: "aihubmix", config });

		const reordered: Record<string, unknown> = {};
		for (const key of Object.keys(config).reverse()) {
			reordered[key] = (config as Record<string, unknown>)[key];
		}
		const result = await refreshModelsJsonProvider({
			path,
			providerId: "aihubmix",
			config: reordered,
		});
		assert.equal(result.status, "unchanged");
	});
});

test("refuses to touch malformed JSON and leaves the file byte-identical", async () => {
	await withTempDir(async (dir) => {
		const path = join(dir, "models.json");
		const original = "{ not json !!!";
		await writeFile(path, original);
		await assert.rejects(
			refreshModelsJsonProvider({
				path,
				providerId: "aihubmix",
				config: providerConfig(),
			}),
			/不是合法 JSON/,
		);
		assert.equal(await readFile(path, "utf8"), original);
	});
});

test("refuses a non-object providers field", async () => {
	await withTempDir(async (dir) => {
		const path = join(dir, "models.json");
		const original = JSON.stringify({ providers: ["oops"] });
		await writeFile(path, original);
		await assert.rejects(
			refreshModelsJsonProvider({
				path,
				providerId: "aihubmix",
				config: providerConfig(),
			}),
			/providers 字段不是对象/,
		);
		assert.equal(await readFile(path, "utf8"), original);
	});
});

test("rejects invalid provider configs before touching the file", async () => {
	await withTempDir(async (dir) => {
		const path = join(dir, "models.json");
		await assert.rejects(
			refreshModelsJsonProvider({
				path,
				providerId: "aihubmix",
				config: { ...providerConfig(), models: [] },
			}),
			/models 为空/,
		);
		await assert.rejects(
			refreshModelsJsonProvider({
				path,
				providerId: "aihubmix",
				config: { ...providerConfig(), baseUrl: "" },
			}),
			/baseUrl/,
		);
		await assert.rejects(
			refreshModelsJsonProvider({
				path,
				providerId: "aihubmix",
				config: providerConfig([{ name: "no id" }]),
			}),
			/没有 id/,
		);
		assert.equal(
			await readFile(path, "utf8").catch((e: NodeJS.ErrnoException) => e.code),
			"ENOENT",
		);
	});
});

test("writes atomically and leaves no temp files behind", async () => {
	await withTempDir(async (dir) => {
		const path = join(dir, "models.json");
		await refreshModelsJsonProvider({
			path,
			providerId: "aihubmix",
			config: providerConfig(),
		});
		const entries = await readdir(dir);
		assert.deepEqual(
			entries.filter((name) => name.includes(".tmp")),
			[],
		);
		assert.ok(entries.includes("models.json"));
	});
});

test("creates a .bak copy of the previous file on update", async () => {
	await withTempDir(async (dir) => {
		const path = join(dir, "models.json");
		await refreshModelsJsonProvider({
			path,
			providerId: "aihubmix",
			config: providerConfig([{ id: "old-model" }]),
		});
		await refreshModelsJsonProvider({
			path,
			providerId: "aihubmix",
			config: providerConfig([{ id: "new-model" }]),
		});
		const backup = JSON.parse(await readFile(`${path}.bak`, "utf8"));
		assert.equal(backup.providers.aihubmix.models[0].id, "old-model");
		const current = JSON.parse(await readFile(path, "utf8"));
		assert.equal(current.providers.aihubmix.models[0].id, "new-model");
	});
});

test("registerAIHubMix refreshes models.json with discovered models", async () => {
	await withTempDir(async (dir) => {
		const modelsJsonPath = join(dir, "models.json");
		const registrations: unknown[] = [];
		const reloads = await runAIHubMix(
			{
				registerProvider: (name, config) => {
					registrations.push({ name, config });
				},
			},
			{
				AIHUBMIX_ORIGIN: "https://example.test",
				AIHUBMIX_CACHE_PATH: join(dir, "cache.json"),
				AIHUBMIX_MODELS_JSON_PATH: modelsJsonPath,
			},
			{
				fetchImpl: async (input, init) => {
					assert.equal(
						new Headers(init?.headers).get("Authorization"),
						"Bearer pi-stored-test-key",
					);
					return String(input).endsWith("/v1/models")
						? jsonResponse({
								data: [availableModel("one"), availableModel("two")],
							})
						: jsonResponse({
								data: [detailedModel("one"), detailedModel("two")],
							});
				},
				readCacheImpl: async () => undefined,
				writeCacheImpl: async () => undefined,
				warn: () => undefined,
			},
		);

		assert.equal(reloads, 1);
		assert.deepEqual(registrations, []);
		const written = JSON.parse(await readFile(modelsJsonPath, "utf8"));
		const provider = written.providers.aihubmix;
		assert.equal(provider.name, "AIHubMix");
		// Per-model routes carry the protocol; a provider-level baseUrl/api would
		// flatten every model onto one endpoint.
		assert.equal("baseUrl" in provider, false);
		assert.equal("api" in provider, false);
		assert.equal("apiKey" in provider, false);
		assert.deepEqual(
			provider.models.map((model: { id: string }) => model.id),
			["one", "two"],
		);
		for (const model of provider.models) {
			assert.equal(model.api, "openai-completions");
			assert.equal(model.baseUrl, "https://example.test/v1");
		}
	});
});

test("registerAIHubMix warns without failing when models.json refresh fails", async () => {
	await withTempDir(async (dir) => {
		const warnings: string[] = [];
		const registrations: string[] = [];
		await runAIHubMix(
			{
				registerProvider: (name: string) => {
					registrations.push(name);
				},
			},
			{
				AIHUBMIX_ORIGIN: "https://example.test",
				AIHUBMIX_CACHE_PATH: join(dir, "cache.json"),
				// 指向一个目录 → readFile 失败 → 刷新走告警路径
				AIHUBMIX_MODELS_JSON_PATH: dir,
			},
			{
				fetchImpl: async (input) =>
					String(input).endsWith("/v1/models")
						? jsonResponse({ data: [availableModel("one")] })
						: jsonResponse({ data: [detailedModel("one")] }),
				readCacheImpl: async () => undefined,
				writeCacheImpl: async () => undefined,
				warn: (message) => warnings.push(message),
			},
		);

		assert.deepEqual(registrations, []);
		assert.ok(
			warnings.some((message) =>
				message.includes("models.json refresh failed"),
			),
		);
	});
});

function nativeModel(id: string, api: string, baseUrl: string) {
	return {
		id,
		name: id,
		api,
		provider: "aihubmix",
		baseUrl,
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 100,
		maxTokens: 10,
	};
}

test("registerAIHubMix skips discovery and leaves models.json untouched when refresh is disabled", async () => {
	await withTempDir(async (dir) => {
		const modelsJsonPath = join(dir, "models.json");
		const reloads = await runAIHubMix(
			{ registerProvider: () => undefined },
			{
				AIHUBMIX_ORIGIN: "https://example.test",
				AIHUBMIX_CACHE_PATH: join(dir, "cache.json"),
				AIHUBMIX_MODELS_JSON_PATH: modelsJsonPath,
				AIHUBMIX_MODELS_JSON_REFRESH: "off",
			},
			{
				fetchImpl: async () => assert.fail("must not fetch"),
				readCacheImpl: async () => assert.fail("must not read cache"),
				warn: () => undefined,
			},
		);
		assert.equal(reloads, 0);
		await assert.rejects(readFile(modelsJsonPath, "utf8"), { code: "ENOENT" });
	});
});

test("registerAIHubMix rebases a native provider and keeps its protocol routing", async () => {
	await withTempDir(async (dir) => {
		const modelsJsonPath = join(dir, "models.json");
		const nativeModels = [
			nativeModel(
				"chat-model",
				"openai-completions",
				"https://aihubmix.com/v1",
			),
			nativeModel("claude-model", "anthropic-messages", "https://aihubmix.com"),
			nativeModel(
				"gemini-model",
				"google-generative-ai",
				"https://aihubmix.com/gemini/v1beta",
			),
		];
		let wrapped: any;
		const reloads = await runAIHubMix(
			{ registerProvider: () => undefined },
			{
				AIHUBMIX_ORIGIN: "https://example.test",
				AIHUBMIX_MODELS_JSON_PATH: modelsJsonPath,
			},
			{
				fetchImpl: async () => assert.fail("must not fetch"),
				readCacheImpl: async () => assert.fail("must not read cache"),
				warn: () => undefined,
			},
			"",
			{
				id: "aihubmix",
				name: "AIHubMix",
				getModels: () => nativeModels,
			},
			(provider) => {
				wrapped = provider;
			},
		);
		assert.equal(reloads, 0);
		assert.deepEqual(
			wrapped
				.getModels()
				.map((model: any) => [model.id, model.api, model.baseUrl]),
			[
				["chat-model", "openai-completions", "https://example.test/v1"],
				["claude-model", "anthropic-messages", "https://example.test"],
				[
					"gemini-model",
					"google-generative-ai",
					"https://example.test/gemini/v1beta",
				],
			],
		);
		await assert.rejects(readFile(modelsJsonPath, "utf8"), { code: "ENOENT" });
	});
});

test("resolveProtocol picks the family protocol the gateway opened", () => {
	const origin = "https://example.test";
	const chat = { api: "openai-completions", baseUrl: `${origin}/v1` };
	const responses = { api: "openai-responses", baseUrl: `${origin}/v1` };
	const anthropic = { api: "anthropic-messages", baseUrl: origin };
	const gemini = {
		api: "google-generative-ai",
		baseUrl: `${origin}/gemini/v1beta`,
	};

	// Empty endpoints: the gateway's legacy Chat Completions representation.
	assert.deepEqual(resolveProtocol(undefined, origin), chat);
	assert.deepEqual(resolveProtocol(undefined, origin, "claude-opus-5"), chat);

	// Family-aware, capability-gated: the name picks a family only when the
	// gateway actually opened that protocol for the model.
	assert.deepEqual(
		resolveProtocol("chat_completions,claude_api", origin, "claude-opus-5"),
		anthropic,
	);
	assert.deepEqual(
		resolveProtocol(
			"chat_completions,gemini_api,claude_api",
			origin,
			"gemini-3.7-flash",
		),
		gemini,
	);
	assert.deepEqual(
		resolveProtocol(
			"chat_completions,gemini_api,claude_api",
			origin,
			"claude-sonnet-5",
		),
		anthropic,
	);
	// Vendor-prefixed ids resolve their family from the last segment.
	assert.deepEqual(
		resolveProtocol(
			"chat_completions,claude_api",
			origin,
			"anthropic/claude-x",
		),
		anthropic,
	);

	// Responses is used whenever the gateway opens it (the official package
	// lacks this branch entirely).
	assert.deepEqual(
		resolveProtocol("chat_completions,responses", origin, "gpt-5.6-sol"),
		responses,
	);
	assert.deepEqual(
		resolveProtocol("chat_completions,responses,claude_api", origin, "gpt-5.4"),
		responses,
	);
	assert.deepEqual(resolveProtocol("responses", origin), responses);

	// Non-family ids with native routes but no Responses stay on chat while
	// chat is open; without chat they fall back to their native protocol.
	assert.deepEqual(
		resolveProtocol("chat_completions,claude_api", origin, "glm-5.1"),
		chat,
	);
	assert.deepEqual(resolveProtocol("claude_api", origin, "glm-5.1"), anthropic);
	assert.deepEqual(resolveProtocol("gemini_api", origin), gemini);

	// Unknown route tokens fall back to chat instead of dropping the model.
	assert.deepEqual(resolveProtocol("some_future_route", origin), chat);
});

test("fetchOriginModels maps the origin catalog and skips non-LLM entries", async () => {
	const models = await fetchOriginModels(
		"https://example.test",
		new AbortController().signal,
		{
			timeoutMs: 1_000,
			normalizeOptions: {
				priceMultiplier: 1,
				defaultContextWindow: 128_000,
				defaultMaxTokens: 16_384,
			},
			fetchImpl: async (input) => {
				assert.equal(
					String(input),
					"https://example.test/api/v1/models?types=llm",
				);
				return jsonResponse({
					data: [
						detailedModel("chat", { endpoints: "chat_completions" }),
						detailedModel("claude", { endpoints: "claude_api" }),
						detailedModel("gemini", { endpoints: "gemini_api" }),
						detailedModel("responses", { endpoints: "responses" }),
						// chat+responses both open: Responses wins.
						detailedModel("gpt-5.6-sol", {
							endpoints: "chat_completions,responses",
						}),
						// Non-family id with claude_api open: stays on chat.
						detailedModel("glm-5.1", {
							endpoints: "chat_completions,claude_api",
						}),
						detailedModel("embedding", {
							endpoints: "chat_completions",
							types: "embedding",
						}),
					],
				});
			},
		},
	);
	assert.deepEqual(
		models.map((model) => [model.id, model.api, model.baseUrl]),
		[
			["chat", "openai-completions", "https://example.test/v1"],
			["claude", "anthropic-messages", "https://example.test"],
			["gemini", "google-generative-ai", "https://example.test/gemini/v1beta"],
			["responses", "openai-responses", "https://example.test/v1"],
			["gpt-5.6-sol", "openai-responses", "https://example.test/v1"],
			["glm-5.1", "openai-completions", "https://example.test/v1"],
		],
	);
});

test("rebaseNativeProvider rewrites the catalog refresh onto the configured origin", async () => {
	const wrapped = rebaseNativeProvider(
		{
			id: "aihubmix",
			name: "AIHubMix",
			getModels: () => [
				nativeModel(
					"live-chat",
					"openai-completions",
					"https://aihubmix.com/v1",
				),
			],
		} as any,
		"https://example.test",
		{
			timeoutMs: 1_000,
			normalizeOptions: {
				priceMultiplier: 1,
				defaultContextWindow: 128_000,
				defaultMaxTokens: 16_384,
			},
			fetchImpl: async () =>
				jsonResponse({
					data: [detailedModel("live-claude", { endpoints: "claude_api" })],
				}),
		},
	);
	const publications: any[] = [];
	await wrapped.refreshModels!({
		publish: async (publication) => {
			publications.push(publication);
			publication.update?.();
			return true;
		},
		allowNetwork: true,
		signal: new AbortController().signal,
	});
	assert.deepEqual(
		publications[0].persist.models.map((model: any) => [
			model.id,
			model.api,
			model.baseUrl,
		]),
		[["live-claude", "anthropic-messages", "https://example.test"]],
	);
	assert.deepEqual(
		wrapped.getModels().map((model) => [model.id, model.baseUrl]),
		[
			["live-chat", "https://example.test/v1"],
			["live-claude", "https://example.test"],
		],
	);
});

function jsonResponse(payload: unknown): Response {
	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}
