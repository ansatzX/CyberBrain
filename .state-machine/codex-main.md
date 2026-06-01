# State Node

Node ID: codex-main
Parent Nodes:
- none
Working Directory: /Users/ansatz/data/code/Cyberbrain
Object: Ansatz Brain and Tachikoma skill set, especially state-machine and external CLI coordination rules.
Current State: ARTIFACTS_GENERATED
State Owner Role: actor
Last Updated: 2026-05-11

## Child Nodes

- None

## Open Gaps

- Decide whether the Python environment experience block should later be extracted into a dedicated skill.

## Evidence Register

- E001: User instruction in current conversation requesting an experience block about `uv`, `conda`, sandbox cache, and future skill extraction. Evidence Quality: human.
- E002: Current repository files under `/Users/ansatz/data/code/Cyberbrain`. Evidence Quality: direct.
- E003: Search results showing every `plugins/tachikoma/skills/*/SKILL.md` references `../_shared/agent-cli.md`, and no stale skill-level `2>/dev/null` remains outside the shared "do not discard stderr" protocol. Evidence Quality: direct.
- E004: User instruction requesting Claude Code and Codex tool-name compatibility across tachikoma skills. Evidence Quality: human.
- E005: Local Superpowers Codex tool mapping at `/Users/ansatz/.codex/plugins/cache/openai-curated/superpowers/63976030/skills/using-superpowers/references/codex-tools.md`. Evidence Quality: authority.
- E006: User instruction requesting Tachikoma sandbox policy to return to read-only by default, require `superpowers:using-git-worktrees` for code/workspace modifications, and require asynchronous multi-agent CLI launches in `plugins/tachikoma/commands/collab-fix.md`. Evidence Quality: human.
- E007: Searches over `plugins/tachikoma/skills`, `plugins/tachikoma/commands/collab-fix.md`, and `plugins/tachikoma/commands/TDD-debug.md` showing write-capable examples are scoped to fresh worktrees and `2>/dev/null` survives there only as an explicit anti-pattern warning. Evidence Quality: direct.
- E008: User instruction that `plugins/tachikoma/commands/TDD-debug.md` can also be updated under the same protocol. Evidence Quality: human.
- E009: User instruction describing a bad heredoc Python execution case and requiring meaningful scripts/complex shell operations to be written under working-dir-local `.scripts/`, kept after execution, and recorded in state-machine with script responsibility. Evidence Quality: human.
- E010: Durable audit script `.scripts/20260511-140614-plugin-coherence-audit.py` run with `UV_CACHE_DIR=./.cache/uv uv run python ...`; final output `SUMMARY: checks=130 failures=0`. Evidence Quality: direct.

## Transitions

## T001 - Add Python Environment Experience Block

Before State: `using-ansatz-brain` has always-active routing and state-machine foundations, but no explicit operational experience block for Python environment execution.
Action: Add an experience block to `using-ansatz-brain` documenting preferred Python execution through `uv` or `conda`, sandbox-local `UV_CACHE_DIR`, and `conda run` / `conda create` / `conda install` usage instead of shell activation.
After State: `using-ansatz-brain` includes the requested operational experience.
Implicit Claim: The controller now preserves this recurring operational lesson without prematurely extracting it into a standalone skill.
Authority: E001.
Representation / Proxy: Markdown guidance inside the controller skill.
Lost Information: Exact local conda binary path remains environment-specific and should be discovered or requested at use time.
Evidence IDs: E001, E002.
Evidence Quality: mixed.
Failure Mode: Agents may over-apply the block to tasks that do not use Python, or may forget to set `UV_CACHE_DIR` when running `uv` in sandbox.
Verification: Search for block text and validate skill metadata after edit.
Object Drift: none.
Status: verified.

## T003 - Add Host Tool Compatibility Mapping

