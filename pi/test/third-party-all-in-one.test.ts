import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  discoverModels,
  fetchJsonData,
  mergeLiveModels,
  normalizeModel,
  parseList,
  parsePrice,
  parseTokenCount,
  readCache,
  registerAIHubMix,
  writeCache,
  type DiscoveryCache,
} from "../lib/third-party/aihubmix.ts";
import { availableModel, detailedModel } from "./fixtures.ts";
import { installDeepSeekWebSearch, registerDeepSeekResponses } from "../lib/third-party/deepseek-responses.ts";

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

test("normalizeModel reports GPT-5.6 total context and preserves output/pricing", () => {
  const model = normalizeModel(
    availableModel("gpt-5.6-luna"),
    detailedModel("gpt-5.6-luna", {
      model_name: "GPT 5.6 Luna",
      context_length: 1_050_000,
      max_output: 128_000,
      features: "tools,thinking,structured_outputs",
      input_modalities: "text,image",
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
  assert.equal(model.contextWindow, 1_050_000);
  assert.equal(model.maxTokens, 128_000);
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

test("mergeLiveModels uses exact intersection in availability order", () => {
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

  assert.deepEqual(models.map((model) => model.id), ["second", "first"]);
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


test("registerDeepSeekResponses registers the Responses provider", () => {
  const registrations: Array<{ name: string; config: Record<string, unknown> }> = [];
  registerDeepSeekResponses({ registerProvider: (name: string, config: Record<string, unknown>) => registrations.push({ name, config }) }, {});
  assert.equal(registrations[0].name, "deepseek-responses");
  assert.equal(registrations[0].config.api, "openai-responses");
  assert.equal(registrations[0].config.apiKey, "$DEEPSEEK_API_KEY");
});

test("DeepSeek web search is default-on and can be disabled", () => {
  const handlers: Array<(event: any, ctx: any) => unknown> = [];
  installDeepSeekWebSearch({ on: (_event: string, handler: any) => handlers.push(handler) }, {});
  const payload = { model: "deepseek-v4-flash", input: [], tools: [] };
  const enabled = handlers[0]({ payload }, { model: { provider: "deepseek-responses" } }) as { tools: unknown[] };
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
