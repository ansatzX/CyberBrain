#!/usr/bin/env python3
"""Audit CyberBrain plugin-system coherence.

This script is intentionally kept as an artifact because its output supports
claims about plugin consistency.
"""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def check(condition: bool, ok: str, bad: str, findings: list[tuple[str, str]]) -> None:
    findings.append(("OK" if condition else "FAIL", ok if condition else bad))


def parse_frontmatter(path: Path) -> dict[str, str]:
    text = read(path)
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---\n", 4)
    if end == -1:
        return {}
    data: dict[str, str] = {}
    for line in text[4:end].splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        data[key.strip()] = value.strip().strip('"')
    return data


def main() -> int:
    findings: list[tuple[str, str]] = []

    json_paths = [
        ROOT / ".claude-plugin/marketplace.json",
        ROOT / ".agents/plugins/marketplace.json",
        *sorted(ROOT.glob("plugins/*/.claude-plugin/plugin.json")),
        *sorted(ROOT.glob("plugins/*/.codex-plugin/plugin.json")),
    ]
    for path in json_paths:
        try:
            json.loads(read(path))
            findings.append(("OK", f"valid json: {rel(path)}"))
        except Exception as exc:  # noqa: BLE001 - audit should report all parse failures.
            findings.append(("FAIL", f"invalid json: {rel(path)}: {exc}"))

    claude_marketplace = json.loads(read(ROOT / ".claude-plugin/marketplace.json"))
    active_claude = claude_marketplace.get("plugins", [])
    for item in active_claude:
        plugin_path = ROOT / item["source"] / ".claude-plugin/plugin.json"
        plugin_manifest = json.loads(read(plugin_path))
        check(
            item.get("version") == plugin_manifest.get("version"),
            f"Claude marketplace version matches plugin manifest: {item['name']} {item.get('version')}",
            (
                f"Claude marketplace version mismatch for {item['name']}: "
                f"marketplace={item.get('version')} manifest={plugin_manifest.get('version')}"
            ),
            findings,
        )

    codex_marketplace = json.loads(read(ROOT / ".agents/plugins/marketplace.json"))
    active_codex_names = {item["name"] for item in codex_marketplace.get("plugins", [])}
    active_claude_names = {item["name"] for item in active_claude}
    check(
        active_codex_names == active_claude_names,
        f"active Claude/Codex marketplace plugin sets match: {sorted(active_codex_names)}",
        (
            "active Claude/Codex marketplace plugin sets differ: "
            f"claude={sorted(active_claude_names)} codex={sorted(active_codex_names)}"
        ),
        findings,
    )

    skill_paths = sorted(ROOT.glob("plugins/*/skills/*/SKILL.md"))
    agent_paths = sorted(ROOT.glob("plugins/*/skills/*/agents/openai.yaml"))
    check(
        len(skill_paths) == len(agent_paths),
        f"skill/openai agent counts match: {len(skill_paths)}",
        f"skill/openai agent count mismatch: skills={len(skill_paths)} agents={len(agent_paths)}",
        findings,
    )

    for path in skill_paths:
        fm = parse_frontmatter(path)
        check(
            bool(fm.get("name")) and bool(fm.get("description")),
            f"frontmatter ok: {rel(path)}",
            f"missing name/description frontmatter: {rel(path)}",
            findings,
        )

    shared = ROOT / "plugins/tachikoma/skills/_shared/agent-cli.md"
    check(
        shared.exists(),
        "tachikoma shared protocol exists under skills/_shared",
        "missing tachikoma shared protocol under skills/_shared",
        findings,
    )

    tachikoma_skills = sorted(ROOT.glob("plugins/tachikoma/skills/*/SKILL.md"))
    for path in tachikoma_skills:
        text = read(path)
        check(
            "../_shared/agent-cli.md" in text,
            f"tachikoma skill references shared protocol: {rel(path)}",
            f"tachikoma skill missing shared protocol reference: {rel(path)}",
            findings,
        )

    tachikoma_scope = [
        *tachikoma_skills,
        ROOT / "plugins/tachikoma/skills/_shared/agent-cli.md",
        ROOT / "plugins/tachikoma/commands/collab-fix.md",
        ROOT / "plugins/tachikoma/commands/TDD-debug.md",
    ]
    forbidden_refs = [
        "plugins/tachikoma/skills/shared-agent-cli.md",
        "shared-agent-cli.md",
        "Do not default to read-only",
        "prefer write-capable",
    ]
    for path in tachikoma_scope:
        text = read(path)
        for needle in forbidden_refs:
            check(
                needle not in text,
                f"no stale reference `{needle}` in {rel(path)}",
                f"stale reference `{needle}` in {rel(path)}",
                findings,
            )

    stderr_pattern = re.compile(r"2>/dev/null")
    for path in tachikoma_scope:
        text = read(path)
        bad_lines = []
        for line_number, line in enumerate(text.splitlines(), start=1):
            if not stderr_pattern.search(line):
                continue
            lower = line.lower()
            if "do not use" in lower or "do not discard" in lower:
                continue
            bad_lines.append(line_number)
        check(
            not bad_lines,
            f"no stderr-discard command pattern in {rel(path)}",
            f"stderr-discard command pattern remains in {rel(path)}:{bad_lines}",
            findings,
        )

    for path in [ROOT / "plugins/tachikoma/commands/collab-fix.md", ROOT / "plugins/tachikoma/commands/TDD-debug.md"]:
        text = read(path)
        required = [
            "superpowers:using-git-worktrees",
            "main working tree",
            "launch-all-then-wait-all",
            "full.md",
            "summary.md",
        ]
        for needle in required:
            check(
                needle in text,
                f"command contains `{needle}`: {rel(path)}",
                f"command missing `{needle}`: {rel(path)}",
                findings,
            )

    using_brain = read(ROOT / "plugins/brain/skills/using-ansatz-brain/SKILL.md")
    using_brain_openai = read(ROOT / "plugins/brain/skills/using-ansatz-brain/agents/openai.yaml")
    for needle in [
        "brain:state-machine",
        "Experience Block",
        "UV_CACHE_DIR=./.cache/uv",
        "./.scripts/",
        "Script Responsibility",
        "exploratory rather than verified",
    ]:
        check(
            needle in using_brain,
            f"using-ansatz-brain contains `{needle}`",
            f"using-ansatz-brain missing `{needle}`",
            findings,
        )
    for needle in ["whole-object-responsibility", "state-machine", "external workflow skills"]:
        check(
            needle in using_brain_openai,
            f"using-ansatz-brain OpenAI prompt contains `{needle}`",
            f"using-ansatz-brain OpenAI prompt missing `{needle}`",
            findings,
        )

    state_machine = read(ROOT / "plugins/brain/skills/state-machine/SKILL.md")
    for needle in [
        "./.state-machine/",
        "Parent Nodes",
        "State DAG",
        "Evidence Quality Ladder",
        "Role And Authority Separation",
        "Progress Matrix",
    ]:
        check(
            needle in state_machine,
            f"state-machine contains `{needle}`",
            f"state-machine missing `{needle}`",
            findings,
        )

    failures = [message for status, message in findings if status == "FAIL"]
    for status, message in findings:
        print(f"{status}: {message}")
    print(f"SUMMARY: checks={len(findings)} failures={len(failures)}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