Before State: Tachikoma skills used Claude Code-style tool names such as `AskUserQuestion`, which can confuse Codex-style hosts.
Action: Add host-agent compatibility mapping to the shared agent CLI protocol with explicit Codex tool names, and replace skill-local `AskUserQuestion` references with shared-protocol terminology.
After State: Tachikoma skills define Claude Code and Codex tool-name equivalents in one shared place and use neutral host terminology in individual skills.
Implicit Claim: The tachikoma skills are clearer for both Claude Code-style and Codex-style hosts.
Authority: E004.
Representation / Proxy: Shared Markdown mapping plus per-skill wording changes.
Lost Information: Exact host tool availability remains runtime-specific.
Evidence IDs: E004, E005.
Evidence Quality: mixed.
Failure Mode: A future skill may introduce host-specific tool names without adding them to the shared mapping.
Verification: Search for explicit Codex tool names in `_shared/agent-cli.md` and stale host-specific tool names in tachikoma skills after edit.
Object Drift: none.
Status: verified.

## T004 - Move Tachikoma Shared Protocol And Define State DAG

Before State: Tachikoma shared agent protocol lived directly under `skills/`; state-machine schema used a single `Parent Node`, implying a tree.
Action: Move the shared protocol to `skills/_shared/agent-cli.md`, update skill references, and change state-machine schema to `Parent Nodes` with DAG edge semantics.
After State: Shared protocol is under `_shared`; state nodes support multiple parents and children as a DAG.
Implicit Claim: The shared protocol remains within the `skills/` installation boundary while state-machine can represent non-tree agent dependencies.
Authority: User instruction in current conversation.
Representation / Proxy: File move, Markdown references, state schema text.
Lost Information: Parent nodes may not know about new children immediately; this is accepted by schema.
Evidence IDs: E002.
Evidence Quality: direct.
Failure Mode: A future installer might ignore underscore directories, or a future agent may treat `Child Nodes` as authoritative instead of `Parent Nodes`.
Verification: Search confirmed all tachikoma skill references point to `../_shared/agent-cli.md`; state-machine schema contains `Parent Nodes` and `State DAG`; skill metadata count remains balanced.
Object Drift: none.
Status: verified.

## T002 - Add Tachikoma Agent CLI Logging Protocol

Before State: Tachikoma CLI skills commonly suppress stderr with `2>/dev/null`, default several coding agents to read-only modes, and do not require durable full-run and summary artifacts.
Action: Add a shared agent CLI execution protocol and update each tachikoma CLI skill to use it.
After State: Tachikoma CLI skills share a durable logging protocol and no longer recommend suppressing stderr by default.
Implicit Claim: Tachikoma skills will preserve stdout/stderr provenance and require a compressed summary artifact while keeping external coding-agent CLIs read-only in the main tree.
Authority: User instruction in current conversation.
Representation / Proxy: Shared Markdown protocol referenced by each tachikoma skill.
Lost Information: Exact CLI flags may change over time; each skill should use the CLI's `--help` output when precision matters.
Evidence IDs: E001, E002, E003.
Evidence Quality: mixed.
Failure Mode: One or more tachikoma skills may retain old `2>/dev/null` patterns or fail to include summary instructions in the prompt.
Verification: Searched all tachikoma skill files for stale stderr suppression and shared protocol references.
Object Drift: none.
Status: verified.

## T005 - Require Worktree Isolation For Tachikoma CLI Writes

Before State: Shared Tachikoma protocol allowed write-capable CLI modes but the isolation requirement was not strong enough for multi-agent coding fixes.
Action: Update the shared agent CLI protocol and all Tachikoma CLI skill examples so write-capable flags are valid only after creating a fresh git worktree with `superpowers:using-git-worktrees`.
After State: External CLI agents default to read-only/planning modes in the main tree; write-capable modes are scoped to fresh worktrees.
Implicit Claim: Tachikoma now treats the git worktree as the safety boundary for external CLI agent writes.
Authority: E006.
Representation / Proxy: Markdown policy in `plugins/tachikoma/skills/_shared/agent-cli.md` and per-skill quick references.
Lost Information: Exact CLI permission flags may change; skills still require checking CLI help when precision matters.
Evidence IDs: E006, E007.
Evidence Quality: mixed.
Failure Mode: Future skills may add write-capable examples without the fresh-worktree qualifier.
Verification: Search write-capable flags and examples for fresh worktree qualifiers.
Object Drift: none.
Status: verified.

