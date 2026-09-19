import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
	canonicalVendor,
	discoverModels,
	fetchJsonData,
	mergeLiveModels,
	modelVersionKey,
	normalizeModel,
	parseList,
	parsePrice,
	parseTokenCount,
	readCache,
	registerAIHubMix,
	sortModelsByVendor,
	writeCache,
	type DiscoveryCache,
	type ProviderModel,
} from "../lib/third-party/aihubmix.ts";
import { availableModel, detailedModel } from "./fixtures.ts";
import { deepSeekProtocol, deepSeekProviderConfig, installDeepSeekWebSearch, refreshDeepSeekModelsJson, registerDeepSeek } from "../lib/third-party/deepseek-full.ts";
import deepSeekExtension from "../extensions/deepseek-full.ts";
import aihubmixExtension from "../extensions/aihubmix.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const normalizeOptions = {
	priceMultiplier: 1,
	defaultContextWindow: 128_000,
	defaultMaxTokens: 16_384,
};

test("parseList supports ASCII and Chinese separators", () => {
	assert.deepEqual(
		parseList("thinking，tools；reasoning、image|text text"),
		["thinking", "tools", "reasoning", "image", "text"],
	);
});

test("parseList accepts arrays and deduplicates normalized values", () => {
	assert.deepEqual(parseList(["Thinking,TOOLS", "thinking；image"]), [
		"thinking",
		"tools",
		"image",
	]);
});

test("parseTokenCount parses plain and suffixed positive values", () => {
	assert.equal(parseTokenCount("1.05M"), 1_050_000);
	assert.equal(parseTokenCount("128K"), 128_000);
	assert.equal(parseTokenCount("1,050,000"), 1_050_000);
});

test("parseTokenCount rejects missing, invalid, and non-positive values", () => {
	assert.equal(parseTokenCount(undefined), undefined);
	assert.equal(parseTokenCount("not-a-number"), undefined);
	assert.equal(parseTokenCount(0), undefined);
	assert.equal(parseTokenCount(-1), undefined);
});

test("parsePrice accepts non-negative prices and rejects invalid prices", () => {
	assert.equal(parsePrice("1.25", 2), 2.5);
	assert.equal(parsePrice(0, 1000), 0);
	assert.equal(parsePrice(-1, 1), 0);
	assert.equal(parsePrice(undefined, 1), 0);
});

test("normalizeModel uses conservative defaults for unknown zero metadata", () => {
	const model = normalizeModel(
		availableModel("unknown-model"),
		detailedModel("unknown-model", {
			context_length: 0,
			max_output: 0,
		}),
		normalizeOptions,
	);

	assert.equal(model.contextWindow, 128_000);
	assert.equal(model.maxTokens, 16_384);
});

test("normalizeModel recognizes Chinese-separated reasoning and image metadata", () => {
	const model = normalizeModel(
		availableModel("doubao-seed-1-6-thinking"),
		detailedModel("doubao-seed-1-6-thinking", {
			features: "thinking，tools；structured_outputs",
			input_modalities: "text、image",
		}),
		normalizeOptions,
	);

	assert.equal(model.reasoning, true);
	assert.deepEqual(model.input, ["text", "image"]);
});

test("normalizeModel clamps max output below advertised context", () => {
	const model = normalizeModel(
		availableModel("bad-limits"),
		detailedModel("bad-limits", {
			context_length: 32_000,
			max_output: 32_000,
		}),
		normalizeOptions,
	);

	assert.equal(model.maxTokens, 8_000);
	assert.equal(model.contextWindow, 32_000);
});

test("normalizeModel applies codex authoritative context to registered GPT models", () => {
	const advertised: Record<string, number> = {
		"gpt-5.6-sol": 1_050_000,
		"gpt-5.6-terra": 1_050_000,
		"gpt-5.6-luna": 1_050_000,
		"gpt-5.5": 1_050_000,
		"gpt-5.4": 400_000,
		"gpt-5.4-mini": 400_000,
		"gpt-5.2": 400_000,
	};

	for (const [id, contextLength] of Object.entries(advertised)) {
		const model = normalizeModel(
			availableModel(id),
			detailedModel(id, {
				model_name: id,
				context_length: contextLength,
				max_output: 128_000,
				features: "tools,thinking,structured_outputs",
				input_modalities: "text,image",
			}),
			normalizeOptions,
		);
		// Codex registers a 272K working context window for these models.
		assert.equal(model.contextWindow, 272_000, `context for ${id}`);
		assert.equal(model.maxTokens, 128_000, `maxTokens for ${id}`);
	}
});

