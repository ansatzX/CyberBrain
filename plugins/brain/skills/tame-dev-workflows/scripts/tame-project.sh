#!/usr/bin/env bash
set -euo pipefail

project_root="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
vendor_root="$project_root/.brain/vendor"

mkdir -p "$project_root/.codex/agents" "$project_root/.specify"
cp -a "$vendor_root/spec-kit/.specify/." "$project_root/.specify/"

python3 - "$vendor_root/superpowers" "$vendor_root/superpowers/.brain-agents" <<'PY'
from pathlib import Path
import json
import sys

superpowers_root = Path(sys.argv[1])
generated_agents = Path(sys.argv[2])
generated_agents.mkdir(parents=True, exist_ok=True)

agents = [
    ("superpowers-implementer", "Implement one isolated plan task using Superpowers subagent-driven development.", "skills/subagent-driven-development/implementer-prompt.md"),
    ("superpowers-spec-reviewer", "Review whether an implementation matches the requested plan or specification.", "skills/subagent-driven-development/spec-reviewer-prompt.md"),
    ("superpowers-code-quality-reviewer", "Review implementation quality, maintainability, tests, and integration risk.", "skills/subagent-driven-development/code-quality-reviewer-prompt.md"),
    ("superpowers-code-reviewer", "Review completed code changes before continuing or merging.", "skills/requesting-code-review/code-reviewer.md"),
    ("superpowers-plan-reviewer", "Review an implementation plan for completeness before execution.", "skills/writing-plans/plan-document-reviewer-prompt.md"),
    ("superpowers-spec-document-reviewer", "Review a brainstorming or spec document before planning.", "skills/brainstorming/spec-document-reviewer-prompt.md"),
]

def toml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)

for name, description, relative_path in agents:
    source = superpowers_root / relative_path
    if not source.is_file():
        raise FileNotFoundError(source)
    instructions = f"Generated from Superpowers {relative_path}.\\n\\n" + source.read_text(encoding="utf-8")
    target = generated_agents / f"{name}.toml"
    target.write_text(
        "\n".join([
            f"name = {toml_string(name)}",
            f"description = {toml_string(description)}",
            f"developer_instructions = {toml_string(instructions)}",
            "",
        ]),
        encoding="utf-8",
    )
PY

cp -a "$vendor_root/superpowers/.brain-agents/." "$project_root/.codex/agents/"
