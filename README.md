# CyberBrain

<div align="center">
  <img src="assset/GIS.jpg" alt="Ghost in the Shell" width="400"/>
  <br/>
  <img src="assset/CyberBrain.png" alt="CyberBrain" width="400"/>
</div>

CyberBrain is a local plugin marketplace for Claude Code and Codex. It packages shared skills, commands, and agent definitions used across development workflows.

## Active Plugins

| Plugin | Contents | Status |
|--------|----------|--------|
| `awesome-agent-select` | Prompted subagents for review, QA, API docs, performance, tooling, and TypeScript work | Published |
| `tachikoma` | Skills and commands for coordinating AI CLI tools such as Codex, Gemini CLI, OpenCode, Qwen, Cline, Aider, GitHub Copilot CLI, Kiro CLI, and Kimi CLI | Published |
| `brain` | Skills for epistemic audits, calculation boundaries, scientific-claim review, and whole-object responsibility | Published |

## Disabled Plugins

These plugins are under refactoring and are not published in the Claude Code or Codex marketplaces:

- `mac-eco`
- `notifications`

## Requirements

- Claude Code, for `.claude-plugin` marketplace use
- Codex CLI 0.79.0 or newer, for `.codex-plugin` marketplace use
- `jq` 1.8.1 or newer for local validation
- Optional CLI tools used by `tachikoma`: Gemini CLI, OpenCode, Qwen, Cline, Aider, GitHub Copilot CLI, Kiro CLI, Kimi CLI
- Keep all CLI tools used by `tachikoma` updated to their latest available release before relying on the corresponding skill.

## Claude Code Installation

Clone the repository and add it as a Claude Code marketplace:

```bash
mkdir -p ~/soft
git clone https://github.com/ansatzX/CyberBrain.git ~/soft/CyberBrain
claude plugin marketplace add ~/soft/CyberBrain
```

Install the active plugins:

```bash
claude plugin install awesome-agent-select@CyberBrain
claude plugin install tachikoma@CyberBrain
claude plugin install brain@CyberBrain
```

Uninstall:

```bash
claude plugin uninstall awesome-agent-select@CyberBrain
claude plugin uninstall tachikoma@CyberBrain
claude plugin uninstall brain@CyberBrain
```

## Codex Installation

Clone the repository, then expose its Codex marketplace at the user-level Codex plugin root:

```bash
mkdir -p ~/soft ~/.agents/plugins/plugins
git clone https://github.com/ansatzX/CyberBrain.git ~/soft/CyberBrain

ln -sfn ~/soft/CyberBrain/.agents/plugins/marketplace.json ~/.agents/plugins/marketplace.json
ln -sfn ~/soft/CyberBrain/plugins/awesome-agent-select ~/.agents/plugins/plugins/awesome-agent-select
ln -sfn ~/soft/CyberBrain/plugins/tachikoma ~/.agents/plugins/plugins/tachikoma
ln -sfn ~/soft/CyberBrain/plugins/brain ~/.agents/plugins/plugins/brain
```

Codex reads the marketplace from:

```text
~/.agents/plugins/marketplace.json
```

Codex plugin manifests:

```text
~/.agents/plugins/plugins/awesome-agent-select/.codex-plugin/plugin.json
~/.agents/plugins/plugins/tachikoma/.codex-plugin/plugin.json
~/.agents/plugins/plugins/brain/.codex-plugin/plugin.json
```

Every skill includes Codex UI metadata at:

```text
plugins/<plugin>/skills/<skill>/agents/openai.yaml
```

## Plugin Layout

```text
.claude-plugin/marketplace.json        # Claude Code marketplace
.agents/plugins/marketplace.json       # Codex marketplace
plugins/
  awesome-agent-select/
    .claude-plugin/plugin.json
    .codex-plugin/plugin.json
    agents/
    skills/
  tachikoma/
    .claude-plugin/plugin.json
    .codex-plugin/plugin.json
    commands/
    skills/
  brain/
    .claude-plugin/plugin.json
    .codex-plugin/plugin.json
    skills/
  mac-eco/                              # disabled, under refactoring
  notifications/                        # disabled, under refactoring
```

## Plugin Details

### `tachikoma`

<div align="center">
  <img src="assset/Tachikoma.png" alt="tachikoma" width="300"/>
</div>

`tachikoma` provides skills for running and coordinating external AI CLI tools.

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

Included commands:

- `collab-fix`
- `TDD-debug`

#### `tachikoma::codex` and `llm_router`

The `codex` skill supports the Codex profile `llm_router` for routing Codex traffic through [ansatzX/llm_router](https://github.com/ansatzX/llm_router). `llm-router` adapts Codex requests and responses for non-OpenAI providers while Codex continues to execute local tools.

Supported `tachikoma::codex` profile policy:

| Profile | Model policy |
|---------|--------------|
| default profile | `gpt-5.4 high` or `gpt-5.5 high`; fallback to `gpt-5.3-codex` when no model preference is given |
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
uv run llm-router serve
```

Use it through Codex or through `tachikoma::codex`:

```bash
codex -p llm_router
codex exec -p llm_router -m deepseek-v4-pro --config model_reasoning_effort="xhigh" --skip-git-repo-check -
```

### `brain`

`brain` provides audit-oriented skills for scientific, technical, and workflow reasoning.

Included skills:

- `using-ansatz-brain`
- `think-before-you-calculate`
- `epistemic-systems-audit`
- `whole-object-responsibility`

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

## Validation

Validate marketplace and plugin JSON:

```bash
jq -e . .claude-plugin/marketplace.json .agents/plugins/marketplace.json plugins/*/.claude-plugin/plugin.json plugins/*/.codex-plugin/plugin.json
```

Check skill metadata coverage:

```bash
find plugins -path '*/skills/*/SKILL.md' -type f | wc -l
find plugins -path '*/skills/*/agents/openai.yaml' -type f | wc -l
```
