import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const LIST_SEPARATOR = /[,，|;；、\s]+/;

export function parseList(
  value: string | string[] | undefined,
): string[] {
  if (value === undefined) return [];

  const values = Array.isArray(value) ? value : [value];
  const normalized = values
    .flatMap((item) => String(item).split(LIST_SEPARATOR))
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(normalized)];
}

export function parseTokenCount(
  value: string | number | undefined,
): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : undefined;
  }

  if (typeof value !== "string") return undefined;

  const match = value
    .trim()
    .toLowerCase()
    .replace(/,/g, "")
    .match(/^([0-9]+(?:\.[0-9]+)?)\s*([kmg])?$/);

  if (!match) return undefined;

  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;

  const multiplier =
    match[2] === "k"
      ? 1_000
      : match[2] === "m"
        ? 1_000_000
        : match[2] === "g"
          ? 1_000_000_000
          : 1;

  return Math.floor(numeric * multiplier);
}

export function parsePrice(
  value: string | number | undefined,
  multiplier: number,
): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0
    ? numeric * multiplier
    : 0;
}

export type AvailableModel = {
  id?: string;
  object?: string;
  created?: number;
  owned_by?: string;
};

export type DetailedModel = {
  model_id?: string;
  model_name?: string;
  desc?: string;
  types?: string | string[];
  features?: string | string[];
  input_modalities?: string | string[];
  context_length?: string | number;
  max_output?: string | number;
  pricing?: {
    input?: string | number;
    output?: string | number;
    cache_read?: string | number;
    cache_write?: string | number;
  };
};

/**
 * Authoritative working context windows for models registered in the OpenAI
 * Codex model registry (codex-rs/models-manager/models.json). AIHubMix's
 * metadata endpoint advertises inflated values (e.g. 1.05M/400K) that do not
 * match the registry, so these override `context_length` for matching models.
 */
const CODEX_AUTHORITATIVE_CONTEXT_WINDOWS: Record<string, number> = {
  "gpt-5.6-sol": 272_000,
  "gpt-5.6-terra": 272_000,
  "gpt-5.6-luna": 272_000,
  "gpt-5.5": 272_000,
  "gpt-5.4": 272_000,
  "gpt-5.4-mini": 272_000,
  "gpt-5.2": 272_000,
};

