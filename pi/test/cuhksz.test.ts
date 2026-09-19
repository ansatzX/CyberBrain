import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  KNOWN_MODEL_PARAMS,
  discoverModels,
  fetchAvailableModels,
  isReasoningModel,
  listUnhealthy,
  normalizeAvailable,
  normalizeModel,
  probeModel,
  readCache,
  registerCUHKSZ,
  writeCache,
  type DiscoveryCache,
  type ModelProbe,
} from "../lib/third-party/cuhksz.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { availableModel } from "./fixtures.ts";
import cuhkszExtension from "../extensions/cuhksz.ts";

const normalizeOptions = {
  defaultContextWindow: 262_144,
  defaultMaxTokens: 16_384,
};

// 校验层错误（one-api / vLLM 实测格式）
function probeError(message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status: 400,
    statusText: "Bad Request",
    headers: { "content-type": "application/json" },
  });
}

test("isReasoningModel detects common reasoning markers and ignores others", () => {
  assert.equal(isReasoningModel("glm5.1-ae"), false);
  assert.equal(isReasoningModel("qwen3-30b"), false);
  assert.equal(isReasoningModel("deepseek-v4-pro"), true);
  assert.equal(isReasoningModel("dsv4pro"), true);
  assert.equal(isReasoningModel("qwen3-thinking"), true);
  assert.equal(isReasoningModel("model-r1"), true);
});

test("normalizeModel applies 256K defaults to unknown models", () => {
  const model = normalizeModel(
    availableModel("unknown-local-model"),
    undefined,
    normalizeOptions,
  );

  assert.equal(model.id, "unknown-local-model");
  assert.equal(model.contextWindow, 262_144);
  assert.equal(model.maxTokens, 16_384);
  assert.equal(model.reasoning, false);
  assert.deepEqual(model.input, ["text"]);
  assert.deepEqual(model.cost, {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  });
});

test("normalizeModel applies measured params for known models", () => {
  // 用户配置固定为 256K。
  const glm = normalizeModel(
    availableModel("glm-5-fp8"),
    undefined,
    normalizeOptions,
  );
  assert.equal(glm.contextWindow, 262_144);
  assert.equal(glm.maxTokens, 262_144);
  assert.equal(glm.reasoning, false);
});

test("GLM configured context overrides probe metadata", () => {
  const probe: ModelProbe = {
    id: "glm-5-fp8",
    healthy: true,
    contextWindow: 500_000,
    maxTokens: 500_000,
  };
  const model = normalizeModel(
    availableModel("glm-5-fp8"),
    probe,
    normalizeOptions,
  );
  assert.equal(model.contextWindow, 262_144);
  assert.equal(model.maxTokens, 262_144);
});

test("normalizeModel rejects a model without an ID", () => {
  assert.throws(
    () => normalizeModel({}, undefined, normalizeOptions),
    /without an ID/i,
  );
});

test("normalizeAvailable deduplicates, preserves order, and drops unhealthy", () => {
  const probes: ModelProbe[] = [
    { id: "second", healthy: true },
    { id: "first", healthy: false, error: "no such host" },
  ];
  const models = normalizeAvailable(
    [
      availableModel("second"),
      availableModel("first"),
      availableModel("second"),
    ],
    probes,
    normalizeOptions,
  );

  assert.deepEqual(
    models.map((model) => model.id),
    ["second"],
  );
});

test("normalizeAvailable keeps models without probe results", () => {
  const models = normalizeAvailable(
    [availableModel("one")],
    [],
    normalizeOptions,
  );
  assert.deepEqual(
    models.map((model) => model.id),
    ["one"],
  );
});

test("listUnhealthy reports unreachable models with reasons", () => {
  const probes: ModelProbe[] = [
    { id: "dsv4pro", healthy: false, error: "no such host" },
    { id: "ok", healthy: true },
  ];
  assert.deepEqual(
    listUnhealthy([availableModel("dsv4pro"), availableModel("ok")], probes),
    [{ id: "dsv4pro", error: "no such host" }],
  );
});

