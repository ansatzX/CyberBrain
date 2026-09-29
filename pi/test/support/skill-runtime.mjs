import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// The contract specifies a stable minimum; compare numeric components, not strings.
export function meetsMinimumVersion(version, minimum) {
  const pattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  const actual = pattern.exec(version ?? '');
  const required = pattern.exec(minimum ?? '');
  if (!actual || !required || required[4]) return false;
  if (actual[4]?.split('.').some(part => /^0\d+$/.test(part))) return false;
  for (let i = 1; i <= 3; i++) {
    if (BigInt(actual[i]) !== BigInt(required[i])) return BigInt(actual[i]) > BigInt(required[i]);
  }
  return !actual[4];
}

export async function loadSkillRuntime() {
  const contract = JSON.parse(readFileSync(new URL('../skill-runtime.json', import.meta.url), 'utf8'));
  const root = resolve(process.env.PI_SUBAGENTS_PACKAGE_ROOT ?? join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), '.pi/agent'), 'npm/node_modules/pi-subagents'));
  let installed;
  try { installed = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')); }
  catch { throw new Error(`Required ${contract.package}@>=${contract.minimumVersion} is missing at ${root}. Set PI_SUBAGENTS_PACKAGE_ROOT to the package directory; see pi/test/evals/README.md. No checks were skipped.`); }
  assert.equal(installed.name, contract.package, 'Wrong runtime package');
  assert.ok(meetsMinimumVersion(installed.version, contract.minimumVersion), `Unsupported runtime version: required >=${contract.minimumVersion}, found ${installed.version}`);
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
  return { root, contract, installedVersion: installed.version, require, jiti: createJiti(import.meta.url, { fsCache: false }) };
}
