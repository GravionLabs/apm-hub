import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PwshWorker } from '../../helpers/pwsh-worker';

const SCRIPT = path.resolve(
  __dirname,
  '../../../packages/shared/.apm/skills/implementation/scripts/Format-Changed.ps1'
);
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

describe.skipIf(!hasPwsh || process.platform === 'win32')('Format-Changed.ps1', () => {
  let worker: PwshWorker;
  let dir: string;
  let bin: string;
  beforeAll(() => {
    worker = new PwshWorker(SCRIPT);
  });
  afterAll(() => worker.close());
  beforeEach(() => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fmt-')));
    bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fmt-bin-'));
    git('init', '-q', '-b', 'main');
    write('base.ts', 'x');
    git('add', 'base.ts');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(bin, { recursive: true, force: true });
  });

  const git = (...a: string[]) => spawnSync('git', a, { cwd: dir });
  const write = (rel: string, c = '') => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), c);
  };
  // fake tool: appends its argv (one argument per line) to args.log in the cwd, exits with FAKE_EXIT or 0
  const fake = (name: string, body = '') =>
    fs.writeFileSync(
      path.join(bin, name),
      `#!/bin/sh\nfor a in "$@"; do echo "$a" >> args.log; done\n${body}\n`,
      { mode: 0o755 }
    );
  const go = (args: string[]) =>
    worker.run(args, { cwd: dir, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
  const logged = () =>
    fs.existsSync(path.join(dir, 'args.log'))
      ? fs.readFileSync(path.join(dir, 'args.log'), 'utf8').trim().split('\n')
      : [];

  it('skips when nothing changed', async () => {
    fake('fmt');
    const r = await go(['-Extensions', '.ts', '-Command', 'fmt {files}']);
    expect(r).toMatchObject({
      status: 0,
      stdout: expect.stringContaining('skipped: no changed files'),
    });
    expect(logged()).toEqual([]);
  });

  it('skips when only unsupported extensions changed', async () => {
    fake('fmt');
    write('notes.md', 'x');
    const r = await go(['-Extensions', '.ts,.tsx', '-Command', 'fmt {files}']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('skipped: no changed files');
    expect(logged()).toEqual([]);
  });

  it('skips with the tool name when the tool is missing', async () => {
    write('a.ts', 'x');
    const r = await go(['-Extensions', '.ts', '-Command', 'no-such-formatter --write {files}']);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('skipped: no-such-formatter not found');
  });

  it('passes only matching changed files, never a directory', async () => {
    fake('fmt');
    write('base.ts', 'changed'); // unstaged
    write('src/new.tsx', 'x'); // untracked
    write('src/readme.md', 'x'); // wrong extension
    write('staged.ts', 'x');
    git('add', 'staged.ts');
    const r = await go(['-Extensions', '.ts,.tsx', '-Command', 'fmt --write {files} --end']);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('formatted: 3 files');
    expect(logged().sort()).toEqual(['--end', '--write', 'base.ts', 'src/new.tsx', 'staged.ts']);
  });

  it('drops deleted files and reports checked with -Check', async () => {
    fake('fmt');
    fs.rmSync(path.join(dir, 'base.ts'));
    write('b.ts', 'x');
    const r = await go(['-Extensions', 'ts', '-Command', 'fmt {files}', '-Check']);
    expect(r.stdout.trim()).toBe('checked: 1 files');
    expect(logged()).toEqual(['b.ts']);
  });

  it('passes the failing exit code and stderr through', async () => {
    fake('fmt', 'echo broken >&2; exit 7');
    write('a.ts', 'x');
    const r = await go(['-Extensions', '.ts', '-Command', 'fmt {files}']);
    expect(r.status).toBe(7);
    expect(r.stderr).toContain('broken');
    expect(r.stdout).not.toContain('formatted');
  });

  it('-Base adds files committed since the ref; default ignores them', async () => {
    fake('fmt');
    git('checkout', '-qb', 'feat');
    write('c.ts', 'x');
    git('add', 'c.ts');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'c');
    write('d.ts', 'x'); // uncommitted
    const none = await go(['-Extensions', '.ts', '-Command', 'fmt {files}']);
    expect(none.stdout.trim()).toBe('formatted: 1 files');
    fs.rmSync(path.join(dir, 'args.log'));
    const r = await go(['-Extensions', '.ts', '-Command', 'fmt {files}', '-Base', 'main']);
    expect(r.stdout.trim()).toBe('formatted: 2 files');
    expect(logged().sort()).toEqual(['c.ts', 'd.ts']);
  });

  it('fails non-zero with the git error for an invalid -Base', async () => {
    fake('fmt');
    write('a.ts', 'x');
    const r = await go([
      '-Extensions',
      '.ts',
      '-Command',
      'fmt {files}',
      '-Base',
      'no-such-ref',
      '-Check',
    ]);
    expect(r.status).not.toBe(0);
    expect(r.stdout).not.toContain('skipped');
    expect(r.stderr).toMatch(/no-such-ref|unknown revision/);
    expect(logged()).toEqual([]);
  });

  it('keeps non-ASCII and spaced file names intact', async () => {
    fake('fmt');
    write('Größe über.ts', 'x');
    write('日本語.ts', 'x');
    const r = await go(['-Extensions', '.ts', '-Command', 'fmt {files}']);
    expect(r.stdout.trim()).toBe('formatted: 2 files');
    expect(logged().sort()).toEqual(['Größe über.ts', '日本語.ts']);
  });

  it('prefixes names that start with a dash', async () => {
    fake('fmt');
    write('-rf.ts', 'x');
    await go(['-Extensions', '.ts', '-Command', 'fmt {files}']);
    expect(logged()).toEqual(['./-rf.ts']);
  });

  it('appends the files when the command has no {files} placeholder', async () => {
    fake('fmt');
    write('a.ts', 'x');
    const r = await go(['-Extensions', '.ts', '-Command', 'fmt --fix']);
    expect(r.stdout.trim()).toBe('formatted: 1 files');
    expect(logged()).toEqual(['--fix', 'a.ts']);
  });

  it('works in a repository without a commit', async () => {
    fake('fmt');
    const fresh = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fmt-nohead-')));
    spawnSync('git', ['init', '-q'], { cwd: fresh });
    fs.writeFileSync(path.join(fresh, 'n.ts'), 'x');
    spawnSync('git', ['add', 'n.ts'], { cwd: fresh });
    fs.writeFileSync(path.join(fresh, 'u.ts'), 'x');
    const r = await worker.run(['-Extensions', '.ts', '-Command', 'fmt {files}'], {
      cwd: fresh,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    });
    const log = fs.readFileSync(path.join(fresh, 'args.log'), 'utf8').trim().split('\n').sort();
    fs.rmSync(fresh, { recursive: true, force: true });
    expect(r.stdout.trim()).toBe('formatted: 2 files');
    expect(log).toEqual(['n.ts', 'u.ts']);
  });

  it('skips outside a git repository', async () => {
    fake('fmt');
    const plain = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fmt-nogit-')));
    const r = await worker.run(['-Extensions', '.ts', '-Command', 'fmt {files}'], {
      cwd: plain,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        GIT_CEILING_DIRECTORIES: path.dirname(plain),
      },
    });
    fs.rmSync(plain, { recursive: true, force: true });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('skipped: not a git repository');
  });

  it('skips when the -Requires probe fails and runs when it passes', async () => {
    fake('fmt');
    fake('probe-bad', 'exit 3');
    fake('probe-ok');
    write('a.ts', 'x');
    const bad = await go([
      '-Extensions',
      '.ts',
      '-Command',
      'fmt {files}',
      '-Requires',
      'probe-bad --version',
    ]);
    expect(bad.status).toBe(0);
    expect(bad.stdout.trim()).toBe('skipped: probe-bad not configured');
    const ok = await go([
      '-Extensions',
      '.ts',
      '-Command',
      'fmt {files}',
      '-Requires',
      'probe-ok --version',
    ]);
    expect(ok.stdout.trim()).toBe('formatted: 1 files');
    expect(logged()).toContain('a.ts');
  });

  describe('.agents/format.json override', () => {
    const cfg = (o: unknown) => write('.agents/format.json', typeof o === 'string' ? o : JSON.stringify(o));

    it('wins over -Command for format and for -Check, with {files}', async () => {
      fake('jb');
      fake('dflt');
      write('A.cs', 'x');
      cfg({ dotnet: { extensions: ['.cs'], format: 'jb fmt {files}', check: 'jb chk {files}' } });
      const base = ['-Language', 'dotnet', '-Extensions', '.ts', '-Command', 'dflt {files}'];
      const f = await go(base);
      expect(f.stdout.trim()).toBe('formatted: 1 files');
      expect(logged()).toEqual(['fmt', 'A.cs']);
      fs.rmSync(path.join(dir, 'args.log'));
      const c = await go([...base, '-Check']);
      expect(c.stdout.trim()).toBe('checked: 1 files');
      expect(logged()).toEqual(['chk', 'A.cs']);
    });

    it('works without -Extensions/-Command and uses -Extensions when the entry has none', async () => {
      fake('jb');
      write('a.ts', 'x');
      cfg({ ts: { format: 'jb {files}' } });
      expect((await go(['-Language', 'ts'])).status).toBe(1);
      const r = await go(['-Language', 'ts', '-Extensions', '.ts']);
      expect(r.stdout.trim()).toBe('formatted: 1 files');
      expect(logged()).toEqual(['a.ts']);
    });

    it('errors naming the tool when the override tool is missing, default not run', async () => {
      fake('dflt');
      write('a.ts', 'x');
      cfg({ ts: { format: 'no-such-jb {files}' } });
      const r = await go(['-Language', 'ts', '-Extensions', '.ts', '-Command', 'dflt {files}']);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('no-such-jb');
      expect(r.stdout).not.toContain('skipped');
      expect(logged()).toEqual([]);
    });

    it('ignores an entry for an unrelated language', async () => {
      fake('dflt');
      write('a.ts', 'x');
      cfg({ py: { format: 'other {files}' } });
      const r = await go(['-Language', 'ts', '-Extensions', '.ts', '-Command', 'dflt {files}']);
      expect(r.stdout.trim()).toBe('formatted: 1 files');
      expect(logged()).toEqual(['a.ts']);
    });

    it('runs an array of commands in order and stops at the first failure', async () => {
      fake('one', 'echo one >> order.log');
      fake('two', 'echo two >> order.log');
      fake('bad', 'echo bad >> order.log; exit 5');
      write('a.ts', 'x');
      cfg({ ts: { format: ['one {files}', 'two {files}'], check: ['one {files}', 'bad', 'two'] } });
      const ok = await go(['-Language', 'ts', '-Extensions', '.ts']);
      expect(ok.status).toBe(0);
      expect(fs.readFileSync(path.join(dir, 'order.log'), 'utf8').trim().split('\n')).toEqual(['one', 'two']);
      fs.rmSync(path.join(dir, 'order.log'));
      const bad = await go(['-Language', 'ts', '-Extensions', '.ts', '-Check']);
      expect(bad.status).toBe(5);
      expect(fs.readFileSync(path.join(dir, 'order.log'), 'utf8').trim().split('\n')).toEqual(['one', 'bad']);
    });

    it('errors when the mode key is missing, naming file, language and key', async () => {
      fake('jb');
      write('a.ts', 'x');
      cfg({ ts: { format: 'jb {files}' } });
      const r = await go(['-Language', 'ts', '-Extensions', '.ts', '-Command', 'jb {files}', '-Check']);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/format\.json.*ts.*check/);
      expect(logged()).toEqual([]);
    });

    it('errors on invalid JSON naming the file', async () => {
      fake('dflt');
      write('a.ts', 'x');
      cfg('{ nope');
      const r = await go(['-Language', 'ts', '-Extensions', '.ts', '-Command', 'dflt {files}']);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('format.json');
    });

    it('is ignored without -Language', async () => {
      fake('dflt');
      write('a.ts', 'x');
      cfg('{ nope');
      const r = await go(['-Extensions', '.ts', '-Command', 'dflt {files}']);
      expect(r.status).toBe(0);
      expect(logged()).toEqual(['a.ts']);
    });

    it('requires -Command and -Extensions when no entry applies', async () => {
      write('a.ts', 'x');
      expect((await go(['-Extensions', '.ts'])).status).not.toBe(0);
      expect((await go(['-Command', 'x {files}'])).status).not.toBe(0);
    });
  });
});