test("probeModel parses vLLM max_model_len context and treats model as healthy", async () => {
  const probe = await probeModel(
    "http://example.test:32788",
    "qwen3.5-27b",
    "secret-key",
    50,
    async () =>
      probeError(
        "max_tokens=999999cannot be greater than max_model_len=max_total_tokens=262144. Please request fewer output tokens. (parameter=max_tokens, value=999999)",
      ),
  );

  assert.equal(probe.healthy, true);
  assert.equal(probe.contextWindow, 262_144);
  assert.equal(probe.maxTokens, undefined);
});

test("probeModel parses vLLM context-length error", async () => {
  const probe = await probeModel(
    "http://example.test:32788",
    "gemma4-31b",
    "secret-key",
    50,
    async () =>
      probeError(
        "Requested token count exceeds the model's maximum context length of 262144 tokens. You requested a total of 1000013 tokens.",
      ),
  );

  assert.equal(probe.healthy, true);
  assert.equal(probe.contextWindow, 262_144);
});

test("probeModel parses one-api max completion tokens", async () => {
  const probe = await probeModel(
    "http://example.test:32788",
    "glm5.1-ae",
    "secret-key",
    50,
    async () =>
      probeError(
        "max_completion_tokens is too large: 999999.This model supports at most 12288 completion tokens.",
      ),
  );

  assert.equal(probe.healthy, true);
  assert.equal(probe.maxTokens, 12_288);
  assert.equal(probe.contextWindow, undefined);
});

test("probeModel marks one-api HTTP 500 backend failure as unhealthy", async () => {
  const probe = await probeModel(
    "http://example.test:32788",
    "dsv4pro",
    "secret-key",
    50,
    async () =>
      jsonResponse(
        {
          error: {
            message:
              'do request failed: Post "http://deepseekv4pro-predictor-default.test.svc.cluster.local:8000/v1/chat/completions": dial tcp: lookup secret-key secret-key on 192.168.3.3:53: no such host',
          },
        },
        500,
      ),
  );

  assert.equal(probe.healthy, false);
  assert.match(probe.error ?? "", /no such host/);
  assert.doesNotMatch(probe.error ?? "", /secret-key/);
});

test("probeModel marks DNS failures as unhealthy and redacts the key", async () => {
  const probe = await probeModel(
    "http://example.test:32788",
    "dsv4pro",
    "secret-key",
    50,
    async () => {
      throw new Error(
        "do request failed: dial tcp: lookup secret-key secret-key on 192.168.3.3:53: no such host",
      );
    },
  );

  assert.equal(probe.healthy, false);
  assert.match(probe.error ?? "", /no such host/);
  assert.doesNotMatch(probe.error ?? "", /secret-key/);
});

test("probeModel marks timeouts as unhealthy", async () => {
  const probe = await probeModel(
    "http://example.test:32788",
    "glm-5-fp8",
    "secret-key",
    10,
    async (_url, init) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      }),
  );

  assert.equal(probe.healthy, false);
  assert.match(probe.error ?? "", /timed out after 10ms/);
});

