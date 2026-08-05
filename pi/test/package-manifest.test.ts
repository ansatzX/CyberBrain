import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const piRoot = resolve(testDir, "..");
const repoRoot = resolve(piRoot, "..");
const packageJsonPath = resolve(piRoot, "package.json");

test("manifest defines the local cyberbrain-pi package", () => {
	assert.equal(existsSync(packageJsonPath), true, "pi/package.json must exist");
	const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
	assert.equal(pkg.name, "cyberbrain-pi");
	assert.equal(pkg.private, true);
	assert.ok(pkg.keywords.includes("pi-package"));
	assert.deepEqual(pkg.pi.extensions, ["./extensions/*.ts", "node_modules/pi-subagents/index.ts"]);
	assert.deepEqual(pkg.pi.subagents.agents, ["./subagents"]);
});

test("pi-subagents is a declared, bundled dependency referenced through node_modules", () => {
	const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
	assert.ok(pkg.dependencies?.["pi-subagents"], "pi-subagents must be a runtime dependency");
	assert.ok(pkg.bundledDependencies?.includes("pi-subagents"), "pi-subagents must be bundled");
	assert.ok(pkg.pi.skills.includes("node_modules/pi-subagents/skills"));
	assert.deepEqual(pkg.pi.prompts, ["node_modules/pi-subagents/prompts"]);
	// node_modules 由 `npm --prefix pi install --legacy-peer-deps` 生成；
	// 已安装时资源必须真实存在，未安装时由 doctor 报错提示。
	const subagentsRoot = resolve(piRoot, "node_modules/pi-subagents");
	if (existsSync(subagentsRoot)) {
		for (const file of ["index.ts", "skills/pi-subagents/SKILL.md", "prompts"]) {
			assert.equal(existsSync(resolve(subagentsRoot, file)), true, file);
		}
	}
});

test("pi-extension-dev is packaged with valid relative references", () => {
	const skillRoot = resolve(piRoot, "skills/pi-extension-dev");
	assert.equal(existsSync(skillRoot), true, "pi-extension-dev must be packaged");
	const skill = readFileSync(resolve(skillRoot, "SKILL.md"), "utf8");
	assert.match(skill, /^---\nname: pi-extension-dev/m);
	for (const file of [
		"docs/api-reference.md",
		"docs/events.md",
		"docs/pitfalls.md",
		"docs/verification.md",
		"examples/namespaced-command.ts",
	]) {
		assert.equal(existsSync(resolve(skillRoot, file)), true, file);
	}
});

test("pick-model and agent-cluster are packaged Pi skills", () => {
	const pickModelPath = resolve(piRoot, "skills/pick-model/SKILL.md");
	assert.equal(existsSync(pickModelPath), true, "pick-model must be packaged");
	const pickModel = readFileSync(pickModelPath, "utf8");
	assert.match(pickModel, /^---\nname: pick-model\n/m);
	assert.match(pickModel, /omitted `model`.*parent-session model/s);
	assert.match(pickModel, /omitted `thinking`.*not.*reliable request/s);
	assert.match(pickModel, /Server-side Responses search and launch-tool network access/);
	assert.match(pickModel, /deepseek-responses\/deepseek-v4-flash/);
	assert.match(pickModel, /## User evaluation registry/);
	assert.match(pickModel, /DeepSeek thinking levels/);
	assert.match(pickModel, /prefer `high` or `max`/);

	const clusterPath = resolve(piRoot, "skills/agent-cluster/SKILL.md");
	assert.equal(existsSync(clusterPath), true, "agent-cluster must be packaged");
	const cluster = readFileSync(clusterPath, "utf8");
	assert.match(cluster, /^---\nname: agent-cluster\n/m);
	assert.match(cluster, /`team-leader`/);
	assert.match(cluster, /`pick-model`/);
	assert.match(cluster, /should a cluster exist at all/);
});

test("manifest exposes every approved Cyberbrain skill root from one source", () => {
	assert.equal(existsSync(packageJsonPath), true, "pi/package.json must exist");
	const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
	assert.deepEqual(pkg.pi.skills, [
		"./skills",
		"../plugins/brain/skills",
		"../plugins/tachikoma/skills",
		"../plugins/awesome-agent-select/skills",
		"node_modules/pi-subagents/skills",
	]);
	for (const relativePath of pkg.pi.skills) {
		if (relativePath.startsWith("node_modules/")) continue; // 由 npm install 生成
		assert.equal(existsSync(resolve(piRoot, relativePath)), true, relativePath);
	}
	assert.equal(existsSync(resolve(repoRoot, "plugins/brain/skills/codex-compatible/SKILL.md")), true);
	assert.equal(existsSync(resolve(repoRoot, "plugins/awesome-agent-select/skills/team-leader/SKILL.md")), true);
});
