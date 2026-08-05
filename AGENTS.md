# Repository Guidelines

## Repository Role

`CyberBrain` is a personal multi-host agent configuration repository. Codex and Pi are independent host adapters. Shared skills live under `plugins/*/skills`; host-specific packaging and runtime code must remain inside its adapter boundary.

This repository is not a generic prompt dump or a Claude Code compatibility layer. Do not reintroduce Claude-specific packaging, agent formats, host-tool naming, or `~/.claude` runtime assumptions unless the maintainer explicitly asks for that reversal.

## Host Boundaries

- **Codex adapter**: `.agents/plugins`, `plugins/*/.codex-plugin`, Codex agent TOMLs/installers, and `~/.codex` examples.
- **Pi adapter**: `pi/package.json`, `pi/extensions`, `pi/lib`, `pi/slashes`, `pi/skills`, `pi/subagents`, `tools/manage-pi.sh`, and `~/.pi/agent` runtime examples.
- Shared skills remain single-source under `plugins/*/skills` and may be loaded by both hosts.
- Do not make one host adapter emulate the other host's runtime APIs.

## Hard Gate Before Editing

Do not modify files in this repository until the relevant runtime boundary has
been checked.

1. If the change depends on Codex plugin, hook, skill, subagent, or profile
   behavior, verify that behavior against current Codex docs or local Codex
   source before editing.
2. If the change touches plugin packaging or agent installation, inspect the
   current repository files that own the behavior, not just README prose.
3. If the change would broaden scope across disabled plugins, published
   plugins, and repo-root docs at once, stop and split the work unless the user
   explicitly asked for the larger sweep.

When behavior claims depend on Codex internals, prefer evidence from:

- local Codex source when available
- current official Codex docs
- the repository's own executable assets such as installer scripts and plugin
  manifests

If those disagree, do not guess. Reproduce the current repository behavior
first, then edit.

## Codex Adapter Rules

Keep these boundaries intact:

- publish Codex plugins only through `.agents/plugins/marketplace.json` and
  `plugins/*/.codex-plugin/plugin.json`
- keep generated Codex role definitions in `plugins/awesome-agent-select/agents/*.toml`
- use Codex-native tool names and workflows in Codex skills and docs
- use `~/.codex/...` paths for Codex user-facing runtime/config examples

Do not add back:

