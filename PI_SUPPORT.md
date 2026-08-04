# Cyberbrain Pi Support

## Architecture

Cyberbrain exposes a local Pi package named `cyberbrain-pi` from `pi/`.

- `pi/extensions/`: goal, slash modes, utility commands, and third-party providers.
- `pi/lib/`: pure logic shared by extensions and tests.
- `pi/slashes/`: package-default slash modes.
- `pi/skills/pi-extension-dev/`: Pi extension development guidance.
- `plugins/*/skills/`: shared Cyberbrain skills used by both Codex and Pi.

Cyberbrain does not manage Pi credentials, sessions, goals, cache, theme, thinking level, default model/provider, or enabled-model preferences.

## Requirements

- Pi coding agent with local package support.
- Python 3 for the managed installer.
- macOS or Linux for automatic migration via `tools/manage-pi.sh`.
- Windows users can run `pi install <clone>/pi`; automatic legacy migration is not currently provided.

## Install

```bash
git clone https://github.com/ansatzX/CyberBrain.git ~/soft/CyberBrain
cd ~/soft/CyberBrain
bash tools/manage-pi.sh install
bash tools/manage-pi.sh doctor
```

The installer backs up and removes recognized legacy Cyberbrain Pi files before registering the local package. It stops on unknown conflicts.

Preview without changing files:

```bash
bash tools/manage-pi.sh install --dry-run
```

## Update

Update the clone yourself, then reconcile Pi:

```bash
cd ~/soft/CyberBrain
git pull
bash tools/manage-pi.sh update
bash tools/manage-pi.sh doctor
```

The installer never runs `git pull`.

## Doctor

```bash
bash tools/manage-pi.sh doctor
```

Doctor checks package registration, legacy duplicates, required provider environment variables, package tests, and extension syntax. It reports home slash overrides without removing them.

## Uninstall

```bash
bash tools/manage-pi.sh uninstall
```

This removes the local package registration and installer manifest. It does not remove runtime goals, sessions, cache, or credentials.

Restore the backed-up pre-package files only when explicitly needed:

```bash
bash tools/manage-pi.sh uninstall --restore-legacy
```

## Providers and environment variables

`third-party-all-in-one` registers two independent provider IDs:

```text
aihubmix/...
deepseek-responses/deepseek-v4-flash
```

Required environment variables:

```text
AIHUBMIX_API_KEY
DEEPSEEK_API_KEY
```

Optional variables:

```text
AIHUBMIX_ORIGIN
AIHUBMIX_DISCOVERY_TIMEOUT_MS
AIHUBMIX_CACHE_MAX_AGE_MS
AIHUBMIX_PRICE_MULTIPLIER
AIHUBMIX_RESERVE_OUTPUT
AIHUBMIX_CACHE_PATH
CYBERBRAIN_DEEPSEEK_WEB_SEARCH=0
```

DeepSeek Responses hosted web search is enabled by default and can be disabled with `CYBERBRAIN_DEEPSEEK_WEB_SEARCH=0`.

## Slash defaults and home overrides

Package defaults live in `pi/slashes/`. Machine-local overrides live in:

```text
~/.pi/agent/slashes/*.md
```

The same `namespace:name` in home replaces the package default and emits one warning. `scope: once` clears after one agent run; `scope: session` remains active until turned off.

## Shared skills

Pi loads the existing Brain, Tachikoma, and Awesome Agent Select skills directly from `plugins/*/skills`. The files are not copied or generated. Some skills are Codex- or MAS-oriented; when Pi lacks the requested host capability, the skill must report the boundary rather than fabricate tools.

## Development and tests

```bash
node --test pi/test/*.test.ts
bash pi/test/manage-pi.test.sh
for file in pi/extensions/*.ts pi/lib/*.ts pi/lib/third-party/*.ts; do node --check "$file"; done
python3 -m py_compile tools/manage-pi.py
bash -n tools/manage-pi.sh pi/test/manage-pi.test.sh
```

## Windows limitation

The Pi package itself is cross-platform. The POSIX installer and automatic legacy migration currently support macOS and Linux only. Windows users should install the local package directly and remove legacy Cyberbrain files manually after review.
