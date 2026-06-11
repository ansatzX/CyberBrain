---
name: tame-dev-workflows
description: "Use when installing, reinstalling, auditing, or preparing Brain-managed Superpowers, Spec Kit, and OpenSpec workflow arsenals under a project-local `.brain/vendor` directory so Brain can inspect and route them without exposing their raw Codex skills/prompts at the project root."
---

# Tame Dev Workflows

Install Brain-managed copies of Superpowers, Spec Kit, and OpenSpec under `.brain/vendor`.

Resolve `<skill-dir>` to this skill folder. Scripts accept an optional project root as their first argument.

## Run

Run the bundled installer from the target project:

```sh
<skill-dir>/scripts/install-vendor.sh
```

Spec Kit deliberately uses Codex integration here because this skill vendors raw upstream surfaces for later Brain taming.
Dependency installers use their default locations; only uv's cache is pinned to project-local `.cache/uv`.

## Tame

Expose only Brain-approved project surfaces:

```sh
<skill-dir>/scripts/tame-project.sh
```

Use project-scoped Codex custom agents at `.codex/agents/*.toml`; do not write these to `~/.codex/agents`.

## Inspect

After running, inspect raw consumable surfaces:

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

Report generated Spec Kit skills, generated OpenSpec skills/prompts, generated Codex agents, Superpowers ref, and whether root `.agents/skills` or `.codex/skills` exists.
