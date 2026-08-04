#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

MANIFEST_VERSION = 1
LEGACY_MAP = {
    "extensions/aihubmix.ts": "lib/third-party/aihubmix.ts",
    "extensions/codex-slash.ts": "extensions/utility-commands.ts",
    "extensions/goal.ts": "extensions/goal.ts",
    "extensions/slash-framework.ts": "extensions/slash-framework.ts",
    "extensions/web-search.ts": None,
    "lib/goal-core.ts": "lib/goal-core.ts",
    "lib/goal-core.test.ts": "test/goal-core.test.ts",
    "lib/slash-core.ts": "lib/slash-core.ts",
    "lib/slash-core.test.ts": "test/slash-core.test.ts",
    "lib/web-search-core.ts": None,
    "lib/web-search-core.test.ts": None,
    "slashes/python.md": "slashes/python.md",
    "slashes/review.md": "slashes/review.md",
    "skills/pi-extension-dev": "skills/pi-extension-dev",
}
KNOWN_LEGACY_SHA256 = {
    "extensions/aihubmix.ts": "c2f5849af2b3e7fa7489f746e440673d020f04a9d06584c497777ccf57f45ba7",
    "extensions/codex-slash.ts": "8901bc9d0af46652373be9da602761ca7c36f4d87d43cff5479c5931b8dcb025",
    "extensions/goal.ts": "4320157395dea6ec708fe8728043d100b746f9ce53e0c8df15496a95869062ac",
    "extensions/slash-framework.ts": "d55f532e71f29a9db617e594f02e04559e98179eb2d244bba25d0757dbd1a5ef",
    "extensions/web-search.ts": "7c5df87b728ad6f735df56d56d853edfc7cf13aad7f8e6fcbbfa550e53c3b78c",
    "lib/goal-core.ts": "7dc24472ca470fa1d09cdc75b6d21e590fb6611f6de4220e790be27ac2c914b3",
    "lib/goal-core.test.ts": "bb3681a508d7d01de7e3269d2a58dacdb9cfa9eaa3b7594990be03d08ed44b46",
    "lib/slash-core.ts": "b774f0094090f1e134bd3a5d002a15efdc673f7d5a392d4dcb6430f1e679b540",
    "lib/slash-core.test.ts": "f4b1e2842b677dde0c551d0c1417c3ce73c974a02e65bd26d27424e047863f81",
    "lib/web-search-core.ts": "816029a2bdc70b8337402097985a84a5333ee5760a7755370f7dd98da5dba18f",
    "lib/web-search-core.test.ts": "6b80647ad0ba2e0f1abf29d4d7fee695d2d61f197be98ea88313ecc9e7a6917e",
    "slashes/python.md": "270f63e0613ad51f19172df5ad8eb7840c05af1373e2f5ba4dac2e4154fcfcf0",
    "slashes/review.md": "a6c90e9e20ee369d4a42c2e0730ed2812cc890ee26437a2e363f3c6ce0316112",
    "skills/pi-extension-dev/SKILL.md": "c6f47a741e0f941b6795ece214119a31d9f5fe062c2eb10fec163781cd33eb1e",
    "skills/pi-extension-dev/docs/api-reference.md": "2d5b6b24df916ec52738a4752551c612d24832dfad152041afd99378c1ce251d",
    "skills/pi-extension-dev/docs/events.md": "4636318869ac9a873e19cf5dbaf70270645b8017ea3519e35b24f756a2459e0d",
    "skills/pi-extension-dev/docs/pitfalls.md": "439e5b75df482513ee323c03bd3abab6dddb8f35772722938860666fa2b7e693",
    "skills/pi-extension-dev/docs/verification.md": "57f436656aa0c81104346ac0af7b11c71209cb4bf491a6fb6df3a56d272547ed",
    "skills/pi-extension-dev/examples/namespaced-command.ts": "52701e1a1e48174050334302218a43f449f6fe708ddae290c122fe391ccf6686",
}


def fail(message: str) -> None:
    raise SystemExit(f"Error: {message}")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative_files(path: Path) -> list[Path]:
    if path.is_file() or path.is_symlink():
        return [Path(path.name)]
    return sorted(item.relative_to(path) for item in path.rglob("*") if item.is_file())


