# Pi Extension Verification

## Unit tests

Put pure helpers outside `extensions/`, then run:

```bash
node --test ~/.pi/agent/lib/*.test.ts
```

Follow red-green-refactor for behavior changes.

## Syntax

```bash
node --check ~/.pi/agent/extensions/extension.ts
node --check ~/.pi/agent/lib/helper.ts
```

## Isolated load smoke

```bash
pi -p -ne -e ~/.pi/agent/extensions/extension.ts "/namespace:command args"
```

Use `--session /tmp/fixed-session.jsonl` when testing per-session state across multiple processes. Use a test-specific state directory environment variable rather than deleting the real state directory.

## Full automatic-discovery smoke

```bash
pi -p "/namespace:status"
```

Check stderr for extension load errors and command conflict suffixes.

## Final checks

- Run every extension's unit tests.
- Run provider adapter tests against the exact production file.
- Verify no secret appears in logs/cache/error excerpts.
- Verify project/global extension loading does not duplicate commands.
