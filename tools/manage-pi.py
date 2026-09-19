#!/usr/bin/env python3
from __future__ import annotations

import argparse
import fcntl
from functools import wraps
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import shutil
import stat
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


def checked_path(root: Path, path: Path, *, allow_leaf_link: bool = False) -> Path:
    """Reject lexical escapes and symlink parents; never resolve through them."""
    try:
        relative = path.relative_to(root)
    except ValueError:
        fail(f"path outside managed directory: {path}")
    if not relative.parts or any(part in (".", "..") for part in relative.parts):
        fail(f"invalid managed path: {path}")
    current = root
    for index, part in enumerate(relative.parts):
        current = current / part
        leaf = index == len(relative.parts) - 1
        if current.is_symlink() and not (leaf and allow_leaf_link):
            fail(f"symlink in managed path: {current}")
    return path


def locked_operation(operation):
    @wraps(operation)
    def run(args):
        home = Path(args.pi_home).expanduser().resolve()
        if home in (Path('/'), Path.home().resolve(), Path(args.repo_root).resolve()):
            fail(f"refusing broad directory as Pi home: {home}")
        if args.dry_run:
            return operation(args)
        home.mkdir(parents=True, exist_ok=True)
        lock = checked_path(home, home / '.cyberbrain-pi.lock')
        fd = os.open(lock, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
                fail(f"invalid installer lock: {lock}")
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                fail(f"another installer operation is running: {home}")
            # Keep the inode: unlinking a flock file can allow two lock owners.
            return operation(args)
        finally:
            os.close(fd)
    return run


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative_files(path: Path) -> list[Path]:
    if not path.is_dir():
        if not path.is_file():
            fail(f"unmanaged conflict: missing or special resource {path}")
        return [Path(path.name)]
    entries = list(path.rglob("*"))
    if any(item.is_symlink() or not (item.is_file() or item.is_dir()) for item in entries):
        fail(f"unmanaged conflict: nested link or special file in {path}")
    files = sorted(item.relative_to(path) for item in entries if item.is_file())
    if not files:
        fail(f"unmanaged conflict: empty resource directory {path}")
    return files


def load_manifest(path: Path) -> dict | None:
    checked_path(path.parent, path)
    if not path.exists():
        return None
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        fail(f"invalid installer manifest {path}: {error}")
    if not isinstance(value, dict) or value.get("version") != MANIFEST_VERSION:
        fail(f"unsupported installer manifest: {path}")
    if not isinstance(value.get("source"), str) or not Path(value['source']).is_absolute():
        fail(f"invalid manifest source: {path}")
    for field in ('legacy_backups', 'legacy_hashes'):
        if not isinstance(value.get(field, {}), dict):
            fail(f"invalid manifest {field}: {path}")
    migrated = value.get('migrated', [])
    if not isinstance(migrated, list) or any(not isinstance(key, str) or key not in LEGACY_MAP for key in migrated):
        fail(f"invalid manifest resource list: {path}")
    if 'backup_dir' in value and not isinstance(value['backup_dir'], str):
        fail(f"invalid manifest backup_dir: {path}")
    backup_root = path.parent / 'backups' / 'cyberbrain-pi'
    checked_path(path.parent, backup_root)
    for relative, backup in legacy_backups(value).items():
        if relative not in LEGACY_MAP or not isinstance(backup, str):
            fail(f"invalid manifest backup entry: {relative}")
        checked_path(backup_root, Path(backup), allow_leaf_link=True)
    for key, digest in value.get('legacy_hashes', {}).items():
        if not isinstance(key, str) or Path(key).is_absolute() or '..' in Path(key).parts or not isinstance(digest, str):
            fail(f"invalid manifest hash entry: {path}")
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
    source_file = source / nested if source.is_dir() else source
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
        source = checked_path(pi_home, pi_home / relative, allow_leaf_link=True)
        if not source.exists() and not source.is_symlink():
            continue
        nested_files = relative_files(source)
        if all(recognized_file(pi_home, package_root, relative, nested, previous_hashes) for nested in nested_files):
            hashes = {}
            for nested in nested_files:
                source_file = source / nested if source.is_dir() else source
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


def run_pi(pi_bin: str, arguments: list[str], dry_run: bool, pi_home: Path) -> None:
    print("PI " + " ".join(arguments))
    if dry_run:
        return
    subprocess.run([pi_bin, *arguments], check=True,
                   env={**os.environ, "PI_CODING_AGENT_DIR": str(pi_home)})


def backup_legacy(pi_home: Path, backup_root: Path, planned: list[dict]) -> None:
    for item in planned:
        source = checked_path(pi_home, pi_home / item["relative"], allow_leaf_link=True)
        target = backup_root / item["relative"]
        print(f"BACKUP {source} -> {target}")
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.is_dir() and not source.is_symlink():
            shutil.copytree(source, target, symlinks=True)
        else:
            shutil.copy2(source, target, follow_symlinks=False)


def legacy_backups(manifest: dict | None) -> dict[str, str]:
    """Read both the original single-batch manifest and per-resource backups."""
    manifest = manifest or {}
    backups = dict(manifest.get("legacy_backups", {}))
    if manifest.get("backup_dir"):
        for relative in manifest.get("migrated", []):
            backups.setdefault(relative, str(Path(manifest["backup_dir"]) / relative))
    return backups


def copy_resource(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.is_dir() and not source.is_symlink():
        shutil.copytree(source, target, symlinks=True)
    else:
        shutil.copy2(source, target, follow_symlinks=False)


def migrate_and_run(args: argparse.Namespace, old_manifest: dict | None,
                    planned: list[dict], command) -> None:
    pi_home = Path(args.pi_home).expanduser().resolve()
    manifest_path = pi_home / ".cyberbrain-pi.manifest.json"
    source = package_source(Path(args.repo_root).resolve())
    if args.dry_run:
        for item in planned:
            print(f"MIGRATE {pi_home / item['relative']} (backup before removal)")
        command()
        return

    backups = legacy_backups(old_manifest)
    backup_root = None
    if planned:
        parent = checked_path(pi_home, pi_home / "backups" / "cyberbrain-pi")
        parent.mkdir(parents=True, exist_ok=True)
        backup_root = Path(tempfile.mkdtemp(
            prefix=datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ-"), dir=parent))
        # Finish every backup before deleting any live resource.
        backup_legacy(pi_home, backup_root, planned)
        for item in planned:
            backups[item["relative"]] = str(backup_root / item["relative"])
        # Refuse edits occurring between preflight and backup/deletion.
        current = planned_legacy_migrations(pi_home, Path(args.repo_root).resolve(), old_manifest)
        if current != planned or any(not resources_match(pi_home / item['relative'], Path(backups[item['relative']])) for item in planned):
            fail("resources changed during preflight; nothing removed")

    manifest = dict(old_manifest or {})
    hashes = dict(manifest.get("legacy_hashes", {}))
    for item in planned:
        hashes.update(item["hashes"])
    manifest.update({
        "version": MANIFEST_VERSION,
        "source": source,
        "installed_at": manifest.get("installed_at", datetime.now(timezone.utc).isoformat()),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "legacy_backups": backups,
        "migrated": sorted(backups),
        "legacy_hashes": hashes,
        "migration_pending": True,
    })
    manifest.pop("backup_dir", None)
    # Recovery information survives both command failures and process interruption.
    atomic_json(manifest_path, manifest)
    removed: list[str] = []
    try:
        for item in planned:
            relative = item["relative"]
            path = checked_path(pi_home, pi_home / relative, allow_leaf_link=True)
            print(f"REMOVE {path}")
            removed.append(relative)
            if path.is_dir() and not path.is_symlink():
                shutil.rmtree(path)
            else:
                path.unlink()
        command()
        manifest["migration_pending"] = False
        atomic_json(manifest_path, manifest)
    except BaseException:
        # Keep the recovery manifest if rollback itself fails or a new file conflicts.
        for relative in removed:
            target = checked_path(pi_home, pi_home / relative, allow_leaf_link=True)
            if target.exists() or target.is_symlink():
                fail(f"rollback conflict: {target}; recovery manifest retained at {manifest_path}")
            copy_resource(Path(backups[relative]), target)
        if old_manifest is None:
            manifest_path.unlink(missing_ok=True)
        else:
            atomic_json(manifest_path, old_manifest)
        raise


def settings_contains_source(pi_home: Path, source: str) -> bool:
    path = pi_home / "settings.json"
    if not path.exists():
        return False
    try:
        packages = json.loads(path.read_text()).get("packages", [])
    except (OSError, json.JSONDecodeError):
        return False
    values = [item if isinstance(item, str) else item.get("source") for item in packages]
    for value in values:
        if not isinstance(value, str):
            continue
        candidate = Path(value).expanduser()
        if not candidate.is_absolute():
            candidate = path.parent / candidate
        resolved_candidate = candidate.resolve()
        resolved_source = Path(source).resolve()
        try:
            if resolved_candidate.exists() and resolved_source.exists() and os.path.samefile(resolved_candidate, resolved_source):
                return True
        except OSError:
            pass
        if os.path.realpath(resolved_candidate) == os.path.realpath(resolved_source):
            return True
    return False


@locked_operation
def install(args: argparse.Namespace) -> None:
    repo_root = Path(args.repo_root).resolve()
    pi_home = Path(args.pi_home).expanduser().resolve()
    source = package_source(repo_root)
    manifest_path = pi_home / ".cyberbrain-pi.manifest.json"
    old_manifest = load_manifest(manifest_path)
    planned = planned_legacy_migrations(pi_home, repo_root, old_manifest)
    migrate_and_run(args, old_manifest, planned,
                    lambda: run_pi(args.pi_bin, ["install", source], args.dry_run, pi_home))


@locked_operation
def update(args: argparse.Namespace) -> None:
    repo_root = Path(args.repo_root).resolve()
    pi_home = Path(args.pi_home).expanduser().resolve()
    source = package_source(repo_root)
    manifest_path = pi_home / ".cyberbrain-pi.manifest.json"
    manifest = load_manifest(manifest_path)
    if not manifest or manifest.get("source") != source:
        fail("installer manifest source does not match this Cyberbrain clone")
    planned = planned_legacy_migrations(pi_home, repo_root, manifest)
    def command():
        try:
            run_pi(args.pi_bin, ["update", "--extension", source], args.dry_run, pi_home)
        except subprocess.CalledProcessError:
            run_pi(args.pi_bin, ["install", source], args.dry_run, pi_home)
    migrate_and_run(args, manifest, planned, command)


def doctor_commands(repo_root: Path, full: bool = False) -> list[list[str]]:
    """Build a fast runtime smoke check, with the developer suite opt-in."""
    runtime_paths = sorted((repo_root / "pi/extensions").glob("*.ts"))
    runtime_paths.extend(sorted((repo_root / "pi/lib").glob("**/*.ts")))
    modules = json.dumps([path.resolve().as_uri() for path in runtime_paths])
    smoke = (
        f"const modules = {modules}; "
        "for (const module of modules) await import(module);"
    )
    commands = [[
        "node", "--experimental-strip-types", "--input-type=module", "-e", smoke,
    ]]
    if not full:
        return commands

    tests = sorted(str(path) for path in (repo_root / "pi/test").glob("*.test.ts"))
    if tests:
        commands.append(["node", "--experimental-strip-types", "--test", *tests])
    commands.extend(
        [sys.executable, str(path)]
        for path in sorted((repo_root / "pi/test").glob("*.test.py"))
    )
    return commands


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
    elif manifest.get("restoration_pending"):
        issues.append("interrupted restoration; retry uninstall --restore-legacy")
    elif manifest.get("migration_pending"):
        issues.append("interrupted migration; retry install or uninstall --restore-legacy")
    if not settings_contains_source(pi_home, source):
        issues.append("cyberbrain-pi local package is not registered in settings.json")
    for relative in LEGACY_MAP:
        path = pi_home / relative
        if path.exists() or path.is_symlink():
            if relative.startswith("slashes/"):
                print(f"OVERRIDE {path}")
            else:
                issues.append(f"legacy resource still present: {path}")
    for status, provider, variable in (
        ("DISABLED", "aihubmix", "AIHUBMIX_API_KEY"),
        ("UNAVAILABLE", "deepseek-full", "DEEPSEEK_API_KEY"),
        ("DISABLED", "cuhksz", "CUHKSZ_API_KEY"),
    ):
        if not os.environ.get(variable):
            print(f"{status} {provider}: environment variable is not set: {variable}")
    for command in doctor_commands(repo_root, getattr(args, "full", False)):
        result = subprocess.run(command, env={**os.environ, "PI_CODING_AGENT_DIR": str(pi_home)})
        if result.returncode != 0:
            issues.append("verification failed: " + " ".join(command))
    for issue in issues:
        print(f"Warning: {issue}", file=sys.stderr)
    if issues:
        print(f"Doctor found {len(issues)} issue(s)", file=sys.stderr)
        return 1
    print(f"Doctor OK: cyberbrain-pi is installed from {source}")
    return 0


def resources_match(source: Path, target: Path) -> bool:
    """Recognize a completed restore without following symlinks or accepting edits."""
    if source.is_symlink() or target.is_symlink():
        return source.is_symlink() and target.is_symlink() and os.readlink(source) == os.readlink(target)
    if source.is_file() and target.is_file():
        return source.read_bytes() == target.read_bytes()
    if source.is_dir() and target.is_dir():
        names = {item.name for item in source.iterdir()}
        return names == {item.name for item in target.iterdir()} and all(
            resources_match(source / name, target / name) for name in names)
    return False


def restore_resource(source: Path, target: Path) -> None:
    # Stage whole directories too: failed copies must not strand partial targets.
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".cyberbrain-restore-", dir=target.parent) as temporary:
        staged = Path(temporary) / "resource"
        copy_resource(source, staged)
        if target.exists() or target.is_symlink():
            fail(f"restore conflict: {target}")
        staged.rename(target)


@locked_operation
def uninstall(args: argparse.Namespace) -> None:
    repo_root = Path(args.repo_root).resolve()
    pi_home = Path(args.pi_home).expanduser().resolve()
    source = package_source(repo_root)
    manifest_path = pi_home / ".cyberbrain-pi.manifest.json"
    manifest = load_manifest(manifest_path)
    if manifest and manifest.get('source') != source:
        fail("installer manifest source does not match this Cyberbrain clone")
    backups = legacy_backups(manifest) if args.restore_legacy else {}
    resuming = bool(backups and (manifest or {}).get("restoration_pending"))
    # Preflight the entire restoration before removing the registered package.
    for relative, backup in backups.items():
        source_path = Path(backup)
        target_path = checked_path(pi_home, pi_home / relative, allow_leaf_link=True)
        if not source_path.exists() and not source_path.is_symlink():
            fail(f"backup missing: {source_path}; manifest retained")
        if target_path.exists() or target_path.is_symlink():
            if not resuming or not resources_match(source_path, target_path):
                fail(f"restore conflict: {target_path}")
    if backups and not args.dry_run:
        manifest["restoration_pending"] = True
        atomic_json(manifest_path, manifest)
    # A previous removal may have succeeded before restoration or its process
    # failed. Pi returns nonzero for already-removed packages; do not remove twice.
    if not resuming or settings_contains_source(pi_home, source):
        run_pi(args.pi_bin, ["remove", source], args.dry_run, pi_home)
    for relative, backup in backups.items():
        source_path = Path(backup)
        target_path = checked_path(pi_home, pi_home / relative, allow_leaf_link=True)
        if target_path.exists() or target_path.is_symlink():
            if resuming and resources_match(source_path, target_path):
                continue
            fail(f"restore conflict: {target_path}")
        print(f"RESTORE {source_path} -> {target_path}")
        if not args.dry_run:
            restore_resource(source_path, target_path)
    if not args.dry_run:
        manifest_path.unlink(missing_ok=True)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser()
    result.add_argument("command", choices=("install", "update", "doctor", "uninstall"))
    result.add_argument("--dry-run", action="store_true")
    result.add_argument("--restore-legacy", action="store_true")
    result.add_argument(
        "--full",
        action="store_true",
        help="doctor only: also run the complete TypeScript and Python test suites",
    )
    result.add_argument("--pi-home", default=os.environ.get("PI_CODING_AGENT_DIR") or str(Path.home() / ".pi/agent"))
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
