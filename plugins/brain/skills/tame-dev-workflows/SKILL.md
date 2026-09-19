---
name: tame-dev-workflows
description: "Use when installing, reinstalling, auditing, or preparing Brain-managed Superpowers, Spec Kit, and OpenSpec workflow arsenals under a project-local `.brain/vendor` directory so Brain can inspect and route them without exposing their raw Codex skills/prompts at the project root."
---

# Tame Dev Workflows

Inspect or install Brain-managed copies of Superpowers, Spec Kit, and OpenSpec under `.brain/vendor`.

## Choose the authorized mode first

- **Audit / inspect / review:** read the existing paths under Inspect and the
  bundled scripts. Report missing files, versions, conflicts and proposed changes.
  Do not run either installer, initialize tools, refresh plugins, or create paths.
  Missing dependencies are findings, not permission to install them.
- **Install / reinstall / prepare:** confirm that the request authorizes writes
  and resolve the exact project root before using Run or Tame. Inspect existing
  destinations first. The current scripts overwrite files and delete selected
  directories; they have no ownership manifest, conflict handling, or rollback.
  Do not run them over existing assets until those exact replacements are
  authorized and recoverable backups are made. Reinstallation is not permission
  to discard user modifications. Prefer staging and a reviewed merge on an
  existing project; stop if file ownership is unclear.

Use the active host's installed documentation to check any generated Codex
agent discovery behavior before publishing project-scoped agents. On Pi, this
skill does not make those Codex agents into Pi subagents.

Superpowers is sourced from the exact installed official Codex marketplace plugin version, not from the older public GitHub release tag. In installation mode only, a missing or mismatched version may require a separately authorized marketplace install or refresh; auditing must report it without changing it.

Resolve `<skill-dir>` to this skill folder. Scripts accept an optional project root as their first argument.

## Run

In authorized installation mode, run the bundled installer with the resolved target project:

```sh
<skill-dir>/scripts/install-vendor.sh /absolute/target/project
```

Spec Kit deliberately uses Codex integration here because this skill vendors raw upstream surfaces for later Brain taming.
Dependency installers use their default locations; only uv's cache is pinned to project-local `.cache/uv`.

## Tame

In authorized installation mode, expose only Brain-approved project surfaces:

```sh
<skill-dir>/scripts/tame-project.sh /absolute/target/project
```

Use project-scoped Codex custom agents at `.codex/agents/*.toml`; do not write these to `~/.codex/agents`.

## Inspect

For a read-only audit, inspect these paths directly without running either script.
After an authorized installation, inspect the same paths to verify the result:

```text
.brain/vendor/superpowers/.codex-plugin/plugin.json
.brain/vendor/superpowers/skills/*/SKILL.md
.brain/vendor/spec-kit/.agents/skills/*/SKILL.md
.brain/vendor/spec-kit/.specify/
.brain/vendor/spec-kit/AGENTS.md
.brain/vendor/openspec/.*/skills/*/SKILL.md
.brain/vendor/openspec/.*/commands/
.brain/vendor/openspec/.*/prompts/
.brain/vendor/openspec/.*/workflows/
.brain/vendor/openspec/openspec/
.codex/agents/superpowers-*.toml
.specify/
```

OpenSpec creates `openspec/` under the init target. This skill targets `.brain/vendor/openspec`, so it creates `.brain/vendor/openspec/openspec/`, not project-root `openspec/`.

## Do Not

- Do not install these raw surfaces into root `.agents/skills`, root `.codex/skills`, real `$CODEX_HOME`, or `~/.codex`.
- Do not run `codex plugin install` for Superpowers from this skill.
- Do not symlink upstream skills into root-level Codex scan paths.
- Do not copy `.brain/vendor/openspec/openspec/` to project-root `openspec/` until Brain explicitly owns that state.

## Report

Report generated Spec Kit skills, generated OpenSpec skills/prompts, generated Codex agents, Superpowers Codex plugin version, and whether root `.agents/skills` or `.codex/skills` exists.