## T006 - Make Collab Fix Launch-All-Then-Wait-All

Before State: `collab-fix.md` mentioned parallel/background execution but did not make the worktree boundary and phase-level asynchronous ordering fully explicit.
Action: Require `collab-fix.md` to create a collaboration worktree first, run all external CLI agents from it, launch all CLI commands in a phase before waiting, and then wait for every CLI run and subagent.
After State: Multi-agent CLI collaboration has an explicit isolated working directory and asynchronous launch discipline.
Implicit Claim: `collab-fix.md` now prevents serialized agent execution and main-tree write grants for external CLI agents.
Authority: E006.
Representation / Proxy: Markdown workflow and constraints in `plugins/tachikoma/commands/collab-fix.md`.
Lost Information: Host-specific background process mechanics remain abstract because Claude Code-style and Codex-style hosts differ.
Evidence IDs: E006, E007.
Evidence Quality: mixed.
Failure Mode: A host may lack true background shell support; then it must use the host-equivalent yielded session rather than silently serialize.
Verification: Read `collab-fix.md`; search for async/worktree/no-stderr-discard requirements.
Object Drift: none.
Status: verified.

## T007 - Align TDD Debug With Tachikoma CLI Protocol

Before State: `TDD-debug.md` retained old command examples with `2>/dev/null`, Claude Code-specific `TaskOutput` wording, and no explicit worktree boundary for code/test writes.
Action: Rewrite `TDD-debug.md` to use the shared Tachikoma agent CLI protocol, debugging worktree isolation, read-only CLI analysis/review, launch-all-then-wait-all phases, and explicit pre-fix-fail/post-fix-pass gates.
After State: TDD debug uses the same durable logging, worktree isolation, and asynchronous multi-agent discipline as `collab-fix.md`.
Implicit Claim: `TDD-debug.md` no longer teaches stderr suppression or main-tree write grants for external CLI agents.
Authority: E008.
Representation / Proxy: Markdown workflow in `plugins/tachikoma/commands/TDD-debug.md`.
Lost Information: Actual project-specific test command remains runtime-specific.
Evidence IDs: E007, E008.
Evidence Quality: mixed.
Failure Mode: Future command files may drift from the shared protocol unless checked.
Verification: Search `plugins/tachikoma/commands/TDD-debug.md` for stale `2>/dev/null`, worktree isolation, and asynchronous launch wording.
Object Drift: none.
Status: verified.

## T008 - Add Durable Local Script Experience Rule

Before State: `using-ansatz-brain` recorded Python environment selection but did not forbid heredoc or long inline script execution that leaves no durable script artifact.
Action: Add a durable local script rule to the experience block requiring non-trivial scripts and complex shell operations to be written under `./.scripts/` with timestamped names, retained after execution, and recorded in state-machine with script responsibility, inputs, outputs, boundary, owner role, and verification.
After State: `using-ansatz-brain` treats durable scripts as part of the evidence chain and downgrades non-durable script output to exploratory.
Implicit Claim: Future agents have an always-visible operational rule preventing hidden heredoc script execution from supporting verified claims.
Authority: E009.
Representation / Proxy: Markdown guidance in `plugins/brain/skills/using-ansatz-brain/SKILL.md`.
Lost Information: Existing past heredoc executions remain only partially reconstructable from transcripts.
Evidence IDs: E009.
Evidence Quality: human.
Failure Mode: Agents may still use short inline one-liners for trivial inspection; the rule must be applied by state risk, not command length alone.
Verification: Search `using-ansatz-brain` for `.scripts`, timestamped script naming, and state-machine script responsibility fields.
Object Drift: none.
Status: verified.

## T009 - Audit Plugin System Coherence

