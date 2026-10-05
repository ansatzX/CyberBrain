import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { agentDir } from "../agent-paths.ts";
import { dirname, join } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
	defaultModelsJsonPath,
	refreshModelsJsonProvider,
	type ModelsJsonDependencies,
	type RefreshResult,
} from "./models-json.ts";

const AIHUBMIX_PROVIDER_ID = "aihubmix";
const AIHUBMIX_PROVIDER_NAME = "AIHubMix";
const DEFAULT_ORIGIN = "https://api.inferera.com";

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
	/** Gateway route tokens: chat_completions / responses / claude_api / gemini_api. */
	endpoints?: string | string[];
	/**
	 * Standalone reasoning capability flag. Roughly a sixth of the catalog sets
	 * this boolean without any `thinking`/`reasoning` token in `features`.
	 */
	reasoning?: boolean | string;
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
 * Pi protocol adapters the AIHubMix gateway can serve. Each route lives at a
 * different path on the same origin, so preserving the gateway's protocol
 * assignment means preserving both `api` and the per-model `baseUrl`.
 */
export type ProviderApi =
	| "openai-completions"
	| "openai-responses"
	| "anthropic-messages"
	| "google-generative-ai";

export type ProtocolRoute = { api: ProviderApi; baseUrl: string };

/**
 * A model id's protocol family, taken from the last path segment. The family
 * only selects among routes the gateway actually opened for the model; it
 * never invents a route.
 */
function protocolFamilyOf(id: string | undefined): "claude" | "gemini" | undefined {
	const base = (id ?? "").trim().toLowerCase().split("/").pop() ?? "";
	if (base.startsWith("claude")) return "claude";
	if (base.startsWith("gemini")) return "gemini";
	return undefined;
}

/**
 * Map the gateway's `endpoints` field to a Pi protocol and endpoint.
 *
 * Family-aware, capability-gated precedence (deliberately diverging from the
 * official package's chat-first rule):
 * 1. A claude-family id with `claude_api` open → Anthropic Messages.
 * 2. A gemini-family id with `gemini_api` open → Gemini.
 * 3. `responses` open → OpenAI Responses (the official package lacks this
 *    branch and would flatten these models to Chat Completions).
 * 4. `chat_completions` open or endpoints empty → OpenAI Chat Completions.
 * 5. Remaining native routes (non-family ids, no chat) → their protocol.
 * Unknown route tokens fall back to Chat Completions rather than dropping the
 * model, matching this extension's tolerant normalization.
 */
export function resolveProtocol(
	endpoints: string | string[] | undefined,
	origin: string,
	id?: string,
): ProtocolRoute {
	const routes = parseList(endpoints);
	const family = protocolFamilyOf(id ?? "");
	if (family === "claude" && routes.includes("claude_api")) {
		return { api: "anthropic-messages", baseUrl: origin };
	}
	if (family === "gemini" && routes.includes("gemini_api")) {
		return { api: "google-generative-ai", baseUrl: `${origin}/gemini/v1beta` };
	}
	if (routes.includes("responses")) {
		return { api: "openai-responses", baseUrl: `${origin}/v1` };
	}
	if (routes.length === 0 || routes.includes("chat_completions")) {
		return { api: "openai-completions", baseUrl: `${origin}/v1` };
	}
	if (routes.includes("claude_api")) {
		return { api: "anthropic-messages", baseUrl: origin };
	}
	if (routes.includes("gemini_api")) {
		return { api: "google-generative-ai", baseUrl: `${origin}/gemini/v1beta` };
	}
	return { api: "openai-completions", baseUrl: `${origin}/v1` };
}

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
	/** Gateway origin that all routes are rebased onto (no trailing slash). */
	origin: string;
	priceMultiplier: number;
	defaultContextWindow: number;
	defaultMaxTokens: number;
};

/** Discovery callers supply the origin from their own config. */
export type DiscoveryNormalizeOptions = Omit<NormalizeOptions, "origin">;

