import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(__dirname, '../../packages/github/.apm/skills/github-issue/scripts/Write-StatusTable.ps1');
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

it('pwsh is installed in CI (the Write-StatusTable cases must not be skipped there)', () => {
  if (process.env.CI) expect(hasPwsh).toBe(true);
});

describe.skipIf(!hasPwsh)('Write-StatusTable.ps1', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'statustable-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const table = '#12 merged First\n#13 pr-open #40 Second\nNext PBI: #14 Third\n';
  const run = (args: string[], input?: string) => spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, ...args], { cwd: dir, encoding: 'utf8', input });
  const target = (issue: string) => path.join(dir, '.agents', `status-${issue}.md`);
  const withFile = (content: string) => {
    const f = path.join(dir, 'in.md');
    fs.writeFileSync(f, content);
    return f;
  };

  it('writes the table from -Path and leaves no temp file', () => {
    const r = run(['-Issue', '248', '-Path', withFile(table)]);
    expect(r.status).toBe(0);
    expect(fs.readFileSync(target('248'), 'utf8')).toBe(table);
    expect(fs.readdirSync(path.join(dir, '.agents'))).toEqual(['status-248.md']);
  });

  it('writes the table from stdin', () => {
    expect(run(['-Issue', '7'], table).status).toBe(0);
    expect(fs.readFileSync(target('7'), 'utf8')).toBe(table);
  });

  it('overwrites an existing file instead of appending', () => {
    expect(run(['-Issue', '248', '-Path', withFile('old\n')]).status).toBe(0);
    expect(run(['-Issue', '248', '-Path', withFile('new\n')]).status).toBe(0);
    expect(fs.readFileSync(target('248'), 'utf8')).toBe('new\n');
    expect(fs.readdirSync(path.join(dir, '.agents'))).toEqual(['status-248.md']);
  });

  it.each(['0', '01', '../x', '-1', 'x', '5/..', '1;rm', '12345678901', '5\n'])('rejects -Issue %j', (issue) => {
    const r = run(['-Issue', issue, '-Path', withFile(table)]);
    expect(r.status).not.toBe(0);
    expect(fs.existsSync(path.join(dir, '.agents'))).toBe(false);
  });

  it('fails without prompting when -Issue is missing', () => {
    const r = run(['-Path', withFile(table)]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('Invalid -Issue');
  });

  it('fails on a missing -Path file and on empty stdin', () => {
    expect(run(['-Issue', '5', '-Path', path.join(dir, 'nope.md')]).status).not.toBe(0);
    expect(run(['-Issue', '5'], '').status).not.toBe(0);
    expect(fs.existsSync(target('5'))).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('refuses a symlinked .agents/', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));
    try {
      fs.symlinkSync(outside, path.join(dir, '.agents'));
      const r = run(['-Issue', '5', '-Path', withFile(table)]);
      expect(r.status).not.toBe(0);
      expect(r.stderr + r.stdout).toMatch(/symlinked/);
      expect(fs.readdirSync(outside)).toEqual([]);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === 'win32')('refuses a symlinked target and leaves the link target untouched', () => {
    const secret = path.join(dir, 'secret.md');
    fs.writeFileSync(secret, 'secret\n');
    fs.mkdirSync(path.join(dir, '.agents'));
    fs.symlinkSync(secret, target('5'));
    const r = run(['-Issue', '5', '-Path', withFile(table)]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/symlinked/);
    expect(fs.readFileSync(secret, 'utf8')).toBe('secret\n');
    expect(fs.readdirSync(path.join(dir, '.agents'))).toEqual(['status-5.md']);
  });

  it.skipIf(process.platform === 'win32')('refuses a dangling symlinked .agents/', () => {
    const missing = path.join(os.tmpdir(), `missing-${process.pid}-${Date.now()}`);
    fs.symlinkSync(missing, path.join(dir, '.agents'));
    const r = run(['-Issue', '5', '-Path', withFile(table)]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/symlinked/);
    expect(fs.existsSync(missing)).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('refuses a dangling symlinked target and does not create the link target', () => {
    const missing = path.join(dir, 'not-there.md');
    fs.mkdirSync(path.join(dir, '.agents'));
    fs.symlinkSync(missing, target('5'));
    const r = run(['-Issue', '5', '-Path', withFile(table)]);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/symlinked/);
    expect(fs.existsSync(missing)).toBe(false);
  });
});
