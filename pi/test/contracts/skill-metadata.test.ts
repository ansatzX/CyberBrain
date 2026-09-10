import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import test from 'node:test';
import { loadSkillRuntime } from '../support/skill-runtime.mjs';

const repo = resolve(import.meta.dirname, '../../..');
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
}
test('all skill frontmatters, UI metadata and local references are valid', async () => {
  const { require } = await loadSkillRuntime();
  const { parse } = require('yaml');
  const paths = [...files(join(repo, 'plugins')), ...files(join(repo, 'pi/skills'))];
  const skills = paths.filter(path => path.endsWith('/SKILL.md'));
  assert.ok(skills.length > 0);
  for (const path of skills) {
    const match = readFileSync(path, 'utf8').match(/^---\n([\s\S]*?)\n---/);
    assert.ok(match, `Missing frontmatter: ${path}`);
    const metadata = parse(match[1]);
    assert.equal(metadata.name, basename(dirname(path)), path);
    assert.match(metadata.name, /^[a-z0-9-]{1,64}$/, path);
    assert.ok(typeof metadata.description === 'string' && metadata.description.trim(), path);
    const ui = join(dirname(path), 'agents/openai.yaml');
    if (existsSync(ui)) {
      const data = parse(readFileSync(ui, 'utf8'));
      assert.ok(data.interface?.display_name && data.interface?.short_description, ui);
      assert.ok(data.interface.default_prompt?.includes(`$${metadata.name}`), ui);
    }
  }
  for (const path of paths.filter(path => path.endsWith('.md') && path.includes('/skills/'))) {
    for (const match of readFileSync(path, 'utf8').matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^(https?:|app:)/.test(target) || target.includes('<')) continue;
      assert.ok(existsSync(resolve(dirname(path), target)), `Broken local reference: ${path} -> ${target}`);
    }
  }
});
