// cuhksz.ts — CUHKSZ local deployment provider（实时模型发现 + 参数探测 + 健康检查）
// 自用本地 OpenAI-compatible 部署（one-api 网关 + vLLM 类后端，如 10.27.130.30:32788）。
//
// 参数获取策略（实测验证，无需管理权限）：
//   one-api / vLLM 会在生成前校验 max_tokens / 上下文长度，校验失败返回
//   HTTP 400，错误信息里带真实上限。因此对每个模型发一个 max_tokens 超限的
//   试探请求，从错误信息解析出 contextWindow / maxTokens，同时确认模型可达
//   （后端 DNS 挂掉的模型会秒回网络层错误，探测判定 unhealthy 后不注册）。
//   试探请求全部在网关/后端校验层被拒绝，不触发真实生成，耗时毫秒级。
//
// 已实测参数（2026-08-18 对本部署）固化在 KNOWN_MODEL_PARAMS，避免每次启动
// 都依赖探测；探测结果优先，表格次之，最后是默认值（上下文 256K）。

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// 探测与表格都没给出上下文时的默认值（256K，本部署基线）。
const DEFAULT_CONTEXT_WINDOW = 262_144;
// 未知模型的保守最大输出。
const DEFAULT_MAX_TOKENS = 16_384;
// 试探用超限 max_tokens：必定被网关/后端校验层拒绝，不会进入真实生成。
const PROBE_MAX_TOKENS = 999_999;

export type AvailableModel = {
  id?: string;
  object?: string;
  created?: number;
  owned_by?: string;
  root?: string;
  parent?: string | null;
};

export type ProviderModel = {
  id: string;
  name: string;
  reasoning: boolean;
  input: Array<"text" | "image">;
  contextWindow: number;
  maxTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
};

export type NormalizeOptions = {
  defaultContextWindow: number;
  defaultMaxTokens: number;
};

export type ModelCapabilities = {
  contextWindow?: number;
  maxTokens?: number;
  reasoning?: boolean;
};

/**
 * 本部署实测参数（one-api 网关校验 / vLLM 校验错误）。
 * contextWindow/maxTokens 为该模型真实上限；探测结果优先于此表。
 *
 * 只登记当前可用的模型：本部署其余模型（qwen3-30b / qwen3.5-27b / dsv4pro /
 * gemma4-31b / glm5.1-ae）后端 DNS 已失效，探测判定 unhealthy 后不会注册，
 * 参数一并移除。若后端恢复，探测会重新给出真实参数，无需在此表补录。
 */
export const KNOWN_MODEL_PARAMS: Record<string, ModelCapabilities> = {
  // glm-5-fp8 网关实测 max output=500000（校验错误 "at most 500000 completion
  // tokens"）；生成极慢，真实请求可能长时间无首 token。
  "glm-5-fp8": { contextWindow: 500_000, maxTokens: 500_000, reasoning: false },
};

/**
 * Best-effort reasoning detection（表格未覆盖时兜底）。本地 /v1/models
 * 不携带能力元数据，只能从模型 id 推测；未命中时保守返回 false。
 */
const REASONING_PATTERN =
  /\b(?:thinking|reasoning|reasoner|qvq|r1|o[134]|deepseek-v4|dsv\d)/i;

export function isReasoningModel(id: string): boolean {
  return REASONING_PATTERN.test(id);
}

export type ModelProbe = {
  id: string;
  /** 网络层可达（能拿到 HTTP 响应，无论状态码）。DNS 挂/连接失败/超时为 false。 */
  healthy: boolean;
  error?: string;
  /** 从校验错误解析出的真实上下文窗口。 */
  contextWindow?: number;
  /** 从校验错误解析出的真实最大输出。 */
  maxTokens?: number;
};

// 上下文：max_model_len=max_total_tokens=262144 / maximum context length of 262144
//         / context length (12288 tokens)
const CONTEXT_PATTERN =
  /(?:max_model_len|max_total_tokens|maximum context length|context length)\D{0,8}?(\d{3,})/i;
