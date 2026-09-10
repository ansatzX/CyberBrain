import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { agentDir } from "../lib/agent-paths.ts";
import { goalFilePath } from "../lib/goal-core.ts";
import { defaultModelsJsonPath } from "../lib/third-party/models-json.ts";
import slashFramework from "../extensions/slash-framework.ts";
import { registerAIHubMix } from "../lib/third-party/aihubmix.ts";
import { availableModel, detailedModel } from "./fixtures.ts";

test("Pi directory override applies to goal, slash, models and provider cache", async () => {
	const root = mkdtempSync(join(tmpdir(), "agent-paths-"));
	const previous = process.env.PI_CODING_AGENT_DIR;
	const previousGoal = process.env.PI_GOAL_TEST_DIR;
	process.env.PI_CODING_AGENT_DIR = root;
	delete process.env.PI_GOAL_TEST_DIR;
	try {
		assert.equal(agentDir({}), join(homedir(), ".pi/agent"));
		assert.equal(agentDir({ PI_CODING_AGENT_DIR: "~/custom-pi" }), join(homedir(), "custom-pi"));
		assert.equal(defaultModelsJsonPath(process.env), join(root, "models.json"));
		assert.ok(goalFilePath("isolated").startsWith(join(root, "goals/")));
		mkdirSync(join(root, "slashes"));
		writeFileSync(join(root, "slashes/custom.md"), "---\nname: custom\ndescription: isolated slash\n---\nCustom prompt\n");
		const commands: string[] = [];
		slashFramework({ registerCommand(name: string) { commands.push(name); }, on() {} } as any);
		assert.ok(commands.includes("ansatz:custom"));
		let cachePath = "";
		await registerAIHubMix({ registerProvider() {} }, {
			PI_CODING_AGENT_DIR: root, AIHUBMIX_API_KEY: "test", AIHUBMIX_MODELS_JSON_REFRESH: "off",
		}, {
			readCacheImpl: async (path) => { cachePath = path; return undefined; },
			writeCacheImpl: async () => {},
			fetchImpl: async (input) => new Response(JSON.stringify({ data: String(input).endsWith("/v1/models") ? [availableModel("one")] : [detailedModel("one")] })),
		});
		assert.equal(cachePath, join(root, "cache/aihubmix-models.json"));
	} finally {
		if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
		else process.env.PI_CODING_AGENT_DIR = previous;
		if (previousGoal === undefined) delete process.env.PI_GOAL_TEST_DIR;
		else process.env.PI_GOAL_TEST_DIR = previousGoal;
		rmSync(root, { recursive: true, force: true });
	}
});
