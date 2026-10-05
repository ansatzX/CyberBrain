import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerAIHubMix } from "../lib/third-party/aihubmix.ts";

export function availableModel(id: string) {
	return {
		id,
		object: "model",
		created: 1_626_777_600,
		owned_by: "test",
	};
}

export function detailedModel(
	model_id: string,
	overrides: Record<string, unknown> = {},
) {
	return {
		model_id,
		model_name: model_id,
		types: "llm",
		features: "tools",
		input_modalities: "text",
		context_length: 128_000,
		max_output: 16_384,
		pricing: {
			input: 1,
			output: 2,
			cache_read: 0.1,
			cache_write: 1.25,
		},
		...overrides,
	};
}

/**
 * Exercise extension load and session startup separately using host-resolved auth.
 *
 * The catalog mirror writes models.json on session start, so the fixture
 * redirects an unspecified AIHUBMIX_MODELS_JSON_PATH into a temp directory:
 * tests must never touch the developer's real ~/.pi/agent/models.json.
 */
export async function runAIHubMix(
	registrar: { registerProvider: (...args: any[]) => unknown },
	environment: Record<string, string | undefined>,
	dependencies: Parameters<typeof registerAIHubMix>[2],
	apiKey: string | undefined = "pi-stored-test-key",
	nativeProvider?: unknown,
	onNativeProvider?: (provider: any) => void,
) {
	const temporaryDir =
		environment.AIHUBMIX_MODELS_JSON_PATH === undefined
			? await mkdtemp(join(tmpdir(), "aihubmix-fixture-"))
			: undefined;
	const effectiveEnvironment =
		temporaryDir === undefined
			? environment
			: {
					...environment,
					AIHUBMIX_MODELS_JSON_PATH: join(temporaryDir, "models.json"),
				};

	try {
		let start: any;
		registerAIHubMix(
			{
				...registrar,
				on: (event: string, handler: any) => {
					assert.equal(event, "session_start");
					start = handler;
				},
			} as Parameters<typeof registerAIHubMix>[0],
			effectiveEnvironment,
			dependencies,
		);
		let reloads = 0;
		await start(
			{},
			{
				modelRegistry: {
					getApiKeyForProvider: async (provider: string) => {
						assert.equal(provider, "aihubmix");
						return apiKey;
					},
					getRegisteredNativeProvider: (provider: string) => {
						assert.equal(provider, "aihubmix");
						return nativeProvider;
					},
					registerProvider: (provider: any) => {
						onNativeProvider?.(provider);
					},
					refresh: async (options: unknown) => {
						assert.deepEqual(options, { allowNetwork: false });
						reloads++;
					},
				},
			},
		);
		return reloads;
	} finally {
		if (temporaryDir !== undefined) {
			await rm(temporaryDir, { recursive: true, force: true });
		}
	}
}
