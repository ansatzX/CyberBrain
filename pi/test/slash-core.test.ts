import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildSlashMessage, loadSlashDefinitions, mergeSlashDefinitions, shouldPersistMode } from "../lib/slash-core.ts";

test("loadSlashDefinitions parses empty namespace without consuming description", () => {
	const dir = mkdtempSync(join(tmpdir(), "slashes-"));
	try {
		writeFileSync(join(dir, "review.md"), `---\nname: review\nnamespace:\ndescription: Review code\nscope: once\n---\nReview carefully\n`);
		const [def] = loadSlashDefinitions(dir);
		assert.equal(def.namespace, "ansatz");
		assert.equal(def.description, "Review code");
		assert.equal(def.scope, "once");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("buildSlashMessage sends only the task because the prompt is injected by hook", () => {
	assert.equal(buildSlashMessage("HEAD~2"), "任务：HEAD~2");
	assert.equal(buildSlashMessage(""), null);
});

test("only session-scoped modes persist after the activating agent run", () => {
	assert.equal(shouldPersistMode("once"), false);
	assert.equal(shouldPersistMode("session"), true);
});


test("home slash overrides package definition with one warning", () => {
	const warnings: string[] = [];
	const packageDef = { name: "review", namespace: "ansatz", description: "package", prompt: "package", scope: "once" as const };
	const homeDef = { ...packageDef, description: "home", prompt: "home" };
	const merged = mergeSlashDefinitions([packageDef], [homeDef], (message) => warnings.push(message));
	assert.equal(merged.length, 1);
	assert.equal(merged[0].prompt, "home");
	assert.equal(warnings.length, 1);
	assert.match(warnings[0], /ansatz:review/);
});
