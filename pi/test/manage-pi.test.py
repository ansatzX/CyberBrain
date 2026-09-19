import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("manage_pi", REPO / "tools/manage-pi.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name) / "agent"
        self.args = argparse.Namespace(repo_root=str(REPO), pi_home=str(self.home),
                                       pi_bin="pi", dry_run=False, restore_legacy=True)
        self.manifest = self.home / ".cyberbrain-pi.manifest.json"

    def place(self, relative):
        target = self.home / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(REPO / "pi" / relative, target)
        return target

    def test_parent_symlink_rejected_without_touching_external_file(self):
        outside = Path(self.temp.name) / 'outside'
        outside.mkdir()
        target = outside / 'goal.ts'
        target.write_bytes((REPO / 'pi/extensions/goal.ts').read_bytes())
        self.home.mkdir()
        (self.home / 'extensions').symlink_to(outside, target_is_directory=True)
        before = target.read_bytes()
        with patch.object(installer, 'run_pi') as run:
            with self.assertRaisesRegex(SystemExit, 'symlink in managed path'):
                installer.install(self.args)
            run.assert_not_called()
        self.assertEqual(target.read_bytes(), before)
        self.assertFalse(self.manifest.exists())

    def test_nested_unknown_links_rejected(self):
        for kind in ('directory', 'file', 'dangling'):
            with self.subTest(kind=kind):
                skill = self.home / 'skills/pi-extension-dev'
                skill.mkdir(parents=True, exist_ok=True)
                (skill / 'SKILL.md').write_bytes((REPO / 'pi/skills/pi-extension-dev/SKILL.md').read_bytes())
                outside = Path(self.temp.name) / kind
                if kind == 'directory':
                    outside.mkdir()
                elif kind == 'file':
                    outside.write_text('private fixture')
                link = skill / 'user-link'
                link.symlink_to(outside, target_is_directory=kind == 'directory')
                with patch.object(installer, 'run_pi') as run:
                    with self.assertRaisesRegex(SystemExit, 'unmanaged conflict'):
                        installer.install(self.args)
                    run.assert_not_called()
                self.assertTrue(link.is_symlink())
                link.unlink()

    def test_copy_resource_preserves_nested_links(self):
        source = Path(self.temp.name) / 'resource'
        source.mkdir()
        (source / 'link').symlink_to('../not-present')
        target = Path(self.temp.name) / 'copy'
        installer.copy_resource(source, target)
        self.assertTrue((target / 'link').is_symlink())
        self.assertEqual(os.readlink(target / 'link'), '../not-present')

    def test_empty_or_special_resource_is_not_assumed_owned(self):
        skill = self.home / 'skills/pi-extension-dev'
        skill.mkdir(parents=True)
        with patch.object(installer, 'run_pi') as run:
            with self.assertRaisesRegex(SystemExit, 'empty resource directory'):
                installer.install(self.args)
            run.assert_not_called()
        skill.rmdir()
        fifo = self.home / 'extensions/goal.ts'
        fifo.parent.mkdir()
        os.mkfifo(fifo)
        with patch.object(installer, 'run_pi') as run:
            with self.assertRaisesRegex(SystemExit, 'special resource'):
                installer.install(self.args)
            run.assert_not_called()

    def test_restore_rejects_manifest_escape_and_unknown_resource(self):
        self.home.mkdir()
        backup = Path(self.temp.name) / 'fixture'
        backup.write_text('fixture')
        for key in ('../escaped.txt', str(Path(self.temp.name) / 'absolute.txt'), 'auth.json'):
            with self.subTest(key=key):
                value = {'version': 1, 'source': str(REPO / 'pi'), 'legacy_backups': {key: str(backup)}}
                self.manifest.write_text(json.dumps(value))
                before = self.manifest.read_bytes()
                with patch.object(installer, 'run_pi') as run:
                    with self.assertRaisesRegex(SystemExit, 'invalid manifest backup entry'):
                        installer.uninstall(self.args)
                    run.assert_not_called()
                self.assertEqual(self.manifest.read_bytes(), before)
        self.assertFalse((Path(self.temp.name) / 'escaped.txt').exists())

    def test_restore_rejects_backup_outside_owned_root(self):
        self.home.mkdir()
        backup = Path(self.temp.name) / 'outside'
        backup.write_text('fixture')
        self.manifest.write_text(json.dumps({'version': 1, 'source': str(REPO / 'pi'), 'legacy_backups': {'extensions/goal.ts': str(backup)}}))
        with patch.object(installer, 'run_pi') as run:
            with self.assertRaisesRegex(SystemExit, 'outside managed directory'):
                installer.uninstall(self.args)
            run.assert_not_called()
        self.assertEqual(backup.read_text(), 'fixture')

    def test_restore_rejects_symlink_parent(self):
        self.place('extensions/goal.ts')
        with patch.object(installer, 'run_pi'):
            installer.install(self.args)
        (self.home / 'extensions').rmdir()
        outside = Path(self.temp.name) / 'outside'
        outside.mkdir()
        (self.home / 'extensions').symlink_to(outside, target_is_directory=True)
        with patch.object(installer, 'run_pi') as run:
            with self.assertRaisesRegex(SystemExit, 'symlink in managed path'):
                installer.uninstall(self.args)
            run.assert_not_called()
        self.assertFalse((outside / 'goal.ts').exists())

    def test_installer_lock_blocks_other_process_and_releases_after_failure(self):
        def competing_operation(*args):
            result = subprocess.run([sys.executable, '-B', str(REPO / 'tools/manage-pi.py'),
                'install', '--pi-home', str(self.home), '--repo-root', str(REPO),
                '--pi-bin', '/not-executed'], capture_output=True, text=True, timeout=5)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('another installer operation', result.stderr)
            raise RuntimeError('simulated command failure')
        with patch.object(installer, 'run_pi', side_effect=competing_operation):
            with self.assertRaisesRegex(RuntimeError, 'simulated'):
                installer.install(self.args)
        with patch.object(installer, 'run_pi') as run:
            installer.install(self.args)
            run.assert_called_once()

    def test_dry_run_does_not_create_home_or_lock(self):
        self.args.dry_run = True
        installer.install(self.args)
        self.assertFalse(self.home.exists())

    def test_change_during_backup_prevents_removal(self):
        target = self.place('extensions/goal.ts')
        original_backup = installer.backup_legacy
        def changed(*args):
            original_backup(*args)
            target.write_text('user edit during backup')
        with patch.object(installer, 'backup_legacy', side_effect=changed), patch.object(installer, 'run_pi') as run:
            with self.assertRaises(SystemExit):
                installer.install(self.args)
            run.assert_not_called()
        self.assertEqual(target.read_text(), 'user edit during backup')
        self.assertFalse(self.manifest.exists())

    def test_sensitive_state_is_preserved(self):
        self.home.mkdir()
        markers = {'auth.json': 'secret fixture', 'settings.json': '{"enabledModels":["mine"]}',
                   'sessions/session.jsonl': 'session fixture', 'goals/task.json': 'goal fixture'}
        for name, text in markers.items():
            path = self.home / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
        with patch.object(installer, 'run_pi'):
            installer.install(self.args)
            installer.update(self.args)
            installer.uninstall(self.args)
        for name, text in markers.items():
            self.assertEqual((self.home / name).read_text(), text)

    def test_failed_first_install_restores_files(self):
        target = self.place("extensions/goal.ts")
        original = target.read_bytes()

        def fail(*args):
            self.assertFalse(target.exists())
            pending = json.loads(self.manifest.read_text())
            self.assertTrue(pending["migration_pending"])
            self.assertTrue(Path(pending["legacy_backups"]["extensions/goal.ts"]).exists())
            raise FileNotFoundError("pi unavailable")

        with patch.object(installer, "run_pi", side_effect=fail):
            with self.assertRaises(FileNotFoundError):
                installer.install(self.args)
        self.assertEqual(target.read_bytes(), original)
        self.assertFalse(self.manifest.exists())

    def test_failed_update_and_fallback_restore_previous_manifest(self):
        with patch.object(installer, "run_pi"):
            installer.install(self.args)
        original = self.manifest.read_bytes()
        target = self.place("slashes/review.md")
        with patch.object(installer, "run_pi", side_effect=subprocess.CalledProcessError(1, "pi")) as run:
            with self.assertRaises(subprocess.CalledProcessError):
                installer.update(self.args)
        self.assertEqual(run.call_count, 2)
        self.assertTrue(target.exists())
        self.assertEqual(self.manifest.read_bytes(), original)

    def test_backup_failure_removes_no_live_resources(self):
        first = self.place("extensions/goal.ts")
        second = self.place("slashes/review.md")
        real_copy = shutil.copy2

        def copy(source, target, **kwargs):
            if str(source).endswith("review.md"):
                raise OSError("backup disk full")
            return real_copy(source, target, **kwargs)

        with patch.object(installer.shutil, "copy2", side_effect=copy):
            with self.assertRaisesRegex(OSError, "backup disk full"):
                installer.install(self.args)
        self.assertTrue(first.exists())
        self.assertTrue(second.exists())
        self.assertFalse(self.manifest.exists())

    def test_restore_multiple_batches(self):
        first = self.place("extensions/goal.ts")
        with patch.object(installer, "run_pi"):
            installer.install(self.args)
            second = self.place("slashes/review.md")
            installer.update(self.args)
            data = json.loads(self.manifest.read_text())
            self.assertEqual(len(data["legacy_backups"]), 2)
            installer.uninstall(self.args)
        self.assertTrue(first.exists())
        self.assertTrue(second.exists())
        self.assertFalse(self.manifest.exists())

    def test_missing_backup_preserves_manifest_and_package(self):
        self.place("extensions/goal.ts")
        with patch.object(installer, "run_pi"):
            installer.install(self.args)
        data = json.loads(self.manifest.read_text())
        Path(data["legacy_backups"]["extensions/goal.ts"]).unlink()
        with patch.object(installer, "run_pi") as run:
            with self.assertRaisesRegex(SystemExit, "backup missing"):
                installer.uninstall(self.args)
            run.assert_not_called()
        self.assertTrue(self.manifest.exists())

    def test_restore_conflict_preflight_prevents_partial_restore(self):
        first = self.place("extensions/goal.ts")
        self.place("slashes/review.md")
        with patch.object(installer, "run_pi"):
            installer.install(self.args)
        self.place("slashes/review.md").write_text("user override")
        with patch.object(installer, "run_pi") as run:
            with self.assertRaisesRegex(SystemExit, "restore conflict"):
                installer.uninstall(self.args)
            run.assert_not_called()
        self.assertFalse(first.exists())
        self.assertTrue(self.manifest.exists())

    def test_original_manifest_is_supported(self):
        self.place("extensions/goal.ts")
        with patch.object(installer, "run_pi"):
            installer.install(self.args)
            data = json.loads(self.manifest.read_text())
            backup = Path(data.pop("legacy_backups")["extensions/goal.ts"])
            data["backup_dir"] = str(backup.parent.parent)
            self.manifest.write_text(json.dumps(data))
            installer.uninstall(self.args)
        self.assertTrue((self.home / "extensions/goal.ts").exists())

    def test_pi_home_is_propagated_without_mutating_parent_environment(self):
        with patch.dict(os.environ, {"PI_CODING_AGENT_DIR": "/different-home"}):
            self.assertEqual(installer.parser().parse_args(["install"]).pi_home, "/different-home")
            with patch.object(installer.subprocess, "run") as run:
                installer.run_pi("pi", ["install", "package"], False, self.home)
            self.assertEqual(run.call_args.kwargs["env"]["PI_CODING_AGENT_DIR"], str(self.home))
            self.assertEqual(os.environ["PI_CODING_AGENT_DIR"], "/different-home")

    def test_interrupted_restore_resumes_without_removing_package_twice(self):
        first = self.place("extensions/goal.ts")
        second = self.place("slashes/review.md")
        with patch.object(installer, "run_pi"):
            installer.install(self.args)
        original_copy = installer.copy_resource
        count = 0

        def fail_second(source, target):
            nonlocal count
            count += 1
            if count == 2:
                target.write_text("partial copy")
                raise OSError("simulated copy failure")
            original_copy(source, target)

        with patch.object(installer, "run_pi") as run:
            with patch.object(installer, "copy_resource", side_effect=fail_second):
                with self.assertRaises(OSError):
                    installer.uninstall(self.args)
            self.assertTrue(first.exists())
            self.assertFalse(second.exists())
            self.assertTrue(json.loads(self.manifest.read_text())["restoration_pending"])
            installer.uninstall(self.args)
            run.assert_called_once()
        self.assertEqual(second.read_bytes(), (REPO / "pi/slashes/review.md").read_bytes())
        self.assertFalse(self.manifest.exists())
        self.assertFalse(list(self.home.rglob(".cyberbrain-restore-*")))

    def test_retry_rejects_user_edit_to_restored_file(self):
        first = self.place("extensions/goal.ts")
        self.place("slashes/review.md")
        with patch.object(installer, "run_pi"):
            installer.install(self.args)
        data = json.loads(self.manifest.read_text())
        data["restoration_pending"] = True
        self.manifest.write_text(json.dumps(data))
        first.write_text("user changes after interruption")
        with patch.object(installer, "run_pi") as run:
            with self.assertRaisesRegex(SystemExit, "restore conflict"):
                installer.uninstall(self.args)
            run.assert_not_called()
        self.assertEqual(first.read_text(), "user changes after interruption")
        self.assertTrue(self.manifest.exists())

    def test_pending_restore_retries_failed_package_removal(self):
        self.place("extensions/goal.ts")
        with patch.object(installer, "run_pi"):
            installer.install(self.args)
        with patch.object(installer, "run_pi", side_effect=subprocess.CalledProcessError(1, "pi")):
            with self.assertRaises(subprocess.CalledProcessError):
                installer.uninstall(self.args)
        with patch.object(installer, "settings_contains_source", return_value=True), patch.object(installer, "run_pi") as run:
            installer.uninstall(self.args)
            run.assert_called_once()
        self.assertFalse(self.manifest.exists())

    def test_directory_symlink_migration_and_restore_preserve_link_and_target(self):
        external = Path(self.temp.name) / "legacy-skill"
        shutil.copytree(REPO / "pi/skills/pi-extension-dev", external)
        link = self.home / "skills/pi-extension-dev"
        link.parent.mkdir(parents=True)
        # Relative links must retain their spelling despite backup/staging locations.
        relative_target = os.path.relpath(external, link.parent)
        link.symlink_to(relative_target, target_is_directory=True)
        original = (external / "SKILL.md").read_bytes()
        with patch.object(installer, "run_pi"):
            installer.install(self.args)
            self.assertFalse(link.is_symlink())
            self.assertEqual((external / "SKILL.md").read_bytes(), original)
            installer.uninstall(self.args)
        self.assertTrue(link.is_symlink())
        self.assertEqual(os.readlink(link), relative_target)
        self.assertEqual((link / "SKILL.md").read_bytes(), original)

    def test_modified_directory_symlink_is_not_migrated(self):
        external = Path(self.temp.name) / "legacy-skill"
        shutil.copytree(REPO / "pi/skills/pi-extension-dev", external)
        (external / "SKILL.md").write_text("user-customized skill")
        link = self.home / "skills/pi-extension-dev"
        link.parent.mkdir(parents=True)
        link.symlink_to(external, target_is_directory=True)
        with patch.object(installer, "run_pi") as run:
            with self.assertRaisesRegex(SystemExit, "unmanaged conflict"):
                installer.install(self.args)
            run.assert_not_called()
        self.assertTrue(link.is_symlink())
        self.assertEqual((link / "SKILL.md").read_text(), "user-customized skill")

    def test_partial_directory_restore_leaves_no_partial_target(self):
        source = Path(self.temp.name) / "backup-directory"
        source.mkdir()
        (source / "first").write_text("complete")
        target = self.home / "skills/test"
        def fail(source, staged):
            staged.mkdir()
            (staged / "first").write_text("partial")
            raise OSError("copy interrupted")
        with patch.object(installer, "copy_resource", side_effect=fail):
            with self.assertRaises(OSError):
                installer.restore_resource(source, target)
        self.assertFalse(target.exists())
        installer.restore_resource(source, target)
        self.assertTrue(installer.resources_match(source, target))

    def test_doctor_propagates_selected_home_to_every_child(self):
        with patch.dict(os.environ, {"PI_CODING_AGENT_DIR": "/ambient-home"}, clear=True):
            with patch.object(installer, "load_manifest", return_value={"version": 1, "source": str(REPO / "pi")}), patch.object(installer, "settings_contains_source", return_value=True), patch.object(installer.subprocess, "run", return_value=subprocess.CompletedProcess([], 0)) as run:
                self.assertEqual(installer.doctor(self.args), 0)
            self.assertEqual(len(run.call_args_list), 1)
            command = run.call_args.args[0]
            self.assertEqual(command[:4], ["node", "--experimental-strip-types", "--input-type=module", "-e"])
            for call in run.call_args_list:
                self.assertEqual(call.kwargs["env"]["PI_CODING_AGENT_DIR"], str(self.home.resolve()))
            self.assertEqual(os.environ["PI_CODING_AGENT_DIR"], "/ambient-home")

    def test_full_doctor_adds_developer_suites(self):
        commands = installer.doctor_commands(REPO, full=True)
        self.assertEqual(len(commands), 3)
        self.assertEqual(commands[0][:4], ["node", "--experimental-strip-types", "--input-type=module", "-e"])
        self.assertEqual(commands[1][:3], ["node", "--experimental-strip-types", "--test"])
        self.assertTrue(commands[2][1].endswith("manage-pi.test.py"))


if __name__ == "__main__":
    unittest.main()
