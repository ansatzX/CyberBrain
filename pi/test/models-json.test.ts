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
import { registerAIHubMix } from "../lib/third-party/aihubmix.ts";
import { availableModel, detailedModel } from "./fixtures.ts";

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
		await writeFile(path, JSON.stringify({ providers: {}, userSetting: "keep" }));
		const writer = fileURLToPath(new URL("./fixtures/models-json-writer.ts", import.meta.url));
		await Promise.all(["a", "b", "c", "d"].map((id) =>
			promisify(execFile)(process.execPath, [writer, path, id])));
		const result = JSON.parse(await readFile(path, "utf8"));
		assert.deepEqual(Object.keys(result.providers).sort(), ["a", "b", "c", "d"]);
		assert.equal(result.userSetting, "keep");
		assert.ok(!(await readdir(dir)).some((name) => name.endsWith(".lock") || name.endsWith(".tmp")));
	});
});

test("failed backup leaves original untouched and releases the writer lock", async () => {
	await withTempDir(async (dir) => {
		const path = join(dir, "models.json");
		const original = JSON.stringify({ providers: {}, userSetting: "keep" });
		await writeFile(path, original);
		await assert.rejects(refreshModelsJsonProvider({ path, providerId: "a", config: providerConfig() }, {
			copyFileImpl: async () => { throw new Error("backup denied"); },
		}), /backup denied/);
		assert.equal(await readFile(path, "utf8"), original);
		await refreshModelsJsonProvider({ path, providerId: "b", config: providerConfig() });
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
			refreshModelsJsonProvider({ path, providerId: "aihubmix", config: providerConfig() }),
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
			refreshModelsJsonProvider({ path, providerId: "aihubmix", config: providerConfig() }),
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
		await refreshModelsJsonProvider({ path, providerId: "aihubmix", config: providerConfig() });
		const entries = await readdir(dir);
		assert.deepEqual(entries.filter((name) => name.includes(".tmp")), []);
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
		const registrations: string[] = [];
		await registerAIHubMix(
			{
				registerProvider: (name: string) => {
					registrations.push(name);
				},
			},
			{
				AIHUBMIX_API_KEY: "secret-key",
				AIHUBMIX_ORIGIN: "https://example.test",
				AIHUBMIX_CACHE_PATH: join(dir, "cache.json"),
				AIHUBMIX_MODELS_JSON_PATH: modelsJsonPath,
			},
			{
				fetchImpl: async (input) =>
					String(input).endsWith("/v1/models")
						? jsonResponse({ data: [availableModel("one"), availableModel("two")] })
						: jsonResponse({
								data: [detailedModel("one"), detailedModel("two")],
							}),
				readCacheImpl: async () => undefined,
				writeCacheImpl: async () => undefined,
				warn: () => undefined,
			},
		);

		assert.deepEqual(registrations, ["aihubmix"]);
		const written = JSON.parse(await readFile(modelsJsonPath, "utf8"));
		const provider = written.providers.aihubmix;
		assert.equal(provider.baseUrl, "https://example.test/v1");
		assert.equal(provider.apiKey, "$AIHUBMIX_API_KEY");
		assert.equal(provider.api, "openai-completions");
		assert.deepEqual(
			provider.models.map((model: { id: string }) => model.id),
			["one", "two"],
		);
	});
});

test("registerAIHubMix still registers when models.json refresh fails", async () => {
	await withTempDir(async (dir) => {
		const warnings: string[] = [];
		const registrations: string[] = [];
		await registerAIHubMix(
			{
				registerProvider: (name: string) => {
					registrations.push(name);
				},
			},
			{
				AIHUBMIX_API_KEY: "secret-key",
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

		assert.deepEqual(registrations, ["aihubmix"]);
		assert.ok(
			warnings.some((message) => message.includes("models.json refresh failed")),
		);
	});
});

test("registerAIHubMix skips models.json refresh when disabled", async () => {
	await withTempDir(async (dir) => {
		const modelsJsonPath = join(dir, "models.json");
		await registerAIHubMix(
			{ registerProvider: () => undefined },
			{
				AIHUBMIX_API_KEY: "secret-key",
				AIHUBMIX_ORIGIN: "https://example.test",
				AIHUBMIX_CACHE_PATH: join(dir, "cache.json"),
				AIHUBMIX_MODELS_JSON_PATH: modelsJsonPath,
				AIHUBMIX_MODELS_JSON_REFRESH: "off",
			},
			{
				fetchImpl: async (input) =>
					String(input).endsWith("/v1/models")
						? jsonResponse({ data: [availableModel("one")] })
						: jsonResponse({ data: [detailedModel("one")] }),
				readCacheImpl: async () => undefined,
				writeCacheImpl: async () => undefined,
				warn: () => undefined,
			},
		);
		assert.equal(
			await readFile(modelsJsonPath, "utf8").catch(
				(error: NodeJS.ErrnoException) => error.code,
			),
			"ENOENT",
		);
	});
});

function jsonResponse(payload: unknown): Response {
	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}
