# cyberbrain-pi

Pi host adapter for the Cyberbrain personal agent configuration repository.
Shared skills are referenced from `plugins/*/skills`; Pi runtime code remains here.
See the [repository overview](../README.md) and [installation guide](../INSTALL.md).

## Local install

Run from the repository root with Pi and its dependencies available:

```bash
pi install npm:pi-subagents
pi install npm:pi-lens
bash tools/manage-pi.sh install
bash tools/manage-pi.sh doctor
```

For a custom configuration home, pass `--pi-home /absolute/path/to/agent` to the
installer and set the same `PI_CODING_AGENT_DIR` when running Pi. The installer
passes its selected home to Pi subprocesses and every doctor verification process. It backs up recognized legacy files
before migration and attempts rollback on a failed package install; retain the
reported backup paths if recovery fails. Directory symlinks for recognized legacy
skills are preserved as links; migration does not remove their target directories.

The installer does not manage credentials, sessions, goals, model preferences,
themes or thinking settings. Runtime extensions may maintain their own state,
including provider cache and `models.json` under the selected home.

To restore migrated resources, use `bash tools/manage-pi.sh uninstall --restore-legacy`.
If restoration is interrupted, rerun the same command: it skips resources already
restored exactly, avoids removing an already-unregistered package again, and keeps
rejecting user-edited targets. Whole resources are staged before being moved into
place; recovery records remain until restoration finishes.

## Skills and roles

- `agent-cluster` covers ownership, launch, supervision and acceptance. Its
  [workflow examples](skills/agent-cluster/SKILL.md#verified-launch-examples) are
  the same files used by runtime tests. The checked API uses `workflowScript`
  for dependent and parallel work, not legacy top-level `tasks` or `chain`.
- `pick-model` preserves user choices and configured role/default resolution.
  Parent-model inheritance is a fallback, not a guarantee. Provider capabilities
  and persistent-policy guidance are loaded from references only when needed.
- Shared Brain skills keep ordinary work lightweight. Shared Tachikoma skills
  distinguish a bounded one-call task from durable multi-round or resumable work.
- Role text is canonical in `plugins/awesome-agent-select/agent-profiles/`.
  Regenerate with `node tools/generate-agent-adapters.mjs`; never hand-edit
  `pi/subagents/awesome-agent-select/`. The package exposes these roles through
  `pi.subagents.agents`; reload Pi to discover updated `cyberbrain.<role>` agents.

A role name, fresh context or `reads` hint does not enforce read-only filesystem
access. Verify enabled tools and extension side effects before claiming that boundary.

## Development

Run commands from the repository root. Use Node with built-in TypeScript support
for the ordinary tests; these tests require no npm install:

```bash
node --test pi/test/*.test.ts
```

For installer and migration changes:

```bash
python3 pi/test/manage-pi.test.py
bash pi/test/manage-pi.test.sh
```

For skills, examples and their validation infrastructure:

```bash
node tools/validate-skills.mjs
```

The skill gate requires the exact tested runtime dependencies in
[test/skill-runtime.json](test/skill-runtime.json). It fails if they are unavailable
or mismatched; the ordinary suite does not replace it. See
[skill validation](test/evals/README.md) for dependency selection and independent
trigger/decision evaluation.

Keep pure helpers and tests outside `extensions/`. Use `lib/agent-paths.ts` for
runtime home paths and preserve unrelated user state when updating configuration.
Exercise installer/discovery changes in temporary configuration homes. Importing
live provider extensions is not a generic syntax check: startup can register
providers or refresh on-disk metadata.
