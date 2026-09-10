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

const mapping = await runs.run("mapping", {
  agent: "reviewer",
  task: "Map the parser entrypoints. Read-only. Return files and limitations.",
  context: "fresh",
  outputSchema: schema,
});
if (!mapping.ok) {
  throw new Error("Mapping failed; do not launch the dependent review.");
}

const review = await runs.run("review", {
  agent: "reviewer",
  task: "Check these parser entrypoints. Read-only. Return files and limitations. Mapping: " + mapping.output,
  context: "fresh",
  outputSchema: schema,
});
if (!review.ok) {
  throw new Error("Review failed; inspect partial results.");
}
return review;