- `.claude-plugin/` manifests
- Claude frontmatter agent files under `agents/*.md`
- Claude-specific slash-command content
- host-translation tables such as `AskUserQuestion -> request_user_input`
- `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, or `~/.claude/...`

## Agent Packaging Rules

`awesome-agent-select` is the only published plugin here that exposes Codex
agent roles and packaged Pi subagents.

Its contract is:

- `plugins/awesome-agent-select/agent-profiles/*.md` is the canonical,
  host-neutral role text; filename supplies the role name, its first paragraph
  supplies the description, and the remaining text supplies instructions
- `node tools/generate-agent-adapters.mjs` deterministically renders the
  canonical profiles into Codex TOMLs and Pi Markdown adapters
- generated Codex TOMLs remain at `plugins/awesome-agent-select/agents/*.toml`;
  the explicit installer registers them in `~/.codex/agents` and tracks ownership
  with a local manifest
- generated Pi adapters remain at `pi/subagents/awesome-agent-select/*.md` and
  are exposed by `pi/package.json` through `pi.subagents.agents`
- plugin installation alone does not make Codex agent roles visible to Codex;
  the explicit installer remains required

Canonical packaging files:

- `plugins/awesome-agent-select/agent-profiles/*.md`
- `tools/generate-agent-adapters.mjs`
- `plugins/awesome-agent-select/tools/manage-codex-agents.sh`
- `tools/awesome-agent-select-codex-agents.sh`
- `pi/package.json`
- `README.md`

When changing a role, edit its canonical text and regenerate; never hand-edit a
rendered TOML or Pi adapter. Keep these files synchronized.

Do not add `model` or `model_reasoning_effort` to generated agent definitions
unless the maintainer explicitly wants pinned models. Default behavior should
inherit the current Codex or Pi session's model, profile, and reasoning settings.

Do not reintroduce plugin hooks for agent installation unless the maintainer
explicitly asks for them. The supported path is the explicit installer.

## Plugin Layout Rules

Published plugins should remain narrowly scoped:

- `awesome-agent-select`: host-neutral prompted-role source plus generated
  Codex roles, packaged Pi subagents, and explicit Codex agent-role installer
- `tachikoma`: Codex-hosted skills for coordinating external AI CLIs
- `brain`: Codex-hosted audit and reasoning skills

Keep repo-root marketplace metadata aligned with plugin manifests:

- `.agents/plugins/marketplace.json`
- `plugins/*/.codex-plugin/plugin.json`

## Documentation Rules

Repository docs should describe the real host-native workflow, not historical
or adjacent host behavior.

When updating docs:

- keep Codex and Pi installation paths distinct
- keep plugin layout examples aligned with files that actually exist
- describe the explicit Codex installer and Pi package discovery flow for
  `awesome-agent-select`
- avoid documenting unsupported automation paths as if they are first-class

If you remove a runtime path or packaging mechanism, remove its README and
design-doc references in the same change.

## Code Map

- `README.md`: user-facing marketplace, installation, and validation guide
- `AGENTS.md`: repository work discipline for Codex contributors
  constraints
- `.agents/plugins/marketplace.json`: Codex marketplace registry
- `plugins/awesome-agent-select/`: canonical role text, generated Codex roles,
  shared skills, and Codex installer
- `plugins/tachikoma/skills/`: Codex skills for external AI CLIs
- `plugins/brain/skills/`: Codex reasoning/audit skills
- `tools/awesome-agent-select-codex-agents.sh`: repo-root installer wrapper
- `tools/cleanup-agent-symlinks.sh`: legacy symlink cleanup utility

## Pi Adapter Rules

- `pi/` is a local Pi package named `cyberbrain-pi`.
- Pi extensions must use package-relative imports and keep pure helpers/tests outside `pi/extensions/`.
- `tools/manage-pi.sh` owns migration of legacy Cyberbrain Pi files and must never manage `auth.json`, API keys, user model preferences, sessions, cache, or goals.
- Existing shared skills are referenced from `pi/package.json`; do not copy them into generated mirrors.
- Home slash definitions may override package defaults; installer migration removes only the known legacy Cyberbrain defaults.

## Validation

Use focused validation that matches the change.

For packaging and manifest edits:

```bash
jq -e . .agents/plugins/marketplace.json plugins/*/.codex-plugin/plugin.json
```

For `awesome-agent-select` installer changes:

```bash
bash -n plugins/awesome-agent-select/tools/manage-codex-agents.sh
```

For Codex-only boundary checks:

```bash
rg -n "\.claude-plugin|CLAUDE_PLUGIN_ROOT|CLAUDE_PLUGIN_DATA|AskUserQuestion|~/.claude" README.md AGENTS.md plugins .agents -S
```

For agent-definition changes:

- run `node tools/generate-agent-adapters.mjs --check`
- verify generated `agents/*.toml` still contain `name`, `description`, and
  `developer_instructions`
- verify the generated Pi adapters have `name`, `description`, and
  `systemPromptMode: replace`
- verify no generated definition pins a model unless explicitly intended

If you changed the explicit installer or agent discovery flow, run an install
or doctor check against a temporary `CODEX_HOME` and verify Pi agent discovery
before claiming success.

## Change Discipline

Prefer small, contract-preserving edits.

Good changes:

- remove stale host-specific packaging
- align docs with actual plugin behavior
- tighten installer ownership and validation
- update plugin versions when manifest changes require marketplace refresh

Bad changes:

- reintroducing dual-host abstractions without a concrete requirement
- documenting a path that the repository no longer ships
- changing published plugin scope while leaving marketplace/docs out of sync
- hardcoding model choices into agent TOMLs for convenience
