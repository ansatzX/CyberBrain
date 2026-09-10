import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

import { loadSkillRuntime } from "../support/skill-runtime.mjs";

// This suite is required by tools/validate-skills.mjs; absent dependencies fail.
test("cluster examples execute through the installed public workflow boundary and validate child output", async () => {
  const { root, jiti } = await loadSkillRuntime();
  const { normalizePublicSubagentExecution } = await jiti.import(join(root, "src/extension/public-execution.ts"));
  const { runWorkflowScript } = await jiti.import(join(root, "src/workflows/scripted-workflow.ts"));
  const { validateStructuredOutputValue } = await jiti.import(join(root, "src/runs/shared/structured-output.ts"));
  const examples = ["parallel-review", "dependent-review"].map(name => ({
    workflowScript: readFileSync(resolve(import.meta.dirname, `../../skills/agent-cluster/examples/${name}.js`), "utf8"),
    async: true,
    timeoutMs: 600000,
  }));
  assert.equal(normalizePublicSubagentExecution({ tasks: [{ agent: "reviewer", task: "inspect" }] }).ok, false);
  for (const [index, example] of examples.entries()) {
    const normalized = normalizePublicSubagentExecution(example);
    assert.equal(normalized.ok, true, normalized.error);
    const calls: Array<{ key: string; params: any }> = [];
    const execute = (fail: boolean) => runWorkflowScript({
      script: normalized.params.workflowScript,
      timeoutMs: 10000,
      launch: async (key: string, params: any) => {
        calls.push({ key, params });
        assert.equal(params.context, "fresh");
        assert.equal(params.model, undefined);
        assert.equal((await validateStructuredOutputValue(params.outputSchema, { files: ["src/parser.ts"], limitations: "mocked" })).status, "valid");
        for (const invalid of [{}, { files: [42], limitations: "mocked" }]) {
          assert.equal((await validateStructuredOutputValue(params.outputSchema, invalid)).status, "invalid");
        }
        return { key, ok: !fail, output: "src/parser.ts", artifactPaths: [] };
      },
      status: async () => { throw new Error("Unexpected status lookup"); },
    });
    await execute(false);
    assert.equal(calls.length, 2);
    if (index === 1) assert.match(calls[1].params.task, /Mapping: src\/parser.ts/);
    calls.length = 0;
    await assert.rejects(execute(true), /incomplete|Mapping failed|Run .* failed/);
    assert.equal(calls.length, index === 0 ? 2 : 1);
  }
});
