import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { meetsMinimumVersion } from './support/skill-runtime.mjs';

test('runtime minimum accepts equal and newer versions and rejects older or invalid versions', () => {
  for (const version of ['0.53.0', '0.53.1', '0.69.0', '0.100.0', '1.0.0', '0.53.0+build.1', '0.54.0-rc.1']) {
    assert.equal(meetsMinimumVersion(version, '0.53.0'), true, version);
  }
  for (const version of ['0.52.99', '0.9.0', '0.53.0-rc.1', '0.69.0-01', 'invalid', '0.53', '00.53.0', undefined]) {
    assert.equal(meetsMinimumVersion(version, '0.53.0'), false, String(version));
  }
});

const gate = resolve(import.meta.dirname, '../../tools/validate-skills.mjs');
test('required skill gate fails clearly for missing or too-old runtime instead of skipping', () => {
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
    assert.match(result.stderr, /Unsupported runtime version: required >=0\.53\.0, found 0\.0\.0/);
    assert.doesNotMatch(result.stdout, /checks passed/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
