import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { refreshModelsJsonProvider } from "../../lib/third-party/models-json.ts";

const [path, providerId] = process.argv.slice(2);
await refreshModelsJsonProvider({ path, providerId, config: {
	baseUrl: "https://example.test/v1", api: "openai-completions", models: [{ id: providerId }],
} }, { readFileImpl: (async (...args: Parameters<typeof readFile>) => {
	const text = await readFile(...args);
	// Make overlap between independent processes likely without coordinating inside the lock.
	await delay(80);
	return text;
}) as typeof readFile });
