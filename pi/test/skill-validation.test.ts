import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const gate = resolve(import.meta.dirname, '../../tools/validate-skills.mjs');
test('required skill gate fails clearly for missing or unverified runtime instead of skipping', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-gate-'));
  try {
    const run = () => spawnSync(process.execPath, [gate], {
      env: { ...process.env, PI_SUBAGENTS_PACKAGE_ROOT: root }, encoding: 'utf8',
    });
    let result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /is missing.*Set PI_SUBAGENTS_PACKAGE_ROOT/s);
    assert.doesNotMatch(result.stdout, /checks passed/);
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'pi-subagents', version: '0.0.0' }));
    result = run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unverified runtime version/);
    assert.doesNotMatch(result.stdout, /checks passed/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