def load_manifest(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        fail(f"invalid installer manifest {path}: {error}")
    if not isinstance(value, dict) or value.get("version") != MANIFEST_VERSION:
        fail(f"unsupported installer manifest: {path}")
    return value


def package_source(repo_root: Path) -> str:
    return str((repo_root / "pi").resolve())


def package_target(package_root: Path, legacy_relative: str, nested: Path | None = None) -> Path | None:
    mapped = LEGACY_MAP[legacy_relative]
    if mapped is None:
        return None
    base = package_root / mapped
    return base / nested if nested is not None and base.is_dir() else base


def recognized_file(
    pi_home: Path,
    package_root: Path,
    legacy_root: str,
    nested: Path,
    previous_hashes: dict[str, str],
) -> bool:
    source = pi_home / legacy_root
    source_file = source if source.is_file() or source.is_symlink() else source / nested
    key = str(Path(legacy_root) / nested) if source.is_dir() else legacy_root
    digest = sha256_file(source_file)
    target = package_target(package_root, legacy_root, nested if source.is_dir() else None)
    if target is not None and target.is_file() and source_file.read_bytes() == target.read_bytes():
        return True
    return digest in {KNOWN_LEGACY_SHA256.get(key), previous_hashes.get(key)}


def planned_legacy_migrations(pi_home: Path, repo_root: Path, manifest: dict | None) -> list[dict]:
    package_root = repo_root / "pi"
    previous_hashes = (manifest or {}).get("legacy_hashes", {})
    planned: list[dict] = []
    conflicts: list[str] = []
    for relative in LEGACY_MAP:
        source = pi_home / relative
        if not source.exists() and not source.is_symlink():
            continue
        nested_files = relative_files(source)
        if all(recognized_file(pi_home, package_root, relative, nested, previous_hashes) for nested in nested_files):
            hashes = {}
            for nested in nested_files:
                source_file = source if source.is_file() or source.is_symlink() else source / nested
                key = str(Path(relative) / nested) if source.is_dir() else relative
                hashes[key] = sha256_file(source_file)
            planned.append({"relative": relative, "hashes": hashes})
        else:
            conflicts.append(str(source))
    if conflicts:
        fail("unmanaged conflict: " + ", ".join(conflicts))
    return planned


def atomic_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    os.close(fd)
    temporary_path = Path(temporary)
    try:
        temporary_path.write_text(json.dumps(value, indent=2) + "\n")
        os.chmod(temporary_path, 0o600)
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)


def run_pi(pi_bin: str, arguments: list[str], dry_run: bool) -> None:
    print("PI " + " ".join(arguments))
    if dry_run:
        return
    subprocess.run([pi_bin, *arguments], check=True)


def backup_and_remove(pi_home: Path, backup_root: Path, planned: list[dict], dry_run: bool) -> None:
    for item in planned:
        source = pi_home / item["relative"]
        target = backup_root / item["relative"]
        print(f"BACKUP {source} -> {target}")
        print(f"REMOVE {source}")
        if dry_run:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.is_dir() and not source.is_symlink():
            shutil.copytree(source, target)
            shutil.rmtree(source)
        else:
            shutil.copy2(source, target, follow_symlinks=False)
            source.unlink()


def settings_contains_source(pi_home: Path, source: str) -> bool:
    path = pi_home / "settings.json"
    if not path.exists():
        return False
    try:
        packages = json.loads(path.read_text()).get("packages", [])
    except (OSError, json.JSONDecodeError):
        return False
    values = [item if isinstance(item, str) else item.get("source") for item in packages]
    return source in values


def install(args: argparse.Namespace) -> None:
    repo_root = Path(args.repo_root).resolve()
    pi_home = Path(args.pi_home).expanduser().resolve()
    source = package_source(repo_root)
    manifest_path = pi_home / ".cyberbrain-pi.manifest.json"
    old_manifest = load_manifest(manifest_path)
    planned = planned_legacy_migrations(pi_home, repo_root, old_manifest)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_root = pi_home / "backups" / "cyberbrain-pi" / timestamp
    backup_and_remove(pi_home, backup_root, planned, args.dry_run)
    run_pi(args.pi_bin, ["install", source], args.dry_run)
    if args.dry_run:
        return
    legacy_hashes = dict((old_manifest or {}).get("legacy_hashes", {}))
    for item in planned:
        legacy_hashes.update(item["hashes"])
    previous_migrated = set((old_manifest or {}).get("migrated", []))
    previous_migrated.update(item["relative"] for item in planned)
    atomic_json(manifest_path, {
        "version": MANIFEST_VERSION,
        "source": source,
        "installed_at": (old_manifest or {}).get("installed_at", datetime.now(timezone.utc).isoformat()),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "backup_dir": str(backup_root) if planned else (old_manifest or {}).get("backup_dir"),
        "migrated": sorted(previous_migrated),
        "legacy_hashes": legacy_hashes,
    })