export type NormalizeOptions = {
  priceMultiplier: number;
  defaultContextWindow: number;
  defaultMaxTokens: number;
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

function normalizeMaxTokens(
  advertisedContextWindow: number,
  upstreamMaxTokens: number | undefined,
  defaultMaxTokens: number,
): number {
  const candidate = upstreamMaxTokens ?? defaultMaxTokens;
  if (candidate < advertisedContextWindow) return candidate;

  return Math.max(
    1,
    Math.min(defaultMaxTokens, Math.floor(advertisedContextWindow / 4)),
  );
}

export function normalizeModel(
  available: AvailableModel,
  metadata: DetailedModel | undefined,
  options: NormalizeOptions,
): ProviderModel {
  const id = String(available.id ?? metadata?.model_id ?? "").trim();
  if (!id) throw new Error("Cannot normalize a model without an ID");

  const advertisedContextWindow =
    parseTokenCount(metadata?.context_length) ?? options.defaultContextWindow;
  const contextWindow =
    CODEX_AUTHORITATIVE_CONTEXT_WINDOWS[id] ?? advertisedContextWindow;
  const maxTokens = normalizeMaxTokens(
    contextWindow,
    parseTokenCount(metadata?.max_output),
    options.defaultMaxTokens,
  );
  const features = parseList(metadata?.features);
  const modalities = parseList(metadata?.input_modalities);
  const input: Array<"text" | "image"> = ["text"];
  if (modalities.includes("image")) input.push("image");

  const displayName = metadata?.model_name?.trim();

  return {
    id,
    name: displayName || id,
    reasoning:
      features.includes("thinking") || features.includes("reasoning"),
    input,
    // Pi defines contextWindow as the provider's total input+output window and
    // independently clamps maxTokens to the request's remaining capacity.
    contextWindow,
    maxTokens,
    cost: {
      input: parsePrice(metadata?.pricing?.input, options.priceMultiplier),
      output: parsePrice(metadata?.pricing?.output, options.priceMultiplier),
      cacheRead: parsePrice(
        metadata?.pricing?.cache_read,
        options.priceMultiplier,
      ),
      cacheWrite: parsePrice(
        metadata?.pricing?.cache_write,
        options.priceMultiplier,
      ),
    },
  };
}

export function mergeLiveModels(
  available: AvailableModel[],
  metadata: DetailedModel[],
  options: NormalizeOptions,
): ProviderModel[] {
  const metadataById = new Map(
    metadata
      .map((model) => [model.model_id?.trim(), model] as const)
      .filter((entry): entry is readonly [string, DetailedModel] => Boolean(entry[0])),
  );
  const seen = new Set<string>();
  const models: ProviderModel[] = [];

  for (const entry of available) {
    const id = entry.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const details = metadataById.get(id);
    if (details) models.push(normalizeModel(entry, details, options));
  }

  if (available.length > 0 && models.length === 0) {
    throw new Error(
      "AIHubMix availability and metadata endpoints returned no matching model IDs",
    );
  }

  return models;
}

export type DiscoveryCache = {
  version: 1;
  origin: string;
  fetchedAt: string;
  available: AvailableModel[];
  metadata: DetailedModel[];
};

function isDiscoveryCache(value: unknown): value is DiscoveryCache {
  if (!value || typeof value !== "object") return false;
  const cache = value as Partial<DiscoveryCache>;
  return (
    cache.version === 1 &&
    typeof cache.origin === "string" &&
    typeof cache.fetchedAt === "string" &&
    Array.isArray(cache.available) &&
    Array.isArray(cache.metadata)
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

export async function fetchJsonData(
  url: string,
  apiKey: string,
  timeoutMs: number,
  fetchImpl: FetchImplementation = fetch,
): Promise<unknown[]> {
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
          `AIHubMix endpoint failed: ${url}`,
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
        `AIHubMix endpoint returned invalid JSON: ${url}\nResponse: ${safeResponseExcerpt}`,
      );
    }

    const data = (payload as { data?: unknown })?.data;
    if (!Array.isArray(data)) {
      throw new Error(
        `AIHubMix endpoint response does not contain a data array: ${url}`,
      );
    }

    return data;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`AIHubMix endpoint timed out after ${timeoutMs}ms: ${url}`);
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

type SettledData =
  | { ok: true; data: unknown[] }
  | { ok: false; error: Error };

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function settleData(promise: Promise<unknown[]>): Promise<SettledData> {
  try {
    return { ok: true, data: await promise };
  } catch (error) {
    return { ok: false, error: asError(error) };
  }
}

function castAvailable(data: unknown[]): AvailableModel[] {
  return data.filter(
    (entry): entry is AvailableModel =>
      Boolean(entry) && typeof entry === "object",
  );
}

function castMetadata(data: unknown[]): DetailedModel[] {
  return data.filter(
    (entry): entry is DetailedModel =>
      Boolean(entry) && typeof entry === "object",
  );
}

function mergeAvailableWithOptionalMetadata(
  available: AvailableModel[],
  metadata: DetailedModel[],
  options: NormalizeOptions,
): ProviderModel[] {
  const metadataById = new Map(
    metadata
      .map((model) => [model.model_id?.trim(), model] as const)
      .filter((entry): entry is readonly [string, DetailedModel] => Boolean(entry[0])),
  );
  const seen = new Set<string>();
  const models: ProviderModel[] = [];

  for (const availableModel of available) {
    const id = availableModel.id?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    models.push(
      normalizeModel(availableModel, metadataById.get(id), options),
    );
  }

  return models;
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
    cache.available.length > 0 &&
    cache.metadata.length > 0 &&
    Date.now() - Date.parse(cache.fetchedAt) <= cacheMaxAgeMs
  ) {
    return mergeLiveModels(cache.available, cache.metadata, config.normalizeOptions);
  }

  const availabilityUrl = `${config.origin}/v1/models`;
  const metadataUrl = `${config.origin}/api/v1/models?type=llm`;
  const availabilityPromise = settleData(
    fetchJsonData(
      availabilityUrl,
      config.apiKey,
      config.timeoutMs,
      fetchImpl,
    ),
  );
  const metadataPromise = settleData(
    fetchJsonData(metadataUrl, config.apiKey, config.timeoutMs, fetchImpl),
  );
  const [availabilityResult, metadataResult] = await Promise.all([
    availabilityPromise,
    metadataPromise,
  ]);

  if (availabilityResult.ok) {
    const available = castAvailable(availabilityResult.data);
    if (available.length === 0) {
      throw new Error("AIHubMix /v1/models returned no available models");
    }

    if (metadataResult.ok) {
      const metadata = castMetadata(metadataResult.data);
      const models = mergeLiveModels(
        available,
        metadata,
        config.normalizeOptions,
      );
      const newCache: DiscoveryCache = {
        version: 1,
        origin: config.origin,
        fetchedAt: new Date().toISOString(),
        available,
        metadata,
      };
      try {
        await writeCacheImpl(config.cachePath, newCache);
      } catch (error) {
        warn(`AIHubMix cache update failed: ${asError(error).message}`);
      }
      return models;
    }

    warn(
      `AIHubMix metadata discovery failed; using cached metadata and defaults: ${metadataResult.error.message}`,
    );
    return mergeAvailableWithOptionalMetadata(
      available,
      cache?.metadata ?? [],
      config.normalizeOptions,
    );
  }

  if (cache) {
    warn(
      `AIHubMix live availability discovery failed; using complete cache from ${cache.fetchedAt}: ${availabilityResult.error.message}`,
    );
    return mergeLiveModels(
      cache.available,
      cache.metadata,
      config.normalizeOptions,
    );
  }

  const metadataError = metadataResult.ok
    ? "metadata endpoint succeeded but cannot establish model availability"
    : metadataResult.error.message;
  throw new Error(
    [
      `AIHubMix availability discovery failed: ${availabilityResult.error.message}`,
      `AIHubMix metadata discovery result: ${metadataError}`,
      "No valid same-origin cache is available.",
    ].join("\n"),
  );
}

