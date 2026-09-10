import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export async function loadSkillRuntime() {
  const contract = JSON.parse(readFileSync(new URL('../skill-runtime.json', import.meta.url), 'utf8'));
  const root = resolve(process.env.PI_SUBAGENTS_PACKAGE_ROOT ?? join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), '.pi/agent'), 'npm/node_modules/pi-subagents'));
  let installed;
  try { installed = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')); }
  catch { throw new Error(`Required ${contract.package}@${contract.version} is missing at ${root}. Set PI_SUBAGENTS_PACKAGE_ROOT to the package directory; see pi/test/evals/README.md. No checks were skipped.`); }
  assert.equal(installed.name, contract.package, 'Wrong runtime package');
  assert.equal(installed.version, contract.version, 'Unverified runtime version: review the API and update skill-runtime.json deliberately');
  const require = createRequire(join(root, 'package.json'));
  for (const [name, version] of Object.entries(contract.dependencies)) {
    let directory = dirname(require.resolve(name));
    let metadata;
    for (;;) {
      try { metadata = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')); } catch {}
      if (metadata?.name === name) break;
      const parent = dirname(directory);
      if (parent === directory) throw new Error(`Cannot resolve dependency metadata for ${name}`);
      directory = parent;
    }
    assert.equal(metadata.version, version, `Unverified ${name} dependency`);
  }
  const { createJiti } = await import(pathToFileURL(require.resolve('jiti')).href);
  return { root, contract, require, jiti: createJiti(import.meta.url, { fsCache: false }) };
}
