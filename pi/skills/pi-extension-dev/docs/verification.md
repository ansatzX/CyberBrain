# Pi Extension Verification

## Scope and runtime

Select package, project-local, or global delivery before testing. In CyberBrain,
test the actual `pi/extensions` entrypoint and keep helpers/tests in `pi/lib` and
`pi/test`; do not copy package code into a user home. Use the selected
`PI_CODING_AGENT_DIR` (default `~/.pi/agent`) only for authorized deployment checks.

Locate the active Pi installation's docs and examples. Confirm the Node runtime
supports TypeScript; older Node 22 needs `--experimental-strip-types`. Do not use
live provider imports as generic syntax checks: initialization can write files
or make network requests.

## Focused tests and syntax

Run relevant tests against production helpers using temporary state. From the
CyberBrain root with a compatible Node, for example:

```bash
node --test pi/test/goal-core.test.ts
node --check pi/extensions/goal.ts
```

For skill/example changes also run `node tools/validate-skills.mjs`. A missing
or mismatched toolchain is a failed gate, not permission to skip it or alter
declared versions without compatibility evidence.

## Isolated load and command smoke

Create unique temporary directories using `mktemp -d`: one for the agent home,
one for the working directory. Set `PI_CODING_AGENT_DIR` to that temporary home
and run from the temporary working directory to avoid ambient project discovery.
Use an absolute extension path, `--offline --no-session -ne -e <entrypoint.ts>`,
and explicitly control skills/prompts/context discovery as needed. Test only a
command whose handler is known not to launch inference or mutate real resources.
`--offline` does not sandbox arbitrary extension network activity, and `-ne`
does not suppress initialization of the explicitly loaded extension.

Test package-relative imports with the entrypoint in its real package location.
Use a unique session path inside the temporary directory when session persistence
is under test; never share a fixed `/tmp` filename between runs.
Verify observable handler results, not just absence of a parse error. UI-only
behavior needs an interactive/RPC test appropriate to that API.

## Authorized deployment acceptance

- Check package references, project trust, selected home and user overrides.
- Validate normal discovery separately from explicit `-e` loading; do not combine
  both for the same entrypoint. Check stderr and duplicate command suffixes.
- Verify actual commands/model selectors in a new process. If claiming reload
  support, separately test reload and retained session state.
- Preserve user auth, preferences, sessions and goals. Do not reset them to make
  tests pass. Never expose secrets in logs or reports.
- Report syntax, helper tests, discovery, UI behavior and unavailable checks
  separately; none substitutes for all the others.
