import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("root docs describe both Codex and Pi adapters", () => {
	const readme = read("README.md");
	const agents = read("AGENTS.md");
	assert.match(readme, /Codex Installation/);
	assert.match(readme, /Pi Installation/);
	assert.match(agents, /host adapter/i);
	assert.doesNotMatch(agents, /CyberBrain is a Codex-only plugin marketplace/);
});
