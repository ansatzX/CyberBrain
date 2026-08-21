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