Before State: Plugin-system coherence had been checked by ad hoc shell searches and JSON validation, but no durable audit script tied the checks together.
Action: Create and run `.scripts/20260511-140614-plugin-coherence-audit.py`.
After State: The repository has a reusable local audit artifact that validates plugin JSON, marketplace/plugin version alignment, active Claude/Codex marketplace set alignment, skill/OpenAI metadata coverage, Tachikoma shared-protocol references, no stale stderr-discard command patterns, command worktree/asynchronous/logging constraints, and Brain always-on/state evidence rules.
Implicit Claim: The active plugin system is internally coherent for the checked surfaces.
Authority: E002, E010.
Representation / Proxy: Scripted checks over repository files.
Lost Information: The audit does not execute real plugin installation in Claude Code or Codex; it checks repository-level install metadata and skill/command text.
Evidence IDs: E010.
Evidence Quality: direct.
Script Path: `.scripts/20260511-140614-plugin-coherence-audit.py`
Script Responsibility: Validate plugin-system metadata, skill coverage, shared protocol references, permission/logging rules, and Brain state foundations.
Inputs / Authority: Repository files under `.claude-plugin/`, `.agents/plugins/`, `plugins/`, `README.md`, and `.state-machine/`.
Outputs / Derived State: Terminal audit output ending with `SUMMARY: checks=130 failures=0`.
Boundary: Supports repository-level coherence claims only; does not prove runtime behavior of external CLIs or installed marketplace clients.
Owner Role: actor/verifier
Verification: Ran `UV_CACHE_DIR=./.cache/uv uv run python .scripts/20260511-140614-plugin-coherence-audit.py`; exit code 0.
Object Drift: none.
Status: verified.

## T010 - Write Agentic Search Skill Design Spec

Before State: CyberBrain had Brain skills for whole-object responsibility, state-machine, calculation boundaries, epistemic audits, and Codex platform mechanics, but no dedicated skill spec for agent web-search judgment or entity disambiguation.
Action: Add `docs/superpowers/specs/2026-06-01-agentic-search-skill-design.md`.
After State: Repository contains a draft design for a new `brain:agentic-search` skill covering general search discipline and entity/person/paper/project mismatch handling.
Implicit Claim: The design keeps search strategy in the agent skill layer and preserves `llm_router` as a protocol bridge rather than a search-policy system.
Authority: User instruction in current conversation approving A+B scope and requesting a spec.
Representation / Proxy: Markdown design document under `docs/superpowers/specs/`.
Lost Information: The skill itself is not implemented yet, and no plugin coherence audit has been rerun for the future implementation.
Evidence IDs: E002.
Evidence Quality: mixed.
Failure Mode: Future implementation could accidentally place policy in `codex-compatible` or drift into backend orchestration despite the spec boundary.
Verification: Created the spec file and included a self-review section checking placeholders, internal consistency, scope, and ambiguity.
Object Drift: none.
Status: verified.

## T011 - Write Agentic Search Skill Implementation Plan

Before State: CyberBrain had a draft design spec for `brain:agentic-search`, but no implementation plan describing exact files, steps, validation, or task boundaries.
Action: Add `docs/superpowers/plans/2026-06-01-agentic-search-skill.md`.
After State: Repository contains a concrete implementation plan for creating `brain:agentic-search`, routing it from `using-ansatz-brain`, clarifying neighboring skill boundaries, updating README, and validating plugin coherence.
Implicit Claim: The plan is executable task-by-task and keeps search judgment in the Brain skill layer.
Authority: User instruction in current conversation requesting the plan and `docs/superpowers/specs/2026-06-01-agentic-search-skill-design.md`.
Representation / Proxy: Markdown implementation plan under `docs/superpowers/plans/`.
Lost Information: The plan itself is not implementation; runtime behavior remains unchanged until tasks are executed.
Evidence IDs: E002.
Evidence Quality: mixed.
Failure Mode: An implementer may skip the validation task or make unrelated changes outside the planned files.
Verification: Plan includes concrete file mapping, task steps, exact markdown content for new skill, verification commands, and a self-review section.
Object Drift: none.
Status: verified.
