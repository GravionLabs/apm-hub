import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(
  __dirname,
  '../../packages/delivery/.apm/skills/review-fanout/scripts/Classify-Diff.ps1',
);
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

if (!hasPwsh && process.env.CI) throw new Error('pwsh is required in CI');

describe.skipIf(!hasPwsh)('Classify-Diff.ps1', () => {
  let dir: string;
  const git = (...args: string[]) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
  };
  const write = (rel: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  };
  const classify = (...extra: string[]) => {
    const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, ...extra], { cwd: dir, encoding: 'utf8' });
    expect(r.status).toBe(0);
    return JSON.parse(r.stdout);
  };
  const body = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n') + '\n';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'classify-'));
    git('init', '-q');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    git('config', 'commit.gpgsign', 'false');
    write('old/tool.ts', body);
    write('docs/guide.md', body);
    write('src/app.ts', body);
    write('src/app.test.ts', 'import { oldName } from "./app";\nexpect(oldName(1)).toBe(2);\n');
    git('add', '.');
    git('commit', '-qm', 'base');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('rename-only diff is mechanical with correctness and spec', () => {
    git('mv', 'old', 'new');
    git('add', '-A');
    const r = classify();
    expect(r.mode).toBe('mechanical');
    expect(r.dimensions).toEqual(['correctness', 'spec']);
  });

  it('rename plus code change is full', () => {
    git('mv', 'old', 'new');
    write('new/tool.ts', body.replace('line 3', 'changed'));
    git('add', '-A');
    const r = classify();
    expect(r.mode).toBe('full');
    expect(r.dimensions).toHaveLength(5);
  });

  it('small docs-only diff is mechanical', () => {
    write('docs/guide.md', body.replace('line 3', 'new name'));
    expect(classify().mode).toBe('mechanical');
  });

  it('docs diff above the threshold is full', () => {
    write('docs/guide.md', body.replace(/line/g, 'edit'));
    expect(classify().mode).toBe('full');
    expect(classify('-MaxLines', '100').mode).toBe('mechanical');
  });

  it('keeps security for mechanical changes touching auth paths', () => {
    git('mv', 'src/app.ts', 'src/auth.ts');
    const r = classify();
    expect(r.mode).toBe('mechanical');
    expect(r.dimensions).toContain('security');
  });

  it('test file with a rename-only line change is mechanical', () => {
    write('src/app.test.ts', 'import { newName } from "./app";\nexpect(newName(1)).toBe(2);\n');
    expect(classify().mode).toBe('mechanical');
  });

  it('test file with a small logic change is full', () => {
    write('src/app.test.ts', 'import { oldName } from "./app";\nexpect(oldName(1)).toBe(3);\n');
    const r = classify();
    expect(r.mode).toBe('full');
    expect(r.reason).toMatch(/test file/);
  });

  it('test file with added assertion or inconsistent rename is full', () => {
    write('src/app.test.ts', 'import { oldName } from "./app";\nexpect(oldName(1)).toBe(2);\nexpect(1).toBe(1);\n');
    expect(classify().mode).toBe('full');
    write('src/app.test.ts', 'import { newName } from "./app";\nexpect(other(1)).toBe(2);\n');
    expect(classify().mode).toBe('full');
  });

  it('-Force full overrides a mechanical diff', () => {
    write('docs/guide.md', body.replace('line 3', 'x'));
    const r = classify('-Force', 'full');
    expect(r.mode).toBe('full');
    expect(r.reason).toMatch(/forced/);
  });

  it('empty diff, bad range and binary files fail closed to full', () => {
    expect(classify().mode).toBe('full');
    expect(classify('-Range', 'nope..alsonope').mode).toBe('full');
    fs.writeFileSync(path.join(dir, 'docs/img.md'), Buffer.from([0, 1, 2, 0, 255]));
    git('add', '-A');
    expect(classify('-Range', 'HEAD').mode).toBe('full');
  });
});
