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
  // glm-5-fp8 实测 max output=500000（网关硬限制），必须覆盖 256K 默认
  const glm = normalizeModel(
    availableModel("glm-5-fp8"),
    undefined,
    normalizeOptions,
  );
  assert.equal(glm.contextWindow, 500_000);
  assert.equal(glm.maxTokens, 500_000);
  assert.equal(glm.reasoning, false);
});

test("probe context overrides the known table", () => {
  const probe: ModelProbe = {
    id: "glm-5-fp8",
    healthy: true,
    contextWindow: 200_000,
  };
  const model = normalizeModel(
    availableModel("glm-5-fp8"),
    probe,
    normalizeOptions,
  );
  assert.equal(model.contextWindow, 200_000);
  assert.equal(model.maxTokens, 500_000);
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
  const models = await discoverModels(discoveryConfig, {
    fetchImpl: async () => {
      fetches++;
      throw new Error("network must not run for fresh cache");
    },
    readCacheImpl: async () => cache,
    writeCacheImpl: async () =>
      assert.fail("fresh cache must not be rewritten"),
    warn: () => undefined,
  });

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
  assert.equal(models[1].contextWindow, 500_000);
  assert.equal(models[1].maxTokens, 500_000);
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
  const models = await discoverModels(discoveryConfig, {
    fetchImpl: async () => jsonResponse({ error: "down" }, 503),
    readCacheImpl: async () => cache,
    writeCacheImpl: async () => undefined,
    warn: (message) => warnings.push(message),
  });

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
  const models = await discoverModels(discoveryConfig, {
    fetchImpl: async (input) =>
      String(input).endsWith("/v1/models")
        ? jsonResponse({ data: [availableModel("one")] })
        : jsonResponse({ data: { id: "one" } }),
    readCacheImpl: async () => undefined,
    writeCacheImpl: async () => {
      throw new Error("disk full");
    },
    warn: (message) => warnings.push(message),
  });

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
  assert.deepEqual(
    models.map((model) => model.id),
    ["qwen3.5-27b", "glm-5-fp8"],
  );
  assert.equal(models[0].contextWindow, 262_144);
  assert.equal(models[1].contextWindow, 500_000);
  assert.equal(models[1].maxTokens, 500_000);
});

test("registerCUHKSZ uses the default local origin", async () => {
  const registrations: Array<{ config: Record<string, unknown> }> = [];
  await registerCUHKSZ(
    {
      registerProvider: (_name: string, config: Record<string, unknown>) => {
        registrations.push({ config });
      },
    },
    { CUHKSZ_API_KEY: "secret-key" },
    {
      fetchImpl: async (input) =>
        String(input).endsWith("/v1/models")
          ? jsonResponse({ data: [availableModel("one")] })
          : jsonResponse({ data: { id: "one" } }),
      readCacheImpl: async () => undefined,
      writeCacheImpl: async () => undefined,
      warn: () => undefined,
    },
  );

  assert.equal(registrations[0].config.baseUrl, "http://10.27.130.30:32788/v1");
});

test("cuhksz extension is importable and exposes a callable default", () => {
  // 隔离性回归：CUHKSZ 本地部署不可达/未配置时，
  // 扩展注册失败只影响自身（pi 按扩展文件隔离错误）。
  assert.equal(typeof cuhkszExtension, "function");
  assert.equal(typeof KNOWN_MODEL_PARAMS["glm-5-fp8"], "object");
});