test("normalizeModel keeps advertised context for unregistered models", () => {
	const model = normalizeModel(
		availableModel("deepseek-v4-flash"),
		detailedModel("deepseek-v4-flash", {
			context_length: 1_000_000,
			max_output: 384_000,
		}),
		normalizeOptions,
	);

	assert.equal(model.contextWindow, 1_000_000);
	assert.equal(model.maxTokens, 384_000);
});

test("normalizeModel GPT-5.6 preserves name and pricing", () => {
	const model = normalizeModel(
		availableModel("gpt-5.6-luna"),
		detailedModel("gpt-5.6-luna", {
			model_name: "GPT 5.6 Luna",
			context_length: 1_050_000,
			max_output: 128_000,
			pricing: {
				input: 1,
				output: 6,
				cache_read: 0.1,
				cache_write: 1.25,
			},
		}),
		normalizeOptions,
	);

	assert.equal(model.name, "GPT 5.6 Luna");
	assert.deepEqual(model.cost, {
		input: 1,
		output: 6,
		cacheRead: 0.1,
		cacheWrite: 1.25,
	});
});

test("normalizeModel keeps genuinely small contexts positive", () => {
	const model = normalizeModel(
		availableModel("small-model"),
		detailedModel("small-model", {
			context_length: 8_000,
			max_output: 2_000,
		}),
		normalizeOptions,
	);

	assert.equal(model.contextWindow, 8_000);
	assert.equal(model.maxTokens, 2_000);
});

test("mergeLiveModels uses exact intersection and groups by vendor", () => {
	const models = mergeLiveModels(
		[
			availableModel("second"),
			availableModel("first"),
			availableModel("second"),
			availableModel("availability-only"),
		],
		[
			detailedModel("first"),
			detailedModel("second"),
			detailedModel("metadata-only"),
		],
		normalizeOptions,
	);

	// Intersection is unchanged: availability-only and metadata-only are dropped,
	// and the duplicate "second" is collapsed. Output is no longer in
	// availability order — these fixtures share one vendor and carry no version
	// digits, so they fall back to the deterministic name tiebreak.
	assert.deepEqual(models.map((model) => model.id), ["first", "second"]);
});

test("models are grouped by vendor, newest version first", () => {
	// Upstream reports every model with the same `created` constant, so ordering
	// has to come from the vendor plus the version embedded in the id.
	const vendorOf = (id: string, owned_by: string) => ({ ...availableModel(id), owned_by });
	const models = mergeLiveModels(
		[
			vendorOf("claude-opus-4-8", "Anthropic"),
			vendorOf("gpt-5.5", "OpenAI"),
			vendorOf("claude-opus-5", "Anthropic"),
			vendorOf("deepseek-v4-flash", "DeepSeek"),
			vendorOf("gpt-5.6-sol", "Openai"),
			vendorOf("claude-sonnet-4-6", "Anthropic"),
			vendorOf("gpt-4o", "OpenAI"),
		],
		[
			detailedModel("claude-opus-4-8"),
			detailedModel("gpt-5.5"),
			detailedModel("claude-opus-5"),
			detailedModel("deepseek-v4-flash"),
			detailedModel("gpt-5.6-sol"),
			detailedModel("claude-sonnet-4-6"),
			detailedModel("gpt-4o"),
		],
		normalizeOptions,
	);

	assert.deepEqual(models.map((model) => model.id), [
		// Both vendors have 3 models, so the size tiebreak falls to the vendor name:
		// "Anthropic" sorts before "OpenAI".
		"claude-opus-5",
		"claude-opus-4-8",
		"claude-sonnet-4-6",
		// "Openai" folds into "OpenAI" rather than forming its own group.
		"gpt-5.6-sol",
		"gpt-5.5",
		"gpt-4o",
		"deepseek-v4-flash",
	]);
});

test("vendor aliases fold and unknown vendors sort last", () => {
	assert.equal(canonicalVendor("Openai"), "OpenAI");
	assert.equal(canonicalVendor("Llama"), "Meta");
	assert.equal(canonicalVendor("Inclusionai"), "InclusionAI");
	assert.equal(canonicalVendor(undefined), "Other");
	assert.equal(canonicalVendor("  "), "Other");
	// An unrecognized vendor is preserved verbatim rather than collapsed.
	assert.equal(canonicalVendor("Mistral"), "Mistral");

	// "Other" is a catch-all, so it stays last even when it is the largest group.
	const model = (id: string): ProviderModel => ({ id }) as ProviderModel;
	const vendors = new Map([
		["a1", "Other"],
		["a2", "Other"],
		["a3", "Other"],
		["b1", "Anthropic"],
	]);
	const sorted = sortModelsByVendor([model("a1"), model("a2"), model("a3"), model("b1")], vendors);
	assert.equal(sorted[0].id, "b1", "a real vendor precedes the catch-all");
	// Within "Other" the version order still applies (a3 > a2 > a1), so assert
	// the group placement rather than one specific trailing id.
	assert.deepEqual(sorted.slice(1).map((entry) => entry.id), ["a3", "a2", "a1"]);
});