type ProviderRegistrar = Pick<ExtensionAPI, "registerProvider">;

type Environment = Record<string, string | undefined>;

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function registerAIHubMix(
  pi: ProviderRegistrar,
  environment: Environment = process.env,
  dependencies: DiscoveryDependencies = {},
): Promise<void> {
  const apiKey = environment.AIHUBMIX_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      [
        "AIHUBMIX_API_KEY is not set.",
        "",
        "Add this to ~/.zshrc:",
        "export AIHUBMIX_API_KEY='your-key'",
      ].join("\n"),
    );
  }

  const origin = (
    environment.AIHUBMIX_ORIGIN || "https://api.inferera.com"
  ).replace(/\/+$/, "");
  const models = await discoverModels(
    {
      origin,
      apiKey,
      timeoutMs: parsePositiveNumber(
        environment.AIHUBMIX_DISCOVERY_TIMEOUT_MS,
        15_000,
      ),
      cachePath:
        environment.AIHUBMIX_CACHE_PATH ||
        join(homedir(), ".pi", "agent", "cache", "aihubmix-models.json"),
      cacheMaxAgeMs: parsePositiveNumber(
        environment.AIHUBMIX_CACHE_MAX_AGE_MS,
        6 * 60 * 60 * 1000,
      ),
      normalizeOptions: {
        priceMultiplier: parsePositiveNumber(
          environment.AIHUBMIX_PRICE_MULTIPLIER,
          1,
        ),
        defaultContextWindow: 128_000,
        defaultMaxTokens: 16_384,
      },
    },
    dependencies,
  );

  if (models.length === 0) {
    throw new Error("AIHubMix discovery produced no usable models");
  }

  pi.registerProvider("aihubmix", {
    name: "AIHubMix",
    baseUrl: `${origin}/v1`,
    apiKey: "$AIHUBMIX_API_KEY",
    api: "openai-completions",
    models,
  });
}

export default registerAIHubMix;
