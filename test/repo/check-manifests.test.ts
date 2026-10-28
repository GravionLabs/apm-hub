import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

const script = path.resolve(__dirname, '../../scripts/check-manifests.mjs');
const packagesDir = path.resolve(__dirname, '../../packages');
const tmp: string[] = [];

function fixture(manifest: string, skills: string[]): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-manifests-'));
  tmp.push(root);
  const pkg = path.join(root, 'packages/demo');
  for (const s of skills) {
    fs.mkdirSync(path.join(pkg, '.apm/skills', s), { recursive: true });
    fs.writeFileSync(path.join(pkg, '.apm/skills', s, 'SKILL.md'), '---\nname: x\n---\n');
  }
  fs.writeFileSync(path.join(pkg, 'apm.yml'), manifest);
  return root;
}

function run(cwd: string, ...args: string[]) {
  return spawnSync('node', [script, ...args], { cwd, encoding: 'utf8' });
}

afterEach(() => {
  for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('check-manifests.mjs', () => {
  it('passes when x-skills matches the directories', () => {
    const root = fixture('name: demo\nx-skills:\n  - a\n  - b\n', ['a', 'b']);
    expect(run(root).status).toBe(0);
  });

  it('reports drift of x-skills and exits 1', () => {
    const root = fixture('name: demo\nx-skills:\n  - a\n  - gone\n', ['a', 'b']);
    const r = run(root);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('x-skills list drift');
    expect(r.stderr).toContain('missing: b');
    expect(r.stderr).toContain('stale:   gone');
  });

  it('--fix rewrites the x-skills list from disk', () => {
    const root = fixture('name: demo\nx-skills:\n  - gone\n', ['a', 'b']);
    expect(run(root, '--fix').status).toBe(0);
    expect(fs.readFileSync(path.join(root, 'packages/demo/apm.yml'), 'utf8')).toBe(
      'name: demo\nx-skills:\n  - a\n  - b\n',
    );
  });

  it('no longer treats a plain skills: list as the declaration', () => {
    const root = fixture('name: demo\nskills:\n  - a\n', ['a']);
    expect(run(root).status).toBe(1);
  });
});

describe('package manifests', () => {
  const manifests = fs
    .readdirSync(packagesDir)
    .map((d) => path.join(packagesDir, d, 'apm.yml'))
    .filter((f) => fs.existsSync(f));

  it.each(manifests)('%s has no top-level key apm 0.35 warns about', (file) => {
    const keys = fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .map((l) => l.match(/^([A-Za-z][\w-]*):/)?.[1])
      .filter(Boolean);
    expect(keys).not.toContain('skills');
    expect(keys).not.toContain('agents');
    expect(keys).not.toContain('registry');
  });
});
