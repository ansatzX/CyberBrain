# Skill validation

Run from the repository root with the same modern Node runtime used by the Pi
unit tests (Node 22.18+ or Node 24 recommended for built-in TypeScript support):

```bash
node tools/validate-skills.mjs
```

This is the required automated gate for skill/example changes. It checks metadata,
local references, generated adapters, the Pi round helper, and the actual
pi-subagents public boundary and workflow executor using mocked child launches.
It makes no inference calls and does not install packages or alter user settings.
The entrypoint runs:

| Check | Evidence |
| --- | --- |
| Workflow contract | Public normalization and execution of the same [example files](../../skills/agent-cluster/SKILL.md#verified-launch-examples) linked by the skill; mocked child success/failure and structured output validation |
| Skill metadata | Frontmatter, UI metadata and local reference validity |
| Pi round helper | Exit status preservation, output capture and resumed boundary checks |
| Required dependency gate | Missing packages and unverified versions fail clearly |
| Generated roles | Both host adapters match canonical profiles |

The durable entrypoint is [tools/validate-skills.mjs](../../../tools/validate-skills.mjs).
Use the [Pi development guide](../../README.md#development) for ordinary runtime tests.

The checked dependency versions are in [skill-runtime.json](../skill-runtime.json):
pi-subagents 0.53.0, jiti 2.7.0, yaml 2.8.3, typebox 1.1.38 and acorn 8.18.0.
Use an existing package installation with those resolved dependencies, or provision
that exact toolchain in a separate test environment through your package manager.
The default lookup uses `PI_CODING_AGENT_DIR` (otherwise `~/.pi/agent`) followed by
`npm/node_modules/pi-subagents`. To select a checkout/installation explicitly:

```bash
PI_SUBAGENTS_PACKAGE_ROOT=/absolute/path/to/pi-subagents node tools/validate-skills.mjs
```

The directory must contain the package's source and resolved dependencies.
Missing packages or mismatched versions fail the gate; nothing is silently skipped.
The ordinary `node --test pi/test/*.test.ts` suite remains usable without this
optional host installation, but is not a substitute for the skill gate. A version
match alone is not compatibility evidence: the gate also executes the public API.

When upgrading, inspect the new source/API, update examples and the version record
as needed, then rerun the gate. Do not merely loosen the version check to make it
pass. The version record describes the tested toolchain, not pinned user models
or a requirement to upgrade the user's global installation.

## Trigger and decision evaluation

[cases.json](cases.json) contains realistic requests and raw context, including
positive triggers, non-triggers, cached/changed CLI contracts and failure recovery.
[rubric.json](rubric.json) contains acceptance criteria for the reviewer only.

For substantive changes to routing or workflow instructions:

1. Give an independent evaluator `cases.json` and access to the listed skills and
   their linked references. Withhold the rubric, intended fixes and prior results.
2. Ask it to decide which skills/references apply and describe its concrete next
   action, stopping condition and required artifacts for each case. Permit only
   reading and decision simulation: no commands against a live CLI, launches,
   network requests or workspace edits.
3. Compare its response to the rubric. Score each criterion pass/fail/uncertain,
   record evidence and limitations, and fix demonstrated contradictions.
4. Save the evaluation result in the current task record, including date, skill
   revision or worktree state and evaluator context. Do not replace evaluation
   with heading/keyword assertions or report fixture parsing as a behavior pass.

The automated gate does not run this language-model evaluation. If independent
evaluation is unavailable or unauthorized, record that gap instead of claiming
behavioral coverage. One pass is a regression sample, not proof for all prompts.

The current case set covers ordinary engineering tests, scientific experiment
design, specified calculations, single-agent review, failed-writer takeover,
role-default selection, provider search checks, one-call execution, a changed CLI
and failed resume. It also covers read-only workflow audits, preservation during
reinstallation, package versus global Pi delivery, goal lock contention, and
Flash search evidence on an explicitly selected Responses route (not the default
Anthropic route). Add or revise cases when a behavior contract changes; keep
requests and raw context separate from the reviewer’s expected decisions.

Do not store a permanent “all skills pass” claim here. Record each evaluation
against the actual revision/worktree and toolchain in its task evidence; repeat
relevant scenarios when those inputs change.
