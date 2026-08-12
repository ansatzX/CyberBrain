# CyberBrain

<div align="center">
  <img src="assets/GIS.jpg" alt="Ghost in the Shell" width="400"/>
  <br/>
  <img src="assets/CyberBrain.png" alt="CyberBrain" width="400"/>
</div>

CyberBrain is a personal agent configuration repository with first-class host adapters for OpenAI Codex and Pi. Shared skills remain single-source; each host keeps its native package, extension, and installer mechanisms.

## Host Adapters

- **Codex**: local marketplace plugins plus explicit agent-role installation.
- **Pi**: local `cyberbrain-pi` package with extensions, providers, slash modes, subagents, and shared skills.

## Active Plugins

| Plugin | Contents | Status |
|--------|----------|--------|
| `awesome-agent-select` | Host-neutral prompted roles rendered for Codex and Pi: review, QA, API docs, performance, tooling, and TypeScript work | Published |
| `tachikoma` | Skills and commands for coordinating Codex, Gemini CLI, OpenCode, Qwen, GitHub Copilot CLI, Kimi Code, and Pi | Published |
| `brain` | Skills for epistemic audits, calculation boundaries, scientific-claim review, and whole-object responsibility | Published |

## Requirements

- Optional CLI tools used by `tachikoma`: Gemini CLI, OpenCode, Qwen, GitHub Copilot CLI, Kimi Code, Pi
- Keep all CLI tools used by `tachikoma` updated to their latest available release before relying on the corresponding skill.

## Codex Installation

Clone and register the marketplace:

```bash
mkdir -p ~/soft
git clone https://github.com/ansatzX/CyberBrain.git ~/soft/CyberBrain
codex plugin marketplace add ~/soft/CyberBrain
```

Install plugins through the interactive plugin browser:

```bash
codex
/plugins
```

In the plugin browser, switch to the **CyberBrain** marketplace tab and install each plugin.
Press <kbd>Space</kbd> on an installed plugin to toggle its enabled state.
To remove the marketplace: `codex plugin marketplace remove CyberBrain`.

### Agent Roles (awesome-agent-select)

Install `awesome-agent-select` from `/plugins`, then explicitly install its Codex agent roles:

```bash
bash tools/awesome-agent-select-codex-agents.sh install
```

This copies the generated `agents/*.toml` files into `~/.codex/agents/` and writes a manifest so later `doctor` and `uninstall` operations touch only files owned by `awesome-agent-select`.

Check status:

```bash
bash tools/awesome-agent-select-codex-agents.sh doctor
```

Remove only managed agent files:

```bash
bash tools/awesome-agent-select-codex-agents.sh uninstall
```

This explicit installer is the only supported installation path for Codex agent roles in `awesome-agent-select`.

To clean up agent symlinks from all plugins:

```bash
bash tools/cleanup-agent-symlinks.sh
```

## Pi Installation

Clone the repository, install the `pi-subagents` Pi package, then run the managed installer:

```bash
mkdir -p ~/soft
git clone https://github.com/ansatzX/CyberBrain.git ~/soft/CyberBrain
cd ~/soft/CyberBrain
pi install npm:pi-subagents@0.40.0
bash tools/manage-pi.sh install
bash tools/manage-pi.sh doctor
```

The Pi adapter does not manage credentials, sessions, goals, model preferences, themes, or thinking settings. Its `pick-model` skill picks model and thinking level per delegated launch (parent-model inheritance unless an approved model policy exists), and `agent-cluster` drives multi-agent launch, supervision, and fan-in; neither persists model choices on its own. See [INSTALL.md](INSTALL.md) for the full install, update, and uninstall guide.

### Pi Package Contents

| Resource | Source | What you get |
|----------|--------|--------------|
| Extensions | `pi/extensions/` | `/ansatz:goal` long-task goals, `/ansatz:diff`, `/ansatz:status`, slash-mode framework (`/ansatz:review`, `/ansatz:python`) |
| Providers | `pi/lib/third-party/` | `aihubmix/*` (live model discovery) and `deepseek-responses/deepseek-v4-flash` / `deepseek-v4-pro` (1M context; flash exposes low/high/max, pro exposes high/max) |
| Skills | `pi/skills/` | `pick-model` (per-launch model/thinking routing), `agent-cluster` (multi-agent lifecycle), `pi-extension-dev` |
| Shared skills | `plugins/*/skills/` | brain, tachikoma, and awesome-agent-select skills, loaded single-source |
| Subagents | `pi/subagents/` | generated `cyberbrain.<role>` agents from `awesome-agent-select` profiles, e.g. `/run cyberbrain.code-reviewer` |
| Dependency | npm `pi-subagents` | subagent delegation engine (chains, parallel fanout, async supervision), installed separately as a Pi package (`pi install npm:pi-subagents@0.40.0`) |

