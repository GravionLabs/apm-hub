import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(__dirname, '../../packages/github/.apm/skills/github-issue/scripts/Add-LedgerLine.ps1');
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

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

  it.each(['loop-308', '42', 'adhoc'])('accepts %s and appends the line', (issue) => {
    const r = run(issue, 'hello');
    expect(r.status).toBe(0);
    expect(fs.readFileSync(path.join(dir, '.agents', issue, 'progress.md'), 'utf8').trim()).toBe('hello');
  });

  it('creates .agents/loop-308/ without a line', () => {
    expect(run('loop-308').status).toBe(0);
    expect(fs.statSync(path.join(dir, '.agents', 'loop-308')).isDirectory()).toBe(true);
  });

  it.each(['loop-0', 'loop-x', 'loop-', 'loop-01', '../x', '0'])('rejects %s', (issue) => {
    const r = run(issue, 'x');
    expect(r.status).not.toBe(0);
    expect(fs.existsSync(path.join(dir, '.agents'))).toBe(false);
  });
});
