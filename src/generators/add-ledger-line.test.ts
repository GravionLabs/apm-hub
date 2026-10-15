import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(__dirname, '../../packages/github/.apm/skills/github-issue/scripts/Add-LedgerLine.ps1');
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

it('pwsh is installed in CI (the Add-LedgerLine cases must not be skipped there)', () => {
  if (process.env.CI) expect(hasPwsh).toBe(true);
});

describe.skipIf(!hasPwsh)('Add-LedgerLine.ps1 -Issue', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addledger-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const run = (issue: string, line?: string) =>
    spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-Issue', issue, ...(line === undefined ? [] : ['-Line', line])], {
      cwd: dir,
      encoding: 'utf8',
    });
  const ledger = (issue: string) => path.join(dir, '.agents', issue, 'progress.md');

  it.each(['loop-308', '42', 'adhoc'])('accepts %s and appends the line', (issue) => {
    const r = run(issue, 'hello');
    expect(r.status).toBe(0);
    expect(fs.readFileSync(ledger(issue), 'utf8').trim()).toBe('hello');
  });

  it('appends: two calls give two lines in order', () => {
    expect(run('loop-308', '# header').status).toBe(0);
    expect(run('loop-308', 'Loop: PBI #1 done — url').status).toBe(0);
    expect(fs.readFileSync(ledger('loop-308'), 'utf8')).toBe('# header\nLoop: PBI #1 done — url\n');
  });

  it('creates .agents/loop-308/ without a line', () => {
    expect(run('loop-308').status).toBe(0);
    expect(fs.statSync(path.join(dir, '.agents', 'loop-308')).isDirectory()).toBe(true);
  });

  it.each(['loop-0', 'loop-x', 'loop-', 'loop-01', '../x', '0', '12345678901', 'loop-12345678901'])('rejects %s', (issue) => {
    const r = run(issue, 'x');
    expect(r.status).not.toBe(0);
    expect(fs.existsSync(path.join(dir, '.agents'))).toBe(false);
  });

  it('refuses a symlinked progress.md', () => {
    const target = path.join(dir, 'target.md');
    fs.writeFileSync(target, 'secret\n');
    fs.mkdirSync(path.join(dir, '.agents', '42'), { recursive: true });
    fs.symlinkSync(target, ledger('42'));
    const r = run('42', 'x');
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/symlinked/);
    expect(fs.readFileSync(target, 'utf8')).toBe('secret\n');
  });
});