## Plugin Layout

```text
.agents/plugins/marketplace.json       # Codex marketplace
tools/
  awesome-agent-select-codex-agents.sh  # explicit install / doctor / uninstall wrapper
  cleanup-agent-symlinks.sh            # batch cleanup of agent role symlinks
plugins/
  awesome-agent-select/
    .codex-plugin/plugin.json
    agent-profiles/                    # canonical host-neutral role text
    agents/                            # generated Codex agent TOMLs
    skills/
    tools/
      manage-codex-agents.sh           # canonical installer used by explicit wrapper
  tachikoma/
    .codex-plugin/plugin.json
    skills/
  brain/
    .codex-plugin/plugin.json
    skills/
pi/
  subagents/awesome-agent-select/      # generated Pi subagent Markdown adapters
```

## Plugin Details

### `tachikoma`

<div align="center">
  <img src="assets/Tachikoma.png" alt="tachikoma" width="300"/>
</div>

`tachikoma` provides skills for running and coordinating external AI CLI tools from Codex.

Included skills:

- `codex`
- `gemini-cli`
- `opencode`
- `qwen`
- `github-copilot-cli`
- `kimi-code`
- `pi`

### `brain`

`brain` provides audit-oriented skills for scientific, technical, workflow, and search-evidence reasoning.

Included skills:

- `using-ansatz-brain`
- `state-machine`
- `agentic-search`
- `codex-compatible`
- `think-before-you-calculate`
- `epistemic-systems-audit`
- `whole-object-responsibility`
- `tame-dev-workflows`

State-machine TODO:

- Add a validator that checks state nodes for completion without verification, proxy-only evidence marked verified, unresolved object drift, and open gaps before `CLAIM_READY`.
- Add a summarizer that rolls child agent state nodes up into a parent node without requiring concurrent writes to the same file.
- Add optional schema export for tools that want to read `.state-machine/*.md` as structured records.

### `awesome-agent-select`

`awesome-agent-select` provides prompted subagents.

Included agents:

- `api-documenter`
- `code-reviewer`
- `llm-architect`
- `mcp-developer`
- `performance-engineer`
- `qa-expert`
- `test-automator`
- `tooling-engineer`
- `typescript-pro`

In Codex, the supported installation path is an explicit installer that copies `agents/*.toml` into `~/.codex/agents/` and writes a local manifest.

| File | Format | Consumer |
|------|--------|----------|
| `agent-profiles/*.md` | description paragraph followed by role instructions; no frontmatter | Canonical source |
| `agents/*.toml` | `name` + `description` + `developer_instructions` | Codex (generated) |
| `pi/subagents/awesome-agent-select/*.md` | Pi subagent frontmatter plus role instructions | Pi (generated) |

Edit only `agent-profiles/*.md`: the filename is the role name, the first paragraph is its description, and the remaining text is its instructions. Regenerate both host adapters with:

```bash
node tools/generate-agent-adapters.mjs
node tools/generate-agent-adapters.mjs --check
```

Codex discovers agent roles from `~/.codex/agents/*.toml` during startup. `bash tools/awesome-agent-select-codex-agents.sh install` is the supported way to populate that directory. Pi discovers the packaged roles as `cyberbrain.<role-name>` after `/reload`; for example: `/run cyberbrain.code-reviewer "Review the current diff without edits"`.

**Install**: Use `/plugins` in the Codex interactive CLI to install from the CyberBrain marketplace, then run `bash tools/awesome-agent-select-codex-agents.sh install`. Start a new Codex session after the install so the newly copied agent roles are discovered.

**Verify**: Run `bash tools/awesome-agent-select-codex-agents.sh doctor`.

**Uninstall**: Run `bash tools/awesome-agent-select-codex-agents.sh uninstall` to remove only managed files. If you previously used the legacy symlink-based flow, `bash tools/cleanup-agent-symlinks.sh` removes leftover symlinks. Plugin uninstall through `/plugins` still does not have an uninstall hook in Codex itself.

## Validation

Validate marketplace and plugin JSON:

```bash
jq -e . .agents/plugins/marketplace.json plugins/*/.codex-plugin/plugin.json
```

Check skill metadata coverage and generated agent adapters:

```bash
find plugins -path '*/skills/*/SKILL.md' -type f | wc -l
find plugins -path '*/skills/*/agents/openai.yaml' -type f | wc -l
node tools/generate-agent-adapters.mjs --check
```
