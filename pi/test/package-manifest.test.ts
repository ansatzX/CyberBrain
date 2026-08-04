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
	assert.deepEqual(pkg.pi.extensions, ["./extensions/*.ts"]);
});

test("manifest exposes every approved Cyberbrain skill root from one source", () => {
	assert.equal(existsSync(packageJsonPath), true, "pi/package.json must exist");
	const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
	assert.deepEqual(pkg.pi.skills, [
		"./skills",
		"../plugins/brain/skills",
		"../plugins/tachikoma/skills",
		"../plugins/awesome-agent-select/skills",
	]);
	for (const relativePath of pkg.pi.skills) {
		assert.equal(existsSync(resolve(piRoot, relativePath)), true, relativePath);
	}
	assert.equal(existsSync(resolve(repoRoot, "plugins/brain/skills/codex-compatible/SKILL.md")), true);
	assert.equal(existsSync(resolve(repoRoot, "plugins/awesome-agent-select/skills/team-leader/SKILL.md")), true);
});