test("modelVersionKey compares numeric segments, not text", () => {
	// A lexicographic id compare would put gpt-5.10 before gpt-5.9.
	assert.deepEqual(modelVersionKey("gpt-5.6-sol"), [5.6]);
	assert.deepEqual(modelVersionKey("claude-opus-4-8"), [4, 8]);
	assert.deepEqual(modelVersionKey("auto"), []);

	// Date stamps and parameter counts are not versions. Collecting them
	// naively ranked o1-2024-12-17 and gpt-oss-120b above gpt-5.6 against the
	// real 401-model catalog.
	assert.deepEqual(modelVersionKey("o1-2024-12-17"), [1]);
	assert.deepEqual(modelVersionKey("qwen3-max-2026-01-23"), [3]);
	assert.deepEqual(modelVersionKey("gpt-oss-120b"), []);
});

test("current flagships outrank dated snapshots and sized variants", () => {
	const vendorOf = (id: string) => ({ ...availableModel(id), owned_by: "OpenAI" });
	const ids = ["o1-2024-12-17", "gpt-oss-120b", "gpt-5.6-sol", "gpt-5.5"];
	const models = mergeLiveModels(
		ids.map(vendorOf),
		ids.map((id) => detailedModel(id)),
		normalizeOptions,
	);

	assert.deepEqual(models.map((model) => model.id), [
		"gpt-5.6-sol",
		"gpt-5.5",
		"o1-2024-12-17",
		"gpt-oss-120b",
	]);
});

test("mergeLiveModels rejects a non-empty result with no intersection", () => {
	assert.throws(
		() =>
			mergeLiveModels(
				[availableModel("available")],
				[detailedModel("detailed")],
				normalizeOptions,
			),
		/no matching model IDs/i,
	);
	assert.throws(
		() => mergeLiveModels([availableModel("available")], [], normalizeOptions),
		/no matching model IDs/i,
	);
});

