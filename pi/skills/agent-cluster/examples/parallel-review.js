// Workflow statement body for pi-subagents; not a standalone Node script.
const schema = {
  type: "object",
  properties: {
    files: { type: "array", items: { type: "string" } },
    limitations: { type: "string" },
  },
  required: ["files", "limitations"],
  additionalProperties: false,
};

const results = await runs.all([
  {
    key: "parser",
    agent: "reviewer",
    task: "Map src/parser. Read-only. Return relevant files and limitations.",
    context: "fresh",
    outputSchema: schema,
  },
  {
    key: "storage",
    agent: "reviewer",
    task: "Map src/storage. Read-only. Return relevant files and limitations.",
    context: "fresh",
    outputSchema: schema,
  },
]);
if (results.some(result => !result.ok)) {
  throw new Error("Review incomplete; inspect child results.");
}
return results;