export type ProviderModel = {
	id: string;
	name: string;
	api: ProviderApi;
	baseUrl: string;
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
	const route = resolveProtocol(metadata?.endpoints, options.origin, id);

	return {
		id,
		name: displayName || id,
		api: route.api,
		baseUrl: route.baseUrl,
		reasoning:
			features.includes("thinking") ||
			features.includes("reasoning") ||
			metadata?.reasoning === true ||
			String(metadata?.reasoning).toLowerCase() === "true",
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

/**
 * Group models by vendor, newest first within each group.
 *
 * The upstream availability endpoint returns models in an unstable order that
 * interleaves vendors, so `models.json` ends up shuffled on every refresh and
 * a human scanning it cannot find a family. Two constraints shape this:
 *
 * - `created` is unusable: all 401 upstream entries report the same constant
 *   (1626777600), so it carries no release-date information. The version
 *   number embedded in the id is the only available proxy, so ids sort by
 *   descending numeric version (gpt-5.6 before gpt-5.5, claude-opus-5 before
 *   claude-opus-4-8).
 * - `owned_by` is real but dirty: it contains case variants (OpenAI/Openai,
 *   InclusionAI/Inclusionai) that must fold together, plus Llama/Meta which
 *   name the same vendor.
 *
 * Vendor order is by descending group size, so the families a user is most
 * likely to want appear first, with a stable name tiebreak.
 */
const VENDOR_ALIASES = new Map([
	["openai", "OpenAI"],
	["llama", "Meta"],
	["meta", "Meta"],
	["inclusionai", "InclusionAI"],
	["z.ai", "Z.AI"],
	["jina ai", "Jina AI"],
	["moonshot ai", "Moonshot AI"],
	["dots studio", "Dots Studio"],
]);

export function canonicalVendor(ownedBy: string | undefined): string {
	const raw = ownedBy?.trim();
	if (!raw) return "Other";
	return VENDOR_ALIASES.get(raw.toLowerCase()) ?? raw;
}

/**
 * Extract the comparable version segments from a model id.
 *
 * `claude-opus-4-8` yields [4, 8] and `gpt-5.6-sol` yields [5, 6], so a plain
 * lexicographic id compare (which puts 5.6 before 5.5 but also gpt-4 before
 * gpt-5.6 inconsistently) is avoided.
 *
 * Two classes of digits are *not* versions and were observed to dominate the
 * real ordering if naively collected:
 *
 * - date stamps (`o1-2024-12-17`, `qwen3-max-2026-01-23`) — a 2024 would
 *   outrank a 5.6, pushing legacy dated snapshots above current flagships.
 * - parameter counts (`gpt-oss-120b`, `lfm-2.5-2.6b`) — 120 is model size,
 *   not a release.
 *
 * Dates are returned separately so they still break ties between two
 * otherwise identically versioned snapshots, newest first.
 */
export function modelVersionKey(id: string): number[] {
	return parseModelOrder(id).versions;
}

function parseModelOrder(id: string): { versions: number[]; date: number } {
	// Strip the date stamp first so its segments cannot be read as versions.
	const dateMatch = id.match(/(20\d{2})[-.]?(\d{2})[-.]?(\d{2})/);
	const date = dateMatch
		? Number(`${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}`)
		: 0;
	const withoutDate = dateMatch ? id.replace(dateMatch[0], " ") : id;

	const versions: number[] = [];
	for (const match of withoutDate.matchAll(/(\d+(?:\.\d+)?)([a-z]*)/g)) {
		// A digit run followed by a size suffix is a parameter count, not a version
		// (gpt-oss-120b, lfm-2.5-2.6b). A bare digit run attached to a family name
		// still is one (o1, qwen3).
		if (/^(?:b|m|k)$/.test(match[2])) continue;
		const value = Number(match[1]);
		if (Number.isFinite(value)) versions.push(value);
	}
	return { versions, date };
}

function compareVersionsDescending(left: string, right: string): number {
	const a = parseModelOrder(left);
	const b = parseModelOrder(right);
	for (let index = 0; index < Math.max(a.versions.length, b.versions.length); index += 1) {
		const x = a.versions[index] ?? -1;
		const y = b.versions[index] ?? -1;
		if (x !== y) return y - x;
	}
	if (a.date !== b.date) return b.date - a.date;
	// Same version: keep it deterministic so refreshes produce identical files.
	return left.localeCompare(right);
}

export function sortModelsByVendor(
	models: ProviderModel[],
	vendorById: Map<string, string>,
): ProviderModel[] {
	const groups = new Map<string, ProviderModel[]>();
	for (const model of models) {
		const vendor = vendorById.get(model.id) ?? "Other";
		const group = groups.get(vendor);
		if (group) group.push(model);
		else groups.set(vendor, [model]);
	}

	const orderedVendors = [...groups.keys()].sort((left, right) => {
		// "Other" is a catch-all, not a vendor; keep it last regardless of size.
		if (left === "Other") return 1;
		if (right === "Other") return -1;
		const sizeDelta = (groups.get(right)?.length ?? 0) - (groups.get(left)?.length ?? 0);
		return sizeDelta !== 0 ? sizeDelta : left.localeCompare(right);
	});

	return orderedVendors.flatMap((vendor) =>
		[...(groups.get(vendor) ?? [])].sort((left, right) => compareVersionsDescending(left.id, right.id)),
	);
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
	const vendorById = new Map<string, string>();

	for (const entry of available) {
		const id = entry.id?.trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);

		const details = metadataById.get(id);
		if (details) {
			models.push(normalizeModel(entry, details, options));
			vendorById.set(id, canonicalVendor(entry.owned_by));
		}
	}

	if (available.length > 0 && models.length === 0) {
		throw new Error(
			"AIHubMix availability and metadata endpoints returned no matching model IDs",
		);
	}

	return sortModelsByVendor(models, vendorById);
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
	normalizeOptions: DiscoveryNormalizeOptions;
};

export type DiscoveryDependencies = {
	fetchImpl?: FetchImplementation;
	readCacheImpl?: typeof readCache;
	writeCacheImpl?: typeof writeCache;
	warn?: (message: string) => void;
	modelsJson?: ModelsJsonDependencies;
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
	const vendorById = new Map<string, string>();

	for (const availableModel of available) {
		const id = availableModel.id?.trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		models.push(
			normalizeModel(availableModel, metadataById.get(id), options),
		);
		vendorById.set(id, canonicalVendor(availableModel.owned_by));
	}

	// This degraded path (metadata endpoint unavailable) must group identically
	// to the primary one, or models.json ordering would depend on which upstream
	// endpoint happened to answer.
	return sortModelsByVendor(models, vendorById);
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
	const normalizeOptions: NormalizeOptions = {
		...config.normalizeOptions,
		origin: config.origin,
	};
	const cacheMaxAgeMs = config.cacheMaxAgeMs ?? 6 * 60 * 60 * 1000;
	if (
		cache &&
		cache.available.length > 0 &&
		cache.metadata.length > 0 &&
		Date.now() - Date.parse(cache.fetchedAt) <= cacheMaxAgeMs
	) {
		return mergeLiveModels(cache.available, cache.metadata, normalizeOptions);
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
				normalizeOptions,
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
			normalizeOptions,
		);
	}

	if (cache) {
		warn(
			`AIHubMix live availability discovery failed; using complete cache from ${cache.fetchedAt}: ${availabilityResult.error.message}`,
		);
		return mergeLiveModels(
			cache.available,
			cache.metadata,
			normalizeOptions,
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

type ProviderRegistrar = Pick<ExtensionAPI, "registerProvider" | "on">;

type Environment = Record<string, string | undefined>;

function parsePositiveNumber(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** The official gateway host whose paths are rebased onto `AIHUBMIX_ORIGIN`. */
const OFFICIAL_GATEWAY_HOST = "aihubmix.com";

/**
 * Rewrite a gateway URL onto the configured origin, preserving the protocol
 * path: `/v1` (Chat Completions, Responses), the bare origin (Anthropic
 * Messages), `/gemini/v1beta` (Gemini). URLs on other hosts are untouched.
 */
export function rebaseBaseUrl(
	baseUrl: string | undefined,
	origin: string,
): string | undefined {
	if (!baseUrl) return baseUrl;
	let parsed: URL;
	try {
		parsed = new URL(baseUrl);
	} catch {
		return baseUrl;
	}
	if (parsed.hostname !== OFFICIAL_GATEWAY_HOST) return baseUrl;
	const path = parsed.pathname.replace(/\/+$/, "");
	return `${origin}${path}`;
}

/** Pi model object as the runtime sees it (only the fields this module touches). */
export type NativeModel = Record<string, unknown> & {
	id: string;
	api: string;
	provider?: string;
	baseUrl?: string;
	type?: string;
};

export type NativeProvider = Record<string, unknown> & {
	id: string;
	name?: string;
	baseUrl?: string;
	getModels: () => readonly NativeModel[];
	getAllModels?: () => readonly NativeModel[];
	refreshModels?: (context: RefreshModelsContextLike) => Promise<void>;
};

export type RefreshModelsContextLike = {
	stored?: { models?: readonly NativeModel[] };
	publish: (publication: {
		persist?: unknown;
		update?: () => void;
	}) => Promise<boolean>;
	allowNetwork?: boolean;
	signal: AbortSignal;
};

const REBASED_PROVIDER = Symbol.for("cyberbrain.aihubmix.rebased");

export function isRebasedProvider(provider: object): boolean {
	return Boolean((provider as Record<symbol, unknown>)[REBASED_PROVIDER]);
}

/**
 * Compatibility flags the official package applies to its Chat Completions
 * models. Kept in parity so a rebased catalog behaves like the official one.
 */
const OPENAI_COMPAT = {
	supportsStore: false,
	supportsDeveloperRole: false,
	maxTokensField: "max_tokens" as const,
	requiresThinkingAsText: true,
};

export function toNativeModel(model: ProviderModel, providerId: string): NativeModel {
	return {
		id: model.id,
		name: model.name,
		api: model.api,
		provider: providerId,
		baseUrl: model.baseUrl,
		reasoning: model.reasoning,
		input: model.input,
		cost: model.cost,
		contextWindow: model.contextWindow,
		maxTokens: model.maxTokens,
		...(model.api === "openai-completions" ? { compat: OPENAI_COMPAT } : {}),
	};
}

function rebaseNativeModel<M extends NativeModel>(model: M, origin: string): M {
	const baseUrl = rebaseBaseUrl(model.baseUrl, origin);
	return baseUrl === model.baseUrl ? model : { ...model, baseUrl };
}

function modelTypeOf(model: NativeModel): string {
	return typeof model.type === "string" && model.type ? model.type : "chat";
}

/** Same merge as the official `createProvider`: the fetched catalog upserts by id. */
function mergeNativeModels(
	baseline: readonly NativeModel[],
	dynamic: readonly NativeModel[] | undefined,
): NativeModel[] {
	const merged = [...baseline];
	for (const model of dynamic ?? []) {
		const type = modelTypeOf(model);
		const index = merged.findIndex(
			(entry) => modelTypeOf(entry) === type && entry.id === model.id,
		);
		if (index >= 0) merged[index] = model;
		else merged.push(model);
	}
	return merged;
}

export type OriginCatalogDependencies = {
	fetchImpl?: FetchImplementation;
	timeoutMs: number;
	normalizeOptions: DiscoveryNormalizeOptions;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const EXCLUDED_LLM_TYPES = new Set([
	"audio",
	"embedding",
	"embeddings",
	"image_generation",
	"moderation",
	"rerank",
	"reranking",
	"stt",
	"t2i",
	"t2v",
	"tts",
	"video",
]);

/**
 * Fetch the gateway catalog the official package uses, from the configured
 * origin instead of `aihubmix.com`. Kept in parity with the official mapping:
 * only LLM entries with the required metadata are registered.
 */
export async function fetchOriginModels(
	origin: string,
	signal: AbortSignal,
	dependencies: OriginCatalogDependencies,
): Promise<ProviderModel[]> {
	const fetchImpl = dependencies.fetchImpl ?? fetch;
	const combined = AbortSignal.any([
		signal,
		AbortSignal.timeout(dependencies.timeoutMs),
	]);
	const response = await fetchImpl(`${origin}/api/v1/models?types=llm`, {
		headers: { Accept: "application/json" },
		signal: combined,
	});
	if (!response.ok) {
		throw new Error(`AIHubMix catalog endpoint returned HTTP ${response.status}`);
	}

	const payload: unknown = await response.json();
	const data = isRecord(payload) ? payload.data : undefined;
	if (!Array.isArray(data)) {
		throw new Error("AIHubMix catalog response does not contain a data array");
	}

	const normalizeOptions: NormalizeOptions = {
		...dependencies.normalizeOptions,
		origin,
	};
	const models: ProviderModel[] = [];
	const seen = new Set<string>();
	for (const entry of data) {
		if (!isRecord(entry)) continue;
		const types = parseList(entry.types as string | string[] | undefined);
		if (!types.includes("llm")) continue;
		if (types.some((type) => EXCLUDED_LLM_TYPES.has(type))) continue;
		const id = String(entry.model_id ?? "").trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		models.push(normalizeModel({ id }, entry as DetailedModel, normalizeOptions));
	}
	return models;
}

/**
 * Wrap the native provider so every gateway endpoint points at `origin` while
 * keeping the provider's protocol assignment (`api`) intact. The catalog
 * refresh is rewritten too: the official fetch is hard-coded to
 * `https://aihubmix.com/api/v1/models?types=llm`, which is unreachable on
 * networks that can only reach the configured origin.
 */
export function rebaseNativeProvider(
	provider: NativeProvider,
	origin: string,
	catalog: OriginCatalogDependencies,
): NativeProvider {
	let dynamic: readonly NativeModel[] | undefined;
	const baseline = (provider.getAllModels?.() ?? provider.getModels()).map(
		(model) => rebaseNativeModel(model, origin),
	);
	const current = () => mergeNativeModels(baseline, dynamic);

	const wrapped: NativeProvider = {
		...provider,
		baseUrl: rebaseBaseUrl(provider.baseUrl, origin),
		getModels: () => current().filter((model) => modelTypeOf(model) === "chat"),
		getAllModels: () => current(),
		refreshModels: async (context) => {
			if (context.stored?.models) {
				const restored = context.stored.models
					.filter((model) => model.provider === provider.id)
					.map((model) => rebaseNativeModel(model, origin));
				const published = await context.publish({
					update: () => {
						dynamic = restored;
					},
				});
				if (!published) return;
			}
			if (context.allowNetwork === false || context.signal.aborted) return;
			const fetched = await fetchOriginModels(origin, context.signal, catalog);
			if (context.signal.aborted || fetched.length === 0) return;
			const models = fetched.map((model) => toNativeModel(model, provider.id));
			await context.publish({
				persist: { models, checkedAt: Date.now() },
				update: () => {
					dynamic = models;
				},
			});
		},
	};
	Object.defineProperty(wrapped, REBASED_PROVIDER, {
		value: true,
		enumerable: false,
	});
	return wrapped;
}

export function registerAIHubMix(
	pi: ProviderRegistrar,
	environment: Environment = process.env,
	dependencies: DiscoveryDependencies = {},
): void {
	const origin = (
		environment.AIHUBMIX_ORIGIN || DEFAULT_ORIGIN
	).replace(/\/+$/, "");
	const catalog: OriginCatalogDependencies = {
		fetchImpl: dependencies.fetchImpl,
		timeoutMs: parsePositiveNumber(
			environment.AIHUBMIX_DISCOVERY_TIMEOUT_MS,
			15_000,
		),
		normalizeOptions: {
			priceMultiplier: parsePositiveNumber(
				environment.AIHUBMIX_PRICE_MULTIPLIER,
				1,
			),
			defaultContextWindow: 128_000,
			defaultMaxTokens: 16_384,
		},
	};
	// The host owns authentication. Context is only available after extension loading.
	pi.on("session_start", async (_event, ctx) => {
		const warn = dependencies.warn ?? ((message: string) => console.warn(message));
		const registry = ctx.modelRegistry;
		let apiKey: string | undefined;
		try {
			apiKey =
				(await registry.getApiKeyForProvider(AIHUBMIX_PROVIDER_ID))?.trim() ||
				undefined;
		} catch (error) {
			warn(`AIHubMix credential lookup failed: ${asError(error).message}`);
		}
		try {
			const native = registry.getRegisteredNativeProvider?.(AIHUBMIX_PROVIDER_ID) as
				| NativeProvider
				| undefined;
			// A native provider (for example the official package) owns models, auth
			// and protocol routing; only its endpoints are rebased.
			if (native && !isRebasedProvider(native)) {
				registry.registerProvider(rebaseNativeProvider(native, origin, catalog));
			}
		} catch (error) {
			warn(`AIHubMix endpoint rebase failed (provider left untouched): ${asError(error).message}`);
		}

		let wrote = false;
		if (modelsJsonRefreshEnabled(environment) && apiKey) {
			try {
				const refreshed = await refreshAIHubMixModelsJson(origin, apiKey, environment, dependencies);
				wrote = refreshed.status === "created" || refreshed.status === "updated";
			} catch (error) {
				warn(`AIHubMix models.json refresh failed: ${asError(error).message}`);
			}
		}

		if (wrote) {
			try {
				await registry.refresh({ allowNetwork: false });
			} catch (error) {
				warn(`AIHubMix models.json reload failed: ${asError(error).message}`);
			}
		}
	});
}

function modelsJsonPath(environment: Environment): string {
	return (
		environment.AIHUBMIX_MODELS_JSON_PATH?.trim() ||
		defaultModelsJsonPath(environment)
	);
}

async function refreshAIHubMixModelsJson(
	origin: string,
	apiKey: string,
	environment: Environment,
	dependencies: DiscoveryDependencies,
): Promise<RefreshResult> {
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
				join(agentDir(environment), "cache", "aihubmix-models.json"),
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

	const providerConfig = {
		name: AIHUBMIX_PROVIDER_NAME,
		models,
	};

	// Publish the discovered catalog for models.json readers, including Raft.
	// Pi merges this catalog with its native provider on registry refresh.
	return refreshModelsJsonProvider(
		{
			path: modelsJsonPath(environment),
			providerId: AIHUBMIX_PROVIDER_ID,
			config: providerConfig,
		},
		dependencies.modelsJson,
	);
}

function modelsJsonRefreshEnabled(environment: Environment): boolean {
	const flag = environment.AIHUBMIX_MODELS_JSON_REFRESH?.trim().toLowerCase();
	return flag !== "0" && flag !== "false" && flag !== "off" && flag !== "no";
}

export default registerAIHubMix;
