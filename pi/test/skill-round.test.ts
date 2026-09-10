import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = resolve(import.meta.dirname, "../../plugins/tachikoma/skills/pi/scripts/run-round.sh");
test("Pi round preserves read-only tools and failures without replaying logs or changing resumed scope", () => {
	const root = mkdtempSync(join(tmpdir(), "skill-round-"));
	try {
		mkdirSync(join(root, "bin"));
		mkdirSync(join(root, "target"));
		writeFileSync(join(root, "prompt"), "Inspect the parser; do not edit.");
		writeFileSync(join(root, "bin/pi"), '#!/usr/bin/env bash\nprintf "%s\\n" "$@" > "$CAPTURE"\necho RAW-RESPONSE\necho RAW-ERROR >&2\nexit "${FAKE_STATUS:-0}"\n', { mode: 0o755 });
		const env = { ...process.env, PATH: `${join(root, "bin")}:${process.env.PATH}`, CAPTURE: join(root, "args"), FAKE_STATUS: "17" };
		const args = [script, join(root, "target"), join(root, "logs"), "audit-session", "1", "read-only", join(root, "prompt")];
		let result = spawnSync("bash", args, { env, encoding: "utf8" });
		assert.equal(result.status, 17);
		assert.doesNotMatch(result.stdout + result.stderr, /RAW-RESPONSE|RAW-ERROR/);
		assert.match(readFileSync(join(root, "logs/session.log"), "utf8"), /RAW-RESPONSE\nRAW-ERROR/);
		assert.deepEqual(readFileSync(join(root, "args"), "utf8").trim().split("\n"), ["--session-id", "audit-session", "--tools", "read,grep,find,ls", "--print", "Inspect the parser; do not edit."]);
		args[4] = "2";
		result = spawnSync("bash", args, { env: { ...env, FAKE_STATUS: "0" }, encoding: "utf8" });
		assert.equal(result.status, 0);
		args[5] = "workspace-write";
		result = spawnSync("bash", args, { env, encoding: "utf8" });
		assert.equal(result.status, 2);
		assert.match(result.stderr, /boundary changed/);
	} finally { rmSync(root, { recursive: true, force: true }); }
});
