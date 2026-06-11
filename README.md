# CyberBrain

<div align="center">
  <img src="assset/GIS.jpg" alt="Ghost in the Shell" width="400"/>
  <br/>
  <img src="assset/CyberBrain.png" alt="CyberBrain" width="400"/>
</div>

CyberBrain is a local plugin marketplace for Codex. It packages shared skills and agent definitions used across development workflows.

## Active Plugins

| Plugin | Contents | Status |
|--------|----------|--------|
| `awesome-agent-select` | Prompted subagents for review, QA, API docs, performance, tooling, and TypeScript work | Published |
| `tachikoma` | Skills and commands for coordinating AI CLI tools such as Codex, Gemini CLI, OpenCode, Qwen, Cline, Aider, GitHub Copilot CLI, Kiro CLI, and Kimi CLI | Published |
| `brain` | Skills for epistemic audits, calculation boundaries, scientific-claim review, and whole-object responsibility | Published |

## Disabled Plugins

These plugins are under refactoring and are not published in the Codex marketplace:

- `mac-eco`
- `notifications`

## Requirements

- Codex CLI 0.79.0 or newer, for `.codex-plugin` marketplace use
- `jq` 1.8.1 or newer for local validation
- Optional CLI tools used by `tachikoma`: Gemini CLI, OpenCode, Qwen, Cline, Aider, GitHub Copilot CLI, Kiro CLI, Kimi CLI
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

This copies `agents/*.toml` into `~/.codex/agents/` and writes a manifest so later `doctor` and `uninstall` operations touch only files owned by `awesome-agent-select`.

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

Still-enabled plugins will re-create their symlinks on the next session start.

## Plugin Layout

```text
.agents/plugins/marketplace.json       # Codex marketplace
tools/
  awesome-agent-select-codex-agents.sh  # explicit install / doctor / uninstall wrapper
  cleanup-agent-symlinks.sh            # batch cleanup of agent role symlinks
plugins/
  awesome-agent-select/
    .codex-plugin/plugin.json
    agents/                            # Codex agent TOML definitions
    skills/
    tools/
      manage-codex-agents.sh           # canonical installer used by explicit wrapper
  tachikoma/
    .codex-plugin/plugin.json
    skills/
    tools/
  brain/
    .codex-plugin/plugin.json
    skills/
  mac-eco/                             # disabled, under refactoring
  notifications/                       # disabled, under refactoring
```

## Plugin Details

### `tachikoma`

<div align="center">
  <img src="assset/Tachikoma.png" alt="tachikoma" width="300"/>
</div>

`tachikoma` provides skills for running and coordinating external AI CLI tools from Codex.

Included skills:

- `codex`
- `gemini-cli`
- `opencode`
- `qwen`
- `cline-cli`
- `aider`
- `github-copilot-cli`
- `kiro-cli`
- `kimi-cli`

#### `tachikoma::codex` and `llm_router`

The `codex` skill supports the `llm_router` profile for routing Codex traffic through [ansatzX/llm_router](https://github.com/ansatzX/llm_router).

Supported profile policy:

| Profile | Model policy |
|---------|--------------|
| default | `gpt-5.4 high` or `gpt-5.5 high`; fallback to `gpt-5.3-codex` |
| `llm_router` | `deepseek-v4-pro xhigh` only |
| `aihubmix` | `gpt-5.4 high` or `gpt-5.5 high` |

Configure `llm_router`:

```bash
git clone https://github.com/ansatzX/llm_router.git ~/soft/llm_router
cd ~/soft/llm_router
uv sync
export DEEPSEEK_API_KEY="sk-..."
mkdir -p ~/.codex
cp llm_router.json ~/.codex/llm_router.json
```

Merge the `llm_router` provider/profile settings from `codex.config.example.toml` into `~/.codex/config.toml`, then start the router:

```bash
uv run llm_router serve
```

Use it through Codex:

```bash
codex -p llm_router
codex exec -p llm_router -m deepseek-v4-pro --config model_reasoning_effort="xhigh" --skip-git-repo-check -
```

### `brain`

`brain` provides audit-oriented skills for scientific, technical, workflow, and search-evidence reasoning.

Included skills:

- `using-ansatz-brain`
- `state-machine`
- `agentic-search`
- `think-before-you-calculate`
- `epistemic-systems-audit`
- `whole-object-responsibility`

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
| `agents/*.toml` | `name` + `description` + `developer_instructions` | Codex |

Codex discovers agent roles from `~/.codex/agents/*.toml` during startup. `bash tools/awesome-agent-select-codex-agents.sh install` is the supported way to populate that directory.

**Install**: Use `/plugins` in the Codex interactive CLI to install from the CyberBrain marketplace, then run `bash tools/awesome-agent-select-codex-agents.sh install`. Start a new Codex session after the install so the newly copied agent roles are discovered.

**Verify**: Run `bash tools/awesome-agent-select-codex-agents.sh doctor`.

**Uninstall**: Run `bash tools/awesome-agent-select-codex-agents.sh uninstall` to remove only managed files. If you previously used the legacy symlink-based flow, `bash tools/cleanup-agent-symlinks.sh` removes leftover symlinks. Plugin uninstall through `/plugins` still does not have an uninstall hook in Codex itself.

For a detailed explanation of the Codex plugin system (install/uninstall flow, hook runtime, agent role discovery), see [CODEX_PLUGIN_SYSTEM.md](CODEX_PLUGIN_SYSTEM.md).

## Validation

Validate marketplace and plugin JSON:

```bash
jq -e . .agents/plugins/marketplace.json plugins/*/.codex-plugin/plugin.json
```

Check skill metadata coverage:

```bash
find plugins -path '*/skills/*/SKILL.md' -type f | wc -l
find plugins -path '*/skills/*/agents/openai.yaml' -type f | wc -l
```
