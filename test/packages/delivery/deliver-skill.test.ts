import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = path.resolve(__dirname, '../../../packages/delivery');
const skillDir = path.join(root, '.apm/skills/deliver');
const text = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
const roles = fs.readFileSync(path.join(skillDir, 'references/roles.md'), 'utf8');

describe('deliver SKILL.md', () => {
  it('is user-invoked only', () => {
    expect(text).toContain('disable-model-invocation: true');
    expect(text).toContain("opencode/autoinvoke: 'false'");
  });

  it('starts workflow.js by scriptPath in a project and inline elsewhere', () => {
    expect(text).toContain('scriptPath: <base>/workflow.js');
    expect(text).toContain('pass its text as `script`');
  });

  it('sends open questions to grill-me and restarts with answers', () => {
    expect(text).toContain('`status: questions`');
    expect(text).toContain('Load `grill-me`');
    expect(text).toContain('answers: {');
  });

  it('reports delivered, blocked and skipped PBIs', () => {
    for (const word of ['delivered', 'blocked', 'skipped']) expect(text).toContain(word);
  });

  it('names the allowlist precondition and the stable labels', () => {
    expect(text).toContain('project allowlist');
    for (const label of [
      'implement #<nr>',
      'gate #<nr>',
      'review #<nr>',
      'fix #<nr>',
      'pr #<nr>',
      'ci #<nr>',
    ]) {
      expect(text).toContain(label);
    }
  });

  it('is listed in the package manifest', () => {
    expect(fs.readFileSync(path.join(root, 'apm.yml'), 'utf8')).toContain('  - deliver');
  });

  it('documents the role defaults and the override key', () => {
    expect(roles).toContain('deliver.roles');
    expect(roles).toContain('`fast` haiku/low, `standard` sonnet/medium, `strong` opus/high');
  });
});

describe('config schema deliver key', () => {
  const schema = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../packages/shared/.apm/skills/implementation/schema/config.schema.json',
      ),
      'utf8',
    ),
  );
  const roleNames = Object.keys(schema.properties.deliver.properties.roles.properties);

  it('knows exactly the roles the workflow uses', () => {
    expect(roleNames.sort()).toEqual(
      ['ci', 'create', 'fix', 'gate', 'implement', 'plan', 'pr', 'review', 'select'].sort(),
    );
  });

  it('allows tiers only on implement and fix', () => {
    const tiered = roleNames.filter(
      (r) => schema.properties.deliver.properties.roles.properties[r].$ref === '#/$defs/tieredRole',
    );
    expect(tiered.sort()).toEqual(['fix', 'implement']);
  });
});