test("cache round-trips for the same origin and is written atomically", async () => {
	const directory = await mkdtemp(join(tmpdir(), "aihubmix-cache-"));
	const path = join(directory, "nested", "models.json");
	const cache: DiscoveryCache = {
		version: 1,
		origin: "https://example.test",
		fetchedAt: "2026-07-21T00:00:00.000Z",
		available: [availableModel("one")],
		metadata: [detailedModel("one")],
	};

	try {
		await writeCache(path, cache);
		assert.deepEqual(await readCache(path, cache.origin), cache);
		assert.deepEqual(await readdir(join(directory, "nested")), ["models.json"]);
		assert.doesNotMatch(await readFile(path, "utf8"), /api[_-]?key|Bearer/i);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("cache rejects version and origin mismatches", async () => {
	const directory = await mkdtemp(join(tmpdir(), "aihubmix-cache-"));
	const path = join(directory, "models.json");

	try {
		await writeFile(
			path,
			JSON.stringify({
				version: 2,
				origin: "https://example.test",
				fetchedAt: "2026-07-21T00:00:00.000Z",
				available: [],
				metadata: [],
			}),
		);
		assert.equal(await readCache(path, "https://example.test"), undefined);

		await writeFile(
			path,
			JSON.stringify({
				version: 1,
				origin: "https://other.test",
				fetchedAt: "2026-07-21T00:00:00.000Z",
				available: [],
				metadata: [],
			}),
		);
		assert.equal(await readCache(path, "https://example.test"), undefined);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("malformed cache is treated as a cache miss", async () => {
	const directory = await mkdtemp(join(tmpdir(), "aihubmix-cache-"));
	const path = join(directory, "models.json");

	try {
		await writeFile(path, "not-json");
		assert.equal(await readCache(path, "https://example.test"), undefined);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

function jsonResponse(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		statusText: status === 200 ? "OK" : "Bad Request",
		headers: { "content-type": "application/json" },
	});
}

const discoveryConfig = {
	origin: "https://example.test",
	apiKey: "secret-key",
	timeoutMs: 50,
	cachePath: "/unused/cache.json",
	normalizeOptions,
};

test("fetchJsonData returns a validated data array", async () => {
	const result = await fetchJsonData(
		"https://example.test/v1/models",
		"secret-key",
		50,
		async () => jsonResponse({ data: [{ id: "one" }] }),
	);
	assert.deepEqual(result, [{ id: "one" }]);
});

test("fetchJsonData bounds HTTP diagnostics and never exposes the API key", async () => {
	await assert.rejects(
		fetchJsonData(
			"https://example.test/v1/models",
			"secret-key",
			50,
			async () =>
				jsonResponse(
					{ error: `secret-key ${"x".repeat(2_000)} secret-key` },
					400,
				),
		),
		(error: Error) => {
			assert.match(error.message, /HTTP 400 Bad Request/);
			assert.ok(error.message.length < 1_200);
			assert.doesNotMatch(error.message, /secret-key/);
			return true;
		},
	);
});

test("fetchJsonData rejects invalid JSON and missing data arrays", async () => {
	await assert.rejects(
		fetchJsonData(
			"https://example.test/v1/models",
			"secret-key",
			50,
			async () => new Response("not-json", { status: 200 }),
		),
		/invalid JSON/i,
	);
	await assert.rejects(
		fetchJsonData(
			"https://example.test/v1/models",
			"secret-key",
			50,
			async () => jsonResponse({ object: "list" }),
		),
		/data array/i,
	);
});

test("fetchJsonData aborts after the configured timeout", async () => {
	const started = Date.now();
	await assert.rejects(
		fetchJsonData(
			"https://example.test/v1/models",
			"secret-key",
			10,
			async (_url, init) =>
				await new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(new DOMException("aborted", "AbortError"));
					});
				}),
		),
		/timed out after 10ms/i,
	);
	assert.ok(Date.now() - started < 1_000);
});

test("fresh complete cache returns immediately without network access", async () => {
	const cache: DiscoveryCache = {
		version: 1,
		origin: discoveryConfig.origin,
		fetchedAt: new Date().toISOString(),
		available: [availableModel("cached")],
		metadata: [detailedModel("cached")],
	};
	let fetches = 0;
	const models = await discoverModels(discoveryConfig, {
		fetchImpl: async () => {
			fetches++;
			throw new Error("network must not run for fresh cache");
		},
		readCacheImpl: async () => cache,
		writeCacheImpl: async () => assert.fail("fresh cache must not be rewritten"),
		warn: () => undefined,
	});

	assert.equal(fetches, 0);
	assert.deepEqual(models.map((model) => model.id), ["cached"]);
});

test("discovery starts both endpoints concurrently and caches complete results", async () => {
	const pending = new Map<string, (response: Response) => void>();
	const calls: string[] = [];
	const written: DiscoveryCache[] = [];
	const promise = discoverModels(discoveryConfig, {
		fetchImpl: async (input) => {
			const url = String(input);
			calls.push(url);
			return await new Promise<Response>((resolve) => pending.set(url, resolve));
		},
		readCacheImpl: async () => undefined,
		writeCacheImpl: async (_path, cache) => {
			written.push(cache);
		},
		warn: () => undefined,
	});

	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(calls.sort(), [
		"https://example.test/api/v1/models?type=llm",
		"https://example.test/v1/models",
	]);
	pending.get("https://example.test/v1/models")?.(
		jsonResponse({ data: [availableModel("one")] }),
	);
	pending.get("https://example.test/api/v1/models?type=llm")?.(
		jsonResponse({ data: [detailedModel("one")] }),
	);

	assert.deepEqual((await promise).map((model) => model.id), ["one"]);
	assert.equal(written.length, 1);
	assert.deepEqual(written[0].available, [availableModel("one")]);
});

test("discovery uses live availability with cached metadata fallback", async () => {
	const cache: DiscoveryCache = {
		version: 1,
		origin: discoveryConfig.origin,
		fetchedAt: "2026-07-21T00:00:00.000Z",
		available: [availableModel("stale"), availableModel("enriched")],
		metadata: [
			detailedModel("enriched", { context_length: 200_000 }),
			detailedModel("stale"),
		],
	};
	let writes = 0;
	const models = await discoverModels(discoveryConfig, {
		fetchImpl: async (input) =>
			String(input).endsWith("/v1/models")
				? jsonResponse({
						data: [availableModel("enriched"), availableModel("new-default")],
					})
				: jsonResponse({ error: "down" }, 500),
		readCacheImpl: async () => cache,
		writeCacheImpl: async () => {
			writes++;
		},
		warn: () => undefined,
	});

	assert.deepEqual(models.map((model) => model.id), [
		"enriched",
		"new-default",
	]);
	assert.equal(models[0].contextWindow, 200_000);
	assert.equal(models[1].contextWindow, 128_000);
	assert.equal(writes, 0);
});

test("discovery falls back to complete cache when availability fails", async () => {
	const cache: DiscoveryCache = {
		version: 1,
		origin: discoveryConfig.origin,
		fetchedAt: "2026-07-21T00:00:00.000Z",
		available: [availableModel("cached")],
		metadata: [detailedModel("cached")],
	};
	const models = await discoverModels(discoveryConfig, {
		fetchImpl: async (input) =>
			String(input).endsWith("/v1/models")
				? jsonResponse({ error: "down" }, 503)
				: jsonResponse({ data: [detailedModel("live-detail-only")] }),
		readCacheImpl: async () => cache,
		writeCacheImpl: async () => assert.fail("partial data must not be cached"),
		warn: () => undefined,
	});

	assert.deepEqual(models.map((model) => model.id), ["cached"]);
});

test("discovery fails without cache after availability failure", async () => {
	await assert.rejects(
		discoverModels(discoveryConfig, {
			fetchImpl: async () => jsonResponse({ error: "down" }, 503),
			readCacheImpl: async () => undefined,
			writeCacheImpl: async () => undefined,
			warn: () => undefined,
		}),
		/availability.*HTTP 503.*metadata.*HTTP 503/is,
	);
});

test("discovery treats live empty availability as authoritative", async () => {
	const cache: DiscoveryCache = {
		version: 1,
		origin: discoveryConfig.origin,
		fetchedAt: "2026-07-21T00:00:00.000Z",
		available: [availableModel("cached")],
		metadata: [detailedModel("cached")],
	};

	await assert.rejects(
		discoverModels(discoveryConfig, {
			fetchImpl: async (input) =>
				String(input).endsWith("/v1/models")
					? jsonResponse({ data: [] })
					: jsonResponse({ data: [detailedModel("cached")] }),
			readCacheImpl: async () => cache,
			writeCacheImpl: async () => undefined,
			warn: () => undefined,
		}),
		/no available models/i,
	);
});

test("cache write failure warns without discarding live discovery", async () => {
	const warnings: string[] = [];
	const models = await discoverModels(discoveryConfig, {
		fetchImpl: async (input) =>
			String(input).endsWith("/v1/models")
				? jsonResponse({ data: [availableModel("one")] })
				: jsonResponse({ data: [detailedModel("one")] }),
		readCacheImpl: async () => undefined,
		writeCacheImpl: async () => {
			throw new Error("disk full");
		},
		warn: (message) => warnings.push(message),
	});

	assert.deepEqual(models.map((model) => model.id), ["one"]);
	assert.match(warnings.join("\n"), /disk full/);
});

test("registerAIHubMix rejects a missing API key before network access", async () => {
	let fetched = false;
	await assert.rejects(
		registerAIHubMix(
			{ registerProvider: () => assert.fail("must not register") },
			{},
			{
				fetchImpl: async () => {
					fetched = true;
					throw new Error("must not fetch");
				},
			},
		),
		/AIHUBMIX_API_KEY is not set/,
	);
	assert.equal(fetched, false);
});

test("registerAIHubMix discovers and registers the configured provider", async () => {
	const registrations: Array<{ name: string; config: Record<string, unknown> }> = [];
	await registerAIHubMix(
		{
			registerProvider: (name: string, config: Record<string, unknown>) => {
				registrations.push({ name, config });
			},
		},
		{
			AIHUBMIX_API_KEY: "secret-key",
			AIHUBMIX_ORIGIN: "https://example.test/",
			AIHUBMIX_DISCOVERY_TIMEOUT_MS: "1234",
			AIHUBMIX_PRICE_MULTIPLIER: "2",
			AIHUBMIX_CACHE_PATH: "/custom/cache.json",
			// registerAIHubMix also refreshes models.json. Without this the test
			// writes its fixtures into the developer's real ~/.pi/agent/models.json.
			AIHUBMIX_MODELS_JSON_REFRESH: "off",
		},
		{
			fetchImpl: async (input) =>
				String(input).endsWith("/v1/models")
					? jsonResponse({ data: [availableModel("one")] })
					: jsonResponse({
							data: [
								detailedModel("one", {
									pricing: { input: 1, output: 2 },
								}),
							],
						}),
			readCacheImpl: async () => undefined,
			writeCacheImpl: async (path) => {
				assert.equal(path, "/custom/cache.json");
			},
			warn: () => undefined,
		},
	);

	assert.equal(registrations.length, 1);
	assert.equal(registrations[0].name, "aihubmix");
	assert.equal(registrations[0].config.name, "AIHubMix");
	assert.equal(registrations[0].config.baseUrl, "https://example.test/v1");
	assert.equal(registrations[0].config.apiKey, "$AIHUBMIX_API_KEY");
	assert.equal(registrations[0].config.api, "openai-completions");
	const models = registrations[0].config.models as Array<{
		contextWindow: number;
		cost: { input: number; output: number };
	}>;
	assert.equal(models[0].contextWindow, 128_000);
	assert.deepEqual(models[0].cost, {
		input: 2,
		output: 4,
		cacheRead: 0,
		cacheWrite: 0,
	});
});

test("registerAIHubMix normalizes invalid environment options", async () => {
	const registrations: Array<Record<string, unknown>> = [];
	await registerAIHubMix(
		{
			registerProvider: (_name: string, config: Record<string, unknown>) => {
				registrations.push(config);
			},
		},
		{
			AIHUBMIX_API_KEY: "secret-key",
			AIHUBMIX_DISCOVERY_TIMEOUT_MS: "invalid",
			AIHUBMIX_PRICE_MULTIPLIER: "-2",
			AIHUBMIX_CACHE_PATH: "/custom/cache.json",
			AIHUBMIX_MODELS_JSON_REFRESH: "off",
		},
		{
			fetchImpl: async (input, init) => {
				assert.ok(init?.signal);
				return String(input).endsWith("/v1/models")
					? jsonResponse({ data: [availableModel("one")] })
					: jsonResponse({ data: [detailedModel("one")] });
			},
			readCacheImpl: async () => undefined,
			writeCacheImpl: async () => undefined,
			warn: () => undefined,
		},
	);

	const model = (registrations[0].models as Array<{ contextWindow: number }>)[0];
	assert.equal(model.contextWindow, 128_000);
});


test("registerDeepSeek registers exactly Flash and Pro", () => {
	const registrations: Array<{ name: string; config: Record<string, unknown> }> = [];
	registerDeepSeek({ registerProvider: (name, config) => registrations.push({ name, config }) }, {});
	assert.equal(registrations[0].name, "deepseek-full");
	assert.equal(registrations[0].config.name, "DeepSeek Full · 全功能");
	assert.equal(registrations[0].config.api, "anthropic-messages");
	assert.equal(registrations[0].config.apiKey, "$DEEPSEEK_API_KEY");
	const models = registrations[0].config.models as ProviderModel[];
	assert.deepEqual(models.map(model => model.id), [
		"deepseek-flash", "deepseek-v4-pro",
	]);
	for (const model of models) {
		assert.equal(model.name, model.id);
		assert.equal(model.contextWindow, 1_000_000);
		assert.equal(model.maxTokens, 384_000);
		assert.equal(model.reasoning, true);
	}
	for (const flash of models.slice(0, 1)) {
		assert.deepEqual(flash.input, ["text", "image"]);
		assert.deepEqual(flash.cost, { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0 });
		assert.deepEqual((flash as any).thinkingLevelMap, {
			off: "none", minimal: null, low: "low", medium: null, high: "high", xhigh: null, max: "max",
		});
	}
	assert.deepEqual(models[1].input, ["text"]);
	assert.deepEqual(models[1].cost, { input: 1.32, output: 3.96, cacheRead: 0.044, cacheWrite: 0 });
	assert.deepEqual((models[1] as any).thinkingLevelMap, {
		off: "none", minimal: null, low: "low", medium: null, high: "high", xhigh: null, max: "max",
	});
});

test("DeepSeek exposes exactly off/low/high/max for both models and protocols", () => {
	for (const protocol of ["anthropic", "responses"]) {
		for (const model of deepSeekProviderConfig({ CYBERBRAIN_DEEPSEEK_PROTOCOL: protocol }).models) {
			assert.deepEqual(model.thinkingLevelMap, {
				off: "none", minimal: null, low: "low", medium: null,
				high: "high", xhigh: null, max: "max",
			});
		}
	}
});

test("aihubmix extension skips startup without a nonempty key", async () => {
	const warnings: string[] = [];
	const originalWarn = console.warn;
	const originalKey = process.env.AIHUBMIX_API_KEY;
	console.warn = ((message: unknown) => {
		warnings.push(String(message));
	}) as typeof console.warn;
	delete process.env.AIHUBMIX_API_KEY;
	try {
		await aihubmixExtension({
			registerProvider: () => assert.fail("must not register"),
		} as unknown as ExtensionAPI);
		process.env.AIHUBMIX_API_KEY = "   ";
		await aihubmixExtension({
			registerProvider: () => assert.fail("must not register"),
		} as unknown as ExtensionAPI);
	} finally {
		console.warn = originalWarn;
		if (originalKey === undefined) delete process.env.AIHUBMIX_API_KEY;
		else process.env.AIHUBMIX_API_KEY = originalKey;
	}

	// 缺 key 只降级为「provider 不可用」：不抛错（pi 不再报 Failed to load extension）
	assert.deepEqual(warnings, []);
});

test("deepseek extension registers without any environment keys", async () => {
	const providers: string[] = [];
	const events: string[] = [];
	const pi = {
		registerProvider: (name: string) => providers.push(name),
		on: (event: string) => events.push(event),
	};
	// 扩展入口会刷新真实的 ~/.pi/agent/models.json，而它直接读 process.env，
	// 所以只能在调用前后包住 kill switch，否则测试会写脏开发者的配置。
	const previous = process.env.CYBERBRAIN_DEEPSEEK_MODELS_JSON_REFRESH;
	process.env.CYBERBRAIN_DEEPSEEK_MODELS_JSON_REFRESH = "off";
	try {
		// 隔离性回归：aihubmix 因缺 AIHUBMIX_API_KEY 直接失效时，
		// deepseek 扩展必须照常注册（pi 按扩展文件隔离）。
		await deepSeekExtension(pi as never);
	} finally {
		if (previous === undefined) delete process.env.CYBERBRAIN_DEEPSEEK_MODELS_JSON_REFRESH;
		else process.env.CYBERBRAIN_DEEPSEEK_MODELS_JSON_REFRESH = previous;
	}
	assert.deepEqual(providers, ["deepseek-full"]);
	assert.ok(events.includes("before_provider_request"), "web search hook must be installed");
});

test("deepseek models.json refresh mirrors the registered provider", async () => {
	const dir = await mkdtemp(join(tmpdir(), "deepseek-models-json-"));
	try {
		const path = join(dir, "models.json");
		await refreshDeepSeekModelsJson({
			CYBERBRAIN_DEEPSEEK_MODELS_JSON_PATH: path,
		});

		const written = JSON.parse(await readFile(path, "utf8"));
		const mirrored = written.providers["deepseek-full"];
		// models.json 必须与进程内注册的配置逐字一致，否则两条路径会漂移。
		const registrations: Array<{ name: string; config: Record<string, unknown> }> = [];
		registerDeepSeek({
			registerProvider: (name: string, config: Record<string, unknown>) =>
				registrations.push({ name, config }),
		}, {});
		assert.deepEqual(mirrored, registrations[0].config);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("deepseek models.json refresh honors its kill switch", async () => {
	const dir = await mkdtemp(join(tmpdir(), "deepseek-models-json-off-"));
	try {
		const path = join(dir, "models.json");
		await refreshDeepSeekModelsJson({
			CYBERBRAIN_DEEPSEEK_MODELS_JSON_PATH: path,
			CYBERBRAIN_DEEPSEEK_MODELS_JSON_REFRESH: "off",
		});
		assert.equal(existsSync(path), false, "kill switch 必须完全阻止写入");
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("deepseek models.json refresh failure never blocks registration", async () => {
	const warnings: string[] = [];
	// 指向一个不可写的路径：刷新失败只能告警，不得抛出。
	await refreshDeepSeekModelsJson(
		{ CYBERBRAIN_DEEPSEEK_MODELS_JSON_PATH: "/proc/nonexistent/models.json" },
		{ warn: (message: string) => warnings.push(message) },
	);
	assert.equal(warnings.length, 1, "失败必须被捕获并告警");
	assert.match(warnings[0], /still registered in-process/);
});

test("DeepSeek protocol defaults to Anthropic and supports explicit Responses", () => {
	assert.equal(deepSeekProtocol({}), "anthropic");
	assert.equal(deepSeekProviderConfig({}).baseUrl, "https://api.deepseek.com/anthropic");
	const responses = deepSeekProviderConfig({ CYBERBRAIN_DEEPSEEK_PROTOCOL: " responses " });
	assert.equal(responses.api, "openai-responses");
	assert.equal(responses.baseUrl, "https://api.deepseek.com");
	assert.ok(responses.models.every(model => !("compat" in model)));
	assert.throws(() => deepSeekProviderConfig({ CYBERBRAIN_DEEPSEEK_PROTOCOL: "invalid" }), /anthropic or responses/);
});

test("DeepSeek Anthropic search supports both models without mutation or duplicate tools", () => {
	const handlers: Array<(event: any, ctx: any) => any> = [];
	installDeepSeekWebSearch({ on: (_event: string, handler: any) => handlers.push(handler) }, {});
	for (const model of ["deepseek-flash", "deepseek-v4-pro"]) {
		const ctx = { model: { provider: "deepseek-full" } };
		const payload = { model, messages: [], tools: [{ name: "read", input_schema: { type: "object" } }] };
		const next = handlers[0]({ payload }, ctx);
		assert.deepEqual(next.tools, [...payload.tools, { type: "web_search_20250305", name: "web_search", max_uses: 3 }]);
		assert.equal(payload.tools.length, 1);
		assert.equal(handlers[0]({ payload: next }, ctx), undefined);
		assert.equal(handlers[0]({ payload: { ...payload, tools: [{ name: "web_search", input_schema: {} }] } }, ctx), undefined);
		assert.equal(handlers[0]({ payload }, { model: { provider: "deepseek" } }), undefined);
		assert.equal(handlers[0]({ payload: { model, input: [] } }, ctx), undefined);
	}
});

test("DeepSeek catalog migrates the legacy provider while preserving built-in DeepSeek", async () => {
	const dir = await mkdtemp(join(tmpdir(), "deepseek-migration-"));
	try {
		const path = join(dir, "models.json");
		const original = { providers: { deepseek: { custom: true }, "deepseek-responses": { old: true } }, extra: 42 };
		await writeFile(path, JSON.stringify(original));
		for (const protocol of ["anthropic", "responses"]) {
			await refreshDeepSeekModelsJson({ CYBERBRAIN_DEEPSEEK_MODELS_JSON_PATH: path, CYBERBRAIN_DEEPSEEK_PROTOCOL: protocol });
			const actual = JSON.parse(await readFile(path, "utf8"));
			assert.equal(actual.providers["deepseek-responses"], undefined);
			assert.deepEqual(actual.providers.deepseek, original.providers.deepseek);
			assert.equal(actual.extra, 42);
			assert.deepEqual(actual.providers["deepseek-full"], deepSeekProviderConfig({ CYBERBRAIN_DEEPSEEK_PROTOCOL: protocol }));
		}
	} finally { await rm(dir, { recursive: true, force: true }); }
});

test("DeepSeek Pro web search is default-on and can be disabled", () => {
	const handlers: Array<(event: any, ctx: any) => unknown> = [];
	installDeepSeekWebSearch({ on: (_event: string, handler: any) => handlers.push(handler) }, { CYBERBRAIN_DEEPSEEK_PROTOCOL: "responses" });
	const payload = { model: "deepseek-v4-pro", input: [], tools: [] };
	const enabled = handlers[0]({ payload }, { model: { provider: "deepseek-full" } }) as { tools: unknown[] };
	assert.deepEqual(enabled.tools, [{ type: "web_search" }]);

	const disabled: unknown[] = [];
	installDeepSeekWebSearch({ on: (_event: string, handler: any) => disabled.push(handler) }, { CYBERBRAIN_DEEPSEEK_WEB_SEARCH: "0" });
	assert.equal(disabled.length, 0);
});

test("DeepSeek web search ignores every other provider", () => {
	const handlers: Array<(event: any, ctx: any) => unknown> = [];
	installDeepSeekWebSearch({ on: (_event: string, handler: any) => handlers.push(handler) }, {});
	const payload = { model: "gpt-5.6-sol", input: [], tools: [] };
	assert.equal(handlers[0]({ payload }, { model: { provider: "aihubmix" } }), undefined);
});

test("DeepSeek Flash and its legacy aliases do not receive web search", () => {
	const handlers: Array<(event: any, ctx: any) => unknown> = [];
	installDeepSeekWebSearch({ on: (_event: string, handler: any) => handlers.push(handler) }, {});
	for (const model of ["deepseek-flash", "deepseek-v4-flash", "deepseek-v4-flash-vision-exp"]) {
		const payload = { model, input: [], tools: [{ type: "function", name: "read" }] };
		assert.equal(handlers[0]({ payload }, { model: { provider: "deepseek-full" } }), undefined);
		assert.deepEqual(payload.tools, [{ type: "function", name: "read" }]);
	}
});