// 最大输出：at most 12288 completion tokens / at most 500000 completion tokens
const MAX_TOKENS_PATTERN = /at most (\d+) completion tokens/i;
// 后端不可达标记：one-api 会把后端 DNS/连接失败包装成 HTTP 500 返回，
// 响应体里带这些标记（如 dsv4pro / qwen3-30b 的 do_request_failed: no such host）。
const UNREACHABLE_PATTERN =
  /(?:no such host|do request failed|connection refused|lookup |ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ETIMEDOUT|backend.{0,20}(?:unavailable|down|offline))/i;

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseContextWindow(message: string): number | undefined {
  const match = message.match(CONTEXT_PATTERN);
  return match ? parsePositiveNumber(match[1], undefined) : undefined;
}

function parseMaxTokens(message: string): number | undefined {
  const match = message.match(MAX_TOKENS_PATTERN);
  return match ? parsePositiveNumber(match[1], undefined) : undefined;
}

/**
 * 对单个模型发 max_tokens 超限试探，解析参数并判定可达性。
 * 校验拒绝（HTTP 4xx，带 max_tokens/context 提示）= 网关/后端活着且暴露上限；
 * 网络层错误（DNS 解析失败 / 连接拒绝 / 超时）= 模型异常。
 */
export async function probeModel(
  origin: string,
  modelId: string,
  apiKey: string,
  timeoutMs: number,
  fetchImpl: FetchImplementation = fetch,
): Promise<ModelProbe> {
  const url = `${origin}/v1/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: PROBE_MAX_TOKENS,
      }),
      signal: controller.signal,
    });
    // 无论 200/400/5xx，先检查响应体是否携带后端不可达标记：
    // one-api 会把后端 DNS/连接失败包装成 HTTP 500，此时必须判定为异常，
    // 且后端不可达时错误信息里的参数没有意义，不解析。
    const responseText = await response.text();
    const safeExcerpt = responseText
      .slice(0, 800)
      .split(apiKey)
      .join("<redacted>");
    if (UNREACHABLE_PATTERN.test(responseText)) {
      return {
        id: modelId,
        healthy: false,
        error: `backend unreachable (HTTP ${response.status}): ${safeExcerpt}`,
      };
    }

    const probe: ModelProbe = { id: modelId, healthy: true };
    const contextWindow = parseContextWindow(responseText);
    const maxTokens = parseMaxTokens(responseText);
    if (contextWindow !== undefined) probe.contextWindow = contextWindow;
    if (maxTokens !== undefined) probe.maxTokens = maxTokens;
    if (!response.ok && !contextWindow && !maxTokens) {
      probe.error = `HTTP ${response.status} ${response.statusText}: ${safeExcerpt}`;
    }
    return probe;
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        id: modelId,
        healthy: false,
        error: `timed out after ${timeoutMs}ms`,
      };
    }
    return {
      id: modelId,
      healthy: false,
      error: asError(error).message.split(apiKey).join("<redacted>"),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeModel(
  available: AvailableModel,
  probe: ModelProbe | undefined,
  options: NormalizeOptions,
): ProviderModel {
  const id = String(available.id ?? "").trim();
  if (!id) throw new Error("Cannot normalize a model without an ID");

  const known = KNOWN_MODEL_PARAMS[id];
  const contextWindow =
    probe?.contextWindow ??
    known?.contextWindow ??
    options.defaultContextWindow;
  // 已知模型（表格给出上下文）默认按上下文放开输出上限；
  // 未知模型保守用 defaultMaxTokens。
  const maxTokens =
    probe?.maxTokens ??
    known?.maxTokens ??
    (known?.contextWindow !== undefined
      ? contextWindow
      : options.defaultMaxTokens);
  const reasoning =
    known?.reasoning ??
    (probe?.contextWindow !== undefined && isReasoningModel(id));

  return {
    id,
    name: id,
    reasoning: Boolean(reasoning),
    input: ["text"],
    contextWindow,
    maxTokens,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
  };
}

export function normalizeAvailable(
  available: AvailableModel[],
  probes: ModelProbe[],
  options: NormalizeOptions,
): ProviderModel[] {
  const probeById = new Map(probes.map((probe) => [probe.id, probe]));
  const seen = new Set<string>();
  const models: ProviderModel[] = [];

  for (const entry of available) {
    const id = entry.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const probe = probeById.get(id);
    // 网络层不可达的异常模型（DNS 挂等）不注册，避免用户选中后必然报错。
    if (probe && !probe.healthy) continue;
    models.push(normalizeModel(entry, probe, options));
  }

  return models;
}

export function listUnhealthy(
  available: AvailableModel[],
  probes: ModelProbe[],
): Array<{ id: string; error?: string }> {
  const probeById = new Map(probes.map((probe) => [probe.id, probe]));
  const unhealthy: Array<{ id: string; error?: string }> = [];
  for (const entry of available) {
    const id = entry.id?.trim();
    if (!id) continue;
    const probe = probeById.get(id);
    if (probe && !probe.healthy) {
      unhealthy.push({ id, error: probe.error });
    }
  }
  return unhealthy;
}

export type DiscoveryCache = {
  version: 2;
  origin: string;
  fetchedAt: string;
  models: AvailableModel[];
  probes: ModelProbe[];
};

function isDiscoveryCache(value: unknown): value is DiscoveryCache {
  if (!value || typeof value !== "object") return false;
  const cache = value as Partial<DiscoveryCache>;
  return (
    cache.version === 2 &&
    typeof cache.origin === "string" &&
    typeof cache.fetchedAt === "string" &&
    Array.isArray(cache.models) &&
    Array.isArray(cache.probes)
  );
}

export async function readCache(
  path: string,
  origin: string,
): Promise<DiscoveryCache | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    if (!isDiscoveryCache(parsed) || parsed.origin !== origin) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export async function writeCache(
  path: string,
  cache: DiscoveryCache,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;

  try {
    await writeFile(temporaryPath, `${JSON.stringify(cache, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

type FetchImplementation = typeof fetch;

export async function fetchAvailableModels(
  url: string,
  apiKey: string,
  timeoutMs: number,
  fetchImpl: FetchImplementation = fetch,
): Promise<AvailableModel[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    const responseText = await response.text();
    const safeResponseExcerpt = responseText
      .slice(0, 800)
      .split(apiKey)
      .join("<redacted>");

    if (!response.ok) {
      throw new Error(
        [
          `CUHKSZ endpoint failed: ${url}`,
          `HTTP ${response.status} ${response.statusText}`,
          `Response: ${safeResponseExcerpt}`,
        ].join("\n"),
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(responseText);
    } catch {
      throw new Error(
        `CUHKSZ endpoint returned invalid JSON: ${url}\nResponse: ${safeResponseExcerpt}`,
      );
    }

    const data = (payload as { data?: unknown })?.data;
    if (!Array.isArray(data)) {
      throw new Error(
        `CUHKSZ endpoint response does not contain a data array: ${url}`,
      );
    }

    return data.filter(
      (entry): entry is AvailableModel =>
        Boolean(entry) && typeof entry === "object",
    );
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`CUHKSZ endpoint timed out after ${timeoutMs}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export type DiscoveryConfig = {
  origin: string;
  apiKey: string;
  timeoutMs: number;
  probeTimeoutMs: number;
  cachePath: string;
  cacheMaxAgeMs?: number;
  normalizeOptions: NormalizeOptions;
};

export type DiscoveryDependencies = {
  fetchImpl?: FetchImplementation;
  readCacheImpl?: typeof readCache;
  writeCacheImpl?: typeof writeCache;
  warn?: (message: string) => void;
};

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function discoverModels(
  config: DiscoveryConfig,
  dependencies: DiscoveryDependencies = {},
): Promise<ProviderModel[]> {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const readCacheImpl = dependencies.readCacheImpl ?? readCache;
  const writeCacheImpl = dependencies.writeCacheImpl ?? writeCache;
  const warn = dependencies.warn ?? ((message: string) => console.warn(message));
  const cache = await readCacheImpl(config.cachePath, config.origin);
  const cacheMaxAgeMs = config.cacheMaxAgeMs ?? 6 * 60 * 60 * 1000;

  if (
    cache &&
    cache.models.length > 0 &&
    Date.now() - Date.parse(cache.fetchedAt) <= cacheMaxAgeMs
  ) {
    const models = normalizeAvailable(cache.models, cache.probes, config.normalizeOptions);
    const unhealthy = listUnhealthy(cache.models, cache.probes);
    for (const entry of unhealthy) {
      warn(`CUHKSZ skipping unhealthy model ${entry.id}: ${entry.error ?? "unknown"}`);
    }
    return models;
  }

  const modelsUrl = `${config.origin}/v1/models`;
  let available: AvailableModel[];
  try {
    available = await fetchAvailableModels(
      modelsUrl,
      config.apiKey,
      config.timeoutMs,
      fetchImpl,
    );
  } catch (error) {
    if (cache && cache.models.length > 0) {
      warn(
        `CUHKSZ live model discovery failed; using cache from ${cache.fetchedAt}: ${asError(error).message}`,
      );
      const models = normalizeAvailable(cache.models, cache.probes, config.normalizeOptions);
      const unhealthy = listUnhealthy(cache.models, cache.probes);
      for (const entry of unhealthy) {
        warn(`CUHKSZ skipping unhealthy model ${entry.id}: ${entry.error ?? "unknown"}`);
      }
      return models;
    }
    throw new Error(
      [
        `CUHKSZ model discovery failed: ${asError(error).message}`,
        "No valid same-origin cache is available.",
      ].join("\n"),
    );
  }

  // 与 aihubmix 一致：线上返回空列表视为权威结果（服务可用但没有模型），
  // 不回退到缓存，直接报错。
  if (available.length === 0) {
    throw new Error("CUHKSZ /v1/models returned no available models");
  }

  // 并行探测所有模型：解析真实参数 + 判定可达性（全部为校验层秒回，毫秒级）。
  const probes = await Promise.all(
    available.map((model) =>
      probeModel(
        config.origin,
        String(model.id ?? "").trim(),
        config.apiKey,
        config.probeTimeoutMs,
        fetchImpl,
      ),
    ),
  );

  const models = normalizeAvailable(available, probes, config.normalizeOptions);
  const unhealthy = listUnhealthy(available, probes);
  for (const entry of unhealthy) {
    warn(`CUHKSZ skipping unhealthy model ${entry.id}: ${entry.error ?? "unknown"}`);
  }

  const newCache: DiscoveryCache = {
    version: 2,
    origin: config.origin,
    fetchedAt: new Date().toISOString(),
    models: available,
    probes,
  };
  try {
    await writeCacheImpl(config.cachePath, newCache);
  } catch (error) {
    warn(`CUHKSZ cache update failed: ${asError(error).message}`);
  }
  return models;
}

type ProviderRegistrar = Pick<ExtensionAPI, "registerProvider">;

type Environment = Record<string, string | undefined>;

export async function registerCUHKSZ(
  pi: ProviderRegistrar,
  environment: Environment = process.env,
  dependencies: DiscoveryDependencies = {},
): Promise<void> {
  const apiKey = environment.CUHKSZ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      [
        "CUHKSZ_API_KEY is not set.",
        "",
        "Add this to ~/.zshrc:",
        "export CUHKSZ_API_KEY='your-key'",
      ].join("\n"),
    );
  }

  const origin = (
    environment.CUHKSZ_ORIGIN || "http://10.27.130.30:32788"
  ).replace(/\/+$/, "");
  const models = await discoverModels(
    {
      origin,
      apiKey,
      timeoutMs: parsePositiveNumber(
        environment.CUHKSZ_DISCOVERY_TIMEOUT_MS,
        15_000,
      ),
      probeTimeoutMs: parsePositiveNumber(
        environment.CUHKSZ_PROBE_TIMEOUT_MS,
        8_000,
      ),
      cachePath:
        environment.CUHKSZ_CACHE_PATH ||
        join(homedir(), ".pi", "agent", "cache", "cuhksz-models.json"),
      cacheMaxAgeMs: parsePositiveNumber(
        environment.CUHKSZ_CACHE_MAX_AGE_MS,
        6 * 60 * 60 * 1000,
      ),
      normalizeOptions: {
        // 本地部署实测上下文基线 256K；成本恒为 0（本地免费）。
        defaultContextWindow: DEFAULT_CONTEXT_WINDOW,
        defaultMaxTokens: DEFAULT_MAX_TOKENS,
      },
    },
    dependencies,
  );

  if (models.length === 0) {
    throw new Error("CUHKSZ discovery produced no usable models");
  }

  pi.registerProvider("cuhksz", {
    name: "CUHKSZ",
    baseUrl: `${origin}/v1`,
    apiKey: "$CUHKSZ_API_KEY",
    api: "openai-completions",
    models,
  });
}

export default registerCUHKSZ;