test("cache round-trips for the same origin and is written atomically", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cuhksz-cache-"));
  const path = join(directory, "nested", "models.json");
  const cache: DiscoveryCache = {
    version: 2,
    origin: "http://example.test:32788",
    fetchedAt: "2026-07-21T00:00:00.000Z",
    models: [availableModel("glm5.1-ae")],
    probes: [{ id: "glm5.1-ae", healthy: true, maxTokens: 12_288 }],
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

test("cache rejects version 1, origin mismatches and malformed JSON", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cuhksz-cache-"));
  const path = join(directory, "models.json");
  const origin = "http://example.test:32788";

  try {
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        origin,
        fetchedAt: "2026-07-21T00:00:00.000Z",
        models: [],
        probes: [],
      }),
    );
    assert.equal(await readCache(path, origin), undefined);

    await writeFile(
      path,
      JSON.stringify({
        version: 2,
        origin: "http://other.test:32788",
        fetchedAt: "2026-07-21T00:00:00.000Z",
        models: [],
        probes: [],
      }),
    );
    assert.equal(await readCache(path, origin), undefined);

    await writeFile(path, "not-json");
    assert.equal(await readCache(path, origin), undefined);
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

test("fetchAvailableModels returns the validated model list", async () => {
  const result = await fetchAvailableModels(
    "http://example.test:32788/v1/models",
    "secret-key",
    50,
    async () => jsonResponse({ data: [availableModel("glm5.1-ae")] }),
  );

  assert.deepEqual(result, [availableModel("glm5.1-ae")]);
});

test("fetchAvailableModels redacts the API key and bounds diagnostics", async () => {
  await assert.rejects(
    fetchAvailableModels(
      "http://example.test:32788/v1/models",
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

test("fetchAvailableModels rejects invalid JSON and missing data arrays", async () => {
  await assert.rejects(
    fetchAvailableModels(
      "http://example.test:32788/v1/models",
      "secret-key",
      50,
      async () => new Response("not-json", { status: 200 }),
    ),
    /invalid JSON/i,
  );
  await assert.rejects(
    fetchAvailableModels(
      "http://example.test:32788/v1/models",
      "secret-key",
      50,
      async () => jsonResponse({ object: "list" }),
    ),
    /data array/i,
  );
});

const discoveryConfig = {
  origin: "http://example.test:32788",
  apiKey: "secret-key",
  timeoutMs: 50,
  probeTimeoutMs: 50,
  cachePath: "/unused/cache.json",
  modelAllowlist: ["qwen3.5-27b", "dsv4pro", "glm-5-fp8"],
  normalizeOptions,
};

async function liveFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = String(input);
  if (url.endsWith("/v1/models")) {
    return jsonResponse({
      data: [
        availableModel("qwen3.5-27b"),
        availableModel("dsv4pro"),
        availableModel("glm-5-fp8"),
      ],
    });
  }
  // /v1/chat/completions 校验层错误
  if (url.endsWith("/v1/chat/completions")) {
    const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
    if (body.model === "qwen3.5-27b") {
      return probeError(
        "max_tokens=999999cannot be greater than max_model_len=max_total_tokens=262144.",
      );
    }
    if (body.model === "dsv4pro") {
      return jsonResponse(
        {
          error: {
            message:
              'do request failed: Post "http://deepseekv4pro-predictor-default.test.svc.cluster.local:8000/v1/chat/completions": dial tcp: lookup deepseekv4pro-predictor-default.test.svc.cluster.local on 192.168.3.3:53: no such host',
          },
        },
        500,
      );
    }
    return probeError(
      "max_completion_tokens is too large: 999999.This model supports at most 500000 completion tokens.",
    );
  }
  return jsonResponse({ error: "not found" }, 404);
}

test("fresh complete cache returns immediately without network access", async () => {
  const cache: DiscoveryCache = {
    version: 2,
    origin: discoveryConfig.origin,
    fetchedAt: new Date().toISOString(),
    models: [availableModel("cached")],
    probes: [{ id: "cached", healthy: true }],
  };
  let fetches = 0;
  const models = await discoverModels(
    { ...discoveryConfig, modelAllowlist: ["cached"] },
    {
      fetchImpl: async () => {
        fetches++;
        throw new Error("network must not run for fresh cache");
      },
      readCacheImpl: async () => cache,
      writeCacheImpl: async () =>
        assert.fail("fresh cache must not be rewritten"),
      warn: () => undefined,
    },
  );

  assert.equal(fetches, 0);
  assert.deepEqual(
    models.map((model) => model.id),
    ["cached"],
  );
});

test("live discovery probes models, applies measured params and filters unhealthy", async () => {
  const warnings: string[] = [];
  const written: DiscoveryCache[] = [];
  const models = await discoverModels(discoveryConfig, {
    fetchImpl: liveFetch,
    readCacheImpl: async () => undefined,
    writeCacheImpl: async (_path, cache) => {
      written.push(cache);
    },
    warn: (message) => warnings.push(message),
  });

  // dsv4pro 探测为 unhealthy，被过滤
  assert.deepEqual(
    models.map((model) => model.id),
    ["qwen3.5-27b", "glm-5-fp8"],
  );
  assert.equal(models[0].contextWindow, 262_144);
  assert.equal(models[1].contextWindow, 262_144);
  assert.equal(models[1].maxTokens, 262_144);
  assert.match(warnings.join("\n"), /skipping unhealthy model dsv4pro/);
  assert.equal(written.length, 1);
  assert.equal(written[0].version, 2);
  assert.equal(written[0].probes.length, 3);
});

test("discovery falls back to cache when live discovery fails", async () => {
  const cache: DiscoveryCache = {
    version: 2,
    origin: discoveryConfig.origin,
    fetchedAt: "2026-07-21T00:00:00.000Z",
    models: [availableModel("cached")],
    probes: [{ id: "cached", healthy: true }],
  };
  const warnings: string[] = [];
  const models = await discoverModels(
    { ...discoveryConfig, modelAllowlist: ["cached"] },
    {
      fetchImpl: async () => jsonResponse({ error: "down" }, 503),
      readCacheImpl: async () => cache,
      writeCacheImpl: async () => undefined,
      warn: (message) => warnings.push(message),
    },
  );

  assert.deepEqual(
    models.map((model) => model.id),
    ["cached"],
  );
  assert.match(warnings.join("\n"), /using cache/);
});

test("discovery fails without cache when live discovery fails", async () => {
  await assert.rejects(
    discoverModels(discoveryConfig, {
      fetchImpl: async () => jsonResponse({ error: "down" }, 503),
      readCacheImpl: async () => undefined,
      writeCacheImpl: async () => undefined,
      warn: () => undefined,
    }),
    /HTTP 503.*no valid same-origin cache/is,
  );
});

test("discovery treats live empty availability as authoritative", async () => {
  const cache: DiscoveryCache = {
    version: 2,
    origin: discoveryConfig.origin,
    fetchedAt: "2026-07-21T00:00:00.000Z",
    models: [availableModel("cached")],
    probes: [{ id: "cached", healthy: true }],
  };

  await assert.rejects(
    discoverModels(discoveryConfig, {
      fetchImpl: async () => jsonResponse({ data: [] }),
      readCacheImpl: async () => cache,
      writeCacheImpl: async () => undefined,
      warn: () => undefined,
    }),
    /no available models/i,
  );
});

test("cache write failure warns without discarding live discovery", async () => {
  const warnings: string[] = [];
  const models = await discoverModels(
    { ...discoveryConfig, modelAllowlist: ["one"] },
    {
      fetchImpl: async (input) =>
        String(input).endsWith("/v1/models")
          ? jsonResponse({ data: [availableModel("one")] })
          : jsonResponse({ data: { id: "one" } }),
      readCacheImpl: async () => undefined,
      writeCacheImpl: async () => {
        throw new Error("disk full");
      },
      warn: (message) => warnings.push(message),
    },
  );

  assert.deepEqual(
    models.map((model) => model.id),
    ["one"],
  );
  assert.match(warnings.join("\n"), /disk full/);
});

test("registerCUHKSZ rejects a missing API key before network access", async () => {
  let fetched = false;
  await assert.rejects(
    registerCUHKSZ(
      { registerProvider: () => assert.fail("must not register") },
      {},
      {
        fetchImpl: async () => {
          fetched = true;
          throw new Error("must not fetch");
        },
      },
    ),
    /CUHKSZ_API_KEY is not set/,
  );
  assert.equal(fetched, false);
});

test("registerCUHKSZ discovers and registers the configured provider", async () => {
  const registrations: Array<{
    name: string;
    config: Record<string, unknown>;
  }> = [];
  await registerCUHKSZ(
    {
      registerProvider: (name: string, config: Record<string, unknown>) => {
        registrations.push({ name, config });
      },
    },
    {
      CUHKSZ_API_KEY: "secret-key",
      CUHKSZ_ORIGIN: "http://example.test:32788/",
      CUHKSZ_DISCOVERY_TIMEOUT_MS: "1234",
      CUHKSZ_PROBE_TIMEOUT_MS: "2000",
      CUHKSZ_CACHE_PATH: "/custom/cache.json",
      // registerCUHKSZ 也会刷新 models.json；不加这行会把 fixture 写进
      // 开发者真实的 ~/.pi/agent/models.json。
      CUHKSZ_MODELS_JSON_REFRESH: "off",
    },
    {
      fetchImpl: liveFetch,
      readCacheImpl: async () => undefined,
      writeCacheImpl: async (path) => {
        assert.equal(path, "/custom/cache.json");
      },
      warn: () => undefined,
    },
  );

  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].name, "cuhksz");
  assert.equal(registrations[0].config.name, "CUHKSZ");
  assert.equal(registrations[0].config.baseUrl, "http://example.test:32788/v1");
  assert.equal(registrations[0].config.apiKey, "$CUHKSZ_API_KEY");
  assert.equal(registrations[0].config.api, "openai-completions");
  const models = registrations[0].config.models as Array<{
    id: string;
    contextWindow: number;
    maxTokens: number;
  }>;
  // 默认白名单只有 glm-5-fp8：网关另列的 qwen3.5-27b / dsv4pro 不再登记
  assert.deepEqual(
    models.map((model) => model.id),
    ["glm-5-fp8"],
  );
  assert.equal(models[0].contextWindow, 262_144);
  assert.equal(models[0].maxTokens, 262_144);
});

test("registerCUHKSZ uses the default local origin", async () => {
  const registrations: Array<{ config: Record<string, unknown> }> = [];
  await registerCUHKSZ(
    {
      registerProvider: (_name: string, config: Record<string, unknown>) => {
        registrations.push({ config });
      },
    },
    {
      CUHKSZ_API_KEY: "secret-key",
      // 旧环境变量不能改变固定单模型配置。
      CUHKSZ_MODELS: "one",
      CUHKSZ_MODELS_JSON_REFRESH: "off",
    },
    {
      fetchImpl: async (input) =>
        String(input).endsWith("/v1/models")
          ? jsonResponse({ data: [availableModel("glm-5-fp8")] })
          : jsonResponse({ data: { id: "glm-5-fp8" } }),
      readCacheImpl: async () => undefined,
      writeCacheImpl: async () => undefined,
      warn: () => undefined,
    },
  );

  assert.equal(registrations[0].config.baseUrl, "http://10.27.130.30:32788/v1");
});

test("discovery only probes and caches allowlisted models", async () => {
  const probed: string[] = [];
  const warnings: string[] = [];
  const cached: DiscoveryCache[] = [];
  const models = await discoverModels(
    { ...discoveryConfig, modelAllowlist: ["glm-5-fp8"] },
    {
      fetchImpl: async (input, init) => {
        if (String(input).endsWith("/v1/models")) {
          return jsonResponse({
            data: [
              availableModel("qwen3-30b"),
              availableModel("qwen3.5-27b"),
              availableModel("dsv4pro"),
              availableModel("gemma4-31b"),
              availableModel("glm5.1-ae"),
              availableModel("glm-5-fp8"),
            ],
          });
        }
        const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string };
        probed.push(String(body.model));
        return probeError(
          "max_completion_tokens is too large: 999999.This model supports at most 500000 completion tokens.",
        );
      },
      readCacheImpl: async () => undefined,
      writeCacheImpl: async (_path, cache) => {
        cached.push(cache);
      },
      warn: (message) => warnings.push(message),
    },
  );

  // 白名单外的 5 个模型既不探测也不告警（不再刷屏）
  assert.deepEqual(probed, ["glm-5-fp8"]);
  assert.deepEqual(models.map((model) => model.id), ["glm-5-fp8"]);
  assert.equal(models[0].contextWindow, 262_144);
  assert.deepEqual(warnings, []);
  // 缓存同样只存白名单模型，否则下次启动会把死模型写回来
  assert.deepEqual(cached[0].models.map((model) => model.id), ["glm-5-fp8"]);
  assert.deepEqual(cached[0].probes.map((probe) => probe.id), ["glm-5-fp8"]);
});

test("discovery rejects a gateway offering none of the allowlisted models", async () => {
  await assert.rejects(
    discoverModels(
      { ...discoveryConfig, modelAllowlist: ["glm-5-fp8"] },
      {
        fetchImpl: async (input) =>
          String(input).endsWith("/v1/models")
            ? jsonResponse({ data: [availableModel("qwen3-30b")] })
            : jsonResponse({ error: "unexpected" }, 500),
        readCacheImpl: async () => undefined,
        writeCacheImpl: async () => undefined,
        warn: () => undefined,
      },
    ),
    /offers none of the configured models \(glm-5-fp8\)/,
  );
});

test("registerCUHKSZ mirrors the registered provider into models.json", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cuhksz-models-json-"));
  const path = join(dir, "models.json");
  try {
    const registrations: Array<{ name: string; config: Record<string, unknown> }> = [];
    await registerCUHKSZ(
      {
        registerProvider: (name: string, config: Record<string, unknown>) => {
          registrations.push({ name, config });
        },
      },
      {
        CUHKSZ_API_KEY: "secret-key",
        CUHKSZ_ORIGIN: "http://example.test:32788",
        CUHKSZ_MODELS_JSON_PATH: path,
      },
      {
        fetchImpl: liveFetch,
        readCacheImpl: async () => undefined,
        writeCacheImpl: async () => undefined,
        warn: () => undefined,
      },
    );

    const written = JSON.parse(await readFile(path, "utf8"));
    // 必须与进程内注册逐字一致，否则 models.json 直读方会与进程内漂移
    assert.deepEqual(written.providers.cuhksz, registrations[0].config);
    assert.deepEqual(
      written.providers.cuhksz.models.map((model: { id: string }) => model.id),
      ["glm-5-fp8"],
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CUHKSZ_MODELS_JSON_REFRESH=off skips the models.json mirror", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cuhksz-models-json-off-"));
  const path = join(dir, "models.json");
  try {
    const registrations: string[] = [];
    await registerCUHKSZ(
      { registerProvider: (name: string) => registrations.push(name) },
      {
        CUHKSZ_API_KEY: "secret-key",
        CUHKSZ_MODELS_JSON_PATH: path,
        CUHKSZ_MODELS_JSON_REFRESH: "off",
      },
      {
        fetchImpl: liveFetch,
        readCacheImpl: async () => undefined,
        writeCacheImpl: async () => undefined,
        warn: () => undefined,
      },
    );

    assert.deepEqual(registrations, ["cuhksz"]);
    await assert.rejects(readFile(path, "utf8"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("cuhksz extension degrades to disabled instead of failing to load", async () => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  const originalKey = process.env.CUHKSZ_API_KEY;
  console.warn = ((message: unknown) => {
    warnings.push(String(message));
  }) as typeof console.warn;
  delete process.env.CUHKSZ_API_KEY;
  try {
    await cuhkszExtension({
      registerProvider: () => assert.fail("must not register"),
    } as unknown as ExtensionAPI);
  } finally {
    console.warn = originalWarn;
    if (originalKey === undefined) delete process.env.CUHKSZ_API_KEY;
    else process.env.CUHKSZ_API_KEY = originalKey;
  }

  // 缺 key 只降级为「provider 不可用」：不抛错（pi 不会再报 Failed to load extension）
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /CUHKSZ provider disabled: CUHKSZ_API_KEY is not set/);
});

test("cuhksz extension is importable and exposes a callable default", () => {
  assert.equal(typeof cuhkszExtension, "function");
  assert.equal(typeof KNOWN_MODEL_PARAMS["glm-5-fp8"], "object");
});
