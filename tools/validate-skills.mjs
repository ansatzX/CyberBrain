#!/usr/bin/env node
// Required skill gate: no model calls, package installation, or skipped runtime checks.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { loadSkillRuntime } from '../pi/test/support/skill-runtime.mjs';

const repo = resolve(import.meta.dirname, '..');
try {
  const { root, contract } = await loadSkillRuntime();
  console.log(`Checking ${contract.package}@${contract.version} at ${root}`);
  for (const args of [
    ['--test', 'pi/test/contracts/skill-contracts.test.ts', 'pi/test/contracts/skill-metadata.test.ts', 'pi/test/skill-round.test.ts', 'pi/test/skill-validation.test.ts'],
    ['tools/generate-agent-adapters.mjs', '--check'],
  ]) {
    const result = spawnSync(process.execPath, args, { cwd: repo, stdio: 'inherit', env: { ...process.env, PI_SUBAGENTS_PACKAGE_ROOT: root } });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  console.log('Automated skill checks passed. Trigger/decision evaluation is separate: pi/test/evals/README.md.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