def update(args: argparse.Namespace) -> None:
    repo_root = Path(args.repo_root).resolve()
    pi_home = Path(args.pi_home).expanduser().resolve()
    source = package_source(repo_root)
    manifest_path = pi_home / ".cyberbrain-pi.manifest.json"
    manifest = load_manifest(manifest_path)
    if not manifest or manifest.get("source") != source:
        fail("installer manifest source does not match this Cyberbrain clone")
    planned = planned_legacy_migrations(pi_home, repo_root, manifest)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_root = pi_home / "backups" / "cyberbrain-pi" / timestamp
    backup_and_remove(pi_home, backup_root, planned, args.dry_run)
    if args.dry_run:
        run_pi(args.pi_bin, ["update", "--extension", source], True)
        return
    try:
        run_pi(args.pi_bin, ["update", "--extension", source], False)
    except subprocess.CalledProcessError:
        run_pi(args.pi_bin, ["install", source], False)
    if planned:
        manifest["backup_dir"] = str(backup_root)
        manifest["migrated"] = sorted(set(manifest.get("migrated", [])) | {item["relative"] for item in planned})
        for item in planned:
            manifest.setdefault("legacy_hashes", {}).update(item["hashes"])
    manifest["updated_at"] = datetime.now(timezone.utc).isoformat()
    atomic_json(manifest_path, manifest)


def doctor(args: argparse.Namespace) -> int:
    repo_root = Path(args.repo_root).resolve()
    pi_home = Path(args.pi_home).expanduser().resolve()
    source = package_source(repo_root)
    manifest = load_manifest(pi_home / ".cyberbrain-pi.manifest.json")
    issues: list[str] = []
    if not manifest:
        issues.append("installer manifest missing")
    elif manifest.get("source") != source:
        issues.append("installer manifest points to a different Cyberbrain clone")
    if not settings_contains_source(pi_home, source):
        issues.append("cyberbrain-pi local package is not registered in settings.json")
    for relative in LEGACY_MAP:
        path = pi_home / relative
        if path.exists() or path.is_symlink():
            if relative.startswith("slashes/"):
                print(f"OVERRIDE {path}")
            else:
                issues.append(f"legacy resource still present: {path}")
    for variable in ("AIHUBMIX_API_KEY", "DEEPSEEK_API_KEY"):
        if not os.environ.get(variable):
            issues.append(f"environment variable is not set: {variable}")
    tests = sorted(str(path) for path in (repo_root / "pi/test").glob("*.test.ts"))
    commands = [["node", "--test", *tests]] if tests else []
    commands.extend([["node", "--check", str(path)] for path in sorted((repo_root / "pi").glob("extensions/*.ts"))])
    commands.extend([["node", "--check", str(path)] for path in sorted((repo_root / "pi").glob("lib/**/*.ts"))])
    for command in commands:
        result = subprocess.run(command)
        if result.returncode != 0:
            issues.append("verification failed: " + " ".join(command))
    for issue in issues:
        print(f"Warning: {issue}", file=sys.stderr)
    if issues:
        print(f"Doctor found {len(issues)} issue(s)", file=sys.stderr)
        return 1
    print(f"Doctor OK: cyberbrain-pi is installed from {source}")
    return 0


def uninstall(args: argparse.Namespace) -> None:
    repo_root = Path(args.repo_root).resolve()
    pi_home = Path(args.pi_home).expanduser().resolve()
    source = package_source(repo_root)
    manifest_path = pi_home / ".cyberbrain-pi.manifest.json"
    manifest = load_manifest(manifest_path)
    run_pi(args.pi_bin, ["remove", source], args.dry_run)
    if args.restore_legacy and manifest and manifest.get("backup_dir"):
        backup_root = Path(manifest["backup_dir"])
        for relative in manifest.get("migrated", []):
            source_path = backup_root / relative
            target_path = pi_home / relative
            if not source_path.exists() and not source_path.is_symlink():
                continue
            if target_path.exists() or target_path.is_symlink():
                fail(f"restore conflict: {target_path}")
            print(f"RESTORE {source_path} -> {target_path}")
            if args.dry_run:
                continue
            target_path.parent.mkdir(parents=True, exist_ok=True)
            if source_path.is_dir() and not source_path.is_symlink():
                shutil.copytree(source_path, target_path)
            else:
                shutil.copy2(source_path, target_path, follow_symlinks=False)
    if not args.dry_run:
        manifest_path.unlink(missing_ok=True)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser()
    result.add_argument("command", choices=("install", "update", "doctor", "uninstall"))
    result.add_argument("--dry-run", action="store_true")
    result.add_argument("--restore-legacy", action="store_true")
    result.add_argument("--pi-home", default=str(Path.home() / ".pi/agent"))
    result.add_argument("--pi-bin", default="pi")
    result.add_argument("--repo-root", default=str(Path(__file__).resolve().parents[1]))
    return result


def main() -> int:
    args = parser().parse_args()
    if args.command == "install":
        install(args)
        return 0
    if args.command == "update":
        update(args)
        return 0
    if args.command == "doctor":
        return doctor(args)
    uninstall(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
