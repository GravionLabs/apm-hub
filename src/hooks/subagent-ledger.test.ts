import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BRANCHES_BOUND, BRANCHES_UNBOUND, LOOP_LEDGERS_FOREIGN_BRANCH, LOOP_LEDGERS_LIVE, LOOP_LEDGERS_STALE, MARKERS_MALFORMED, gitCleanEnv } from './ledger-test-helpers';

const SCRIPT = path.resolve(__dirname, '../../packages/hooks/.apm/hooks/subagent-ledger.sh');

const cleanEnv = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => gitCleanEnv(process.env, extra);

describe('subagent-ledger hook', () => {
  let dir: string;
  let ledger: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const withLedger = () => {
    fs.mkdirSync(path.join(dir, '.agents', '7'), { recursive: true });
    ledger = path.join(dir, '.agents', '7', 'progress.md');
    fs.writeFileSync(ledger, '# ledger\n');
  };

  const run = (payload: unknown) =>
    spawnSync('bash', [SCRIPT], {
      input: typeof payload === 'string' ? payload : JSON.stringify(payload),
      encoding: 'utf8',
      env: cleanEnv({ AGENTS_LEDGER: '' }),
    });

  it('appends a line for a Claude payload', () => {
    withLedger();
    const r = run({ cwd: dir, agent_type: 'implementer', last_assistant_message: 'Status: DONE\nmore' });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent implementer: stopped — Status: DONE\n');
  });

  it('appends the same line format for a Copilot payload', () => {
    withLedger();
    const r = run({ cwd: dir, agentType: 'reviewer', response: 'APPROVE' });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent reviewer: stopped — APPROVE\n');
  });

  it('ignores a newer .agents/loop-<nr>/progress.md and writes to the newest PBI ledger', () => {
    withLedger();
    const loop = path.join(dir, '.agents', 'loop-7', 'progress.md');
    fs.mkdirSync(path.dirname(loop), { recursive: true });
    fs.writeFileSync(loop, '# loop\n');
    fs.utimesSync(ledger, new Date(2020, 1, 1), new Date(2020, 1, 1));
    const r = run({ cwd: dir, agent_type: 'issue-reader', last_assistant_message: 'ok' });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent issue-reader: stopped — ok\n');
    expect(fs.readFileSync(loop, 'utf8')).toBe('# loop\n');
  });

  it('writes nothing and exits 0 when only loop ledgers exist', () => {
    const loop = path.join(dir, '.agents', 'loop-7', 'progress.md');
    fs.mkdirSync(path.dirname(loop), { recursive: true });
    fs.writeFileSync(loop, '# loop\n');
    const r = run({ cwd: dir, agent_type: 'reviewer', response: 'APPROVE' });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(loop, 'utf8')).toBe('# loop\n');
  });

  it('treats a non-numeric loop-x directory as a PBI ledger', () => {
    const odd = path.join(dir, '.agents', 'loop-x', 'progress.md');
    fs.mkdirSync(path.dirname(odd), { recursive: true });
    fs.writeFileSync(odd, '# odd\n');
    run({ cwd: dir, agent_type: 'reviewer', response: 'APPROVE' });
    expect(fs.readFileSync(odd, 'utf8')).toBe('# odd\nSubagent reviewer: stopped — APPROVE\n');
  });

  it('honours an AGENTS_LEDGER override pointing at a loop ledger', () => {
    withLedger();
    const loop = path.join(dir, '.agents', 'loop-7', 'progress.md');
    fs.mkdirSync(path.dirname(loop), { recursive: true });
    fs.writeFileSync(loop, '# loop\n');
    const r = spawnSync('bash', [SCRIPT], {
      input: JSON.stringify({ cwd: dir, agent_type: 'reviewer', response: 'ok' }),
      encoding: 'utf8',
      env: { ...process.env, AGENTS_LEDGER: loop },
    });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(loop, 'utf8')).toBe('# loop\nSubagent reviewer: stopped — ok\n');
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\n');
  });

  it('does not write through a symlinked progress.md or a symlinked issue directory', () => {
    const target = path.join(dir, 'target.md');
    fs.writeFileSync(target, 'secret\n');
    fs.mkdirSync(path.join(dir, '.agents', '7'), { recursive: true });
    fs.symlinkSync(target, path.join(dir, '.agents', '7', 'progress.md'));
    expect(run({ cwd: dir, agent_type: 'reviewer', response: 'x' }).status).toBe(0);
    expect(fs.readFileSync(target, 'utf8')).toBe('secret\n');

    const outside = path.join(dir, 'outside');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'progress.md'), 'secret\n');
    fs.symlinkSync(outside, path.join(dir, '.agents', '8'));
    expect(run({ cwd: dir, agent_type: 'reviewer', response: 'x' }).status).toBe(0);
    expect(fs.readFileSync(path.join(outside, 'progress.md'), 'utf8')).toBe('secret\n');
  });

  it('does not write through a symlinked AGENTS_LEDGER', () => {
    const target = path.join(dir, 'target.md');
    fs.writeFileSync(target, 'secret\n');
    const link = path.join(dir, 'link.md');
    fs.symlinkSync(target, link);
    const r = spawnSync('bash', [SCRIPT], {
      input: JSON.stringify({ cwd: dir, agent_type: 'reviewer', response: 'x' }),
      encoding: 'utf8',
      env: { ...process.env, AGENTS_LEDGER: link },
    });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(target, 'utf8')).toBe('secret\n');
  });

  it('writes one line when the same payload fires twice', () => {
    withLedger();
    const payload = { cwd: dir, agent_type: 'implementer', last_assistant_message: 'Status: DONE' };
    run(payload);
    run(payload);
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent implementer: stopped — Status: DONE\n');
  });

  it('writes two lines for two different payloads', () => {
    withLedger();
    run({ cwd: dir, agent_type: 'implementer', last_assistant_message: 'one' });
    run({ cwd: dir, agent_type: 'implementer', last_assistant_message: 'two' });
    expect(fs.readFileSync(ledger, 'utf8')).toBe(
      '# ledger\nSubagent implementer: stopped — one\nSubagent implementer: stopped — two\n',
    );
  });

  it('accepts agentName and subagent_type as agent name', () => {
    withLedger();
    run({ cwd: dir, agentName: 'explorer', response: 'x' });
    run({ cwd: dir, subagent_type: 'planner', response: 'y' });
    const text = fs.readFileSync(ledger, 'utf8');
    expect(text).toContain('Subagent explorer: stopped — x\n');
    expect(text).toContain('Subagent planner: stopped — y\n');
  });

  it('falls back to defaults and cuts the summary to 120 chars', () => {
    withLedger();
    run({ cwd: dir, agent_type: 'reviewer' });
    run({ cwd: dir, agent_type: 'planner', response: 'a'.repeat(200) });
    const lines = fs.readFileSync(ledger, 'utf8').trim().split('\n');
    expect(lines[1]).toBe('Subagent reviewer: stopped');
    expect(lines[2]).toBe(`Subagent planner: stopped — ${'a'.repeat(120)}`);
  });

  it('uses the last text line of the agent transcript when the message is missing', () => {
    withLedger();
    const tp = path.join(dir, 't.jsonl');
    const entry = (role: string, text: string) =>
      JSON.stringify({ type: role, message: { role, content: [{ type: 'text', text }] } });
    fs.writeFileSync(tp, [entry('assistant', 'first'), entry('user', 'q'), entry('assistant', 'a\nStatus: DONE\n')].join('\n') + '\n');
    run({ cwd: dir, agent_type: 'implementer', last_assistant_message: '', agent_transcript_path: tp });
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent implementer: stopped — Status: DONE\n');
  });

  it('falls back to the newest report path when message and transcript are missing', () => {
    withLedger();
    fs.writeFileSync(path.join(dir, '.agents', '7', 'task-1-report.md'), 'x');
    run({ cwd: dir, agent_type: 'implementer', agent_transcript_path: path.join(dir, 'missing.jsonl') });
    expect(fs.readFileSync(ledger, 'utf8')).toBe(
      '# ledger\nSubagent implementer: stopped — report: .agents/7/task-1-report.md\n',
    );
  });

  it('does not use transcript_path (parent session transcript)', () => {
    withLedger();
    const tp = path.join(dir, 'parent.jsonl');
    fs.writeFileSync(tp, JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: 'parent line' } }) + '\n');
    run({ cwd: dir, agent_type: 'reviewer', transcript_path: tp });
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent reviewer: stopped\n');
  });

  it('keeps the last good transcript line when the final line is truncated', () => {
    withLedger();
    const tp = path.join(dir, 't.jsonl');
    const good = JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Status: DONE' }, 'str'] } });
    fs.writeFileSync(tp, ['"junk"', good, '{"type":"assistant","message":{"role":"assi'].join('\n'));
    run({ cwd: dir, agent_type: 'implementer', agent_transcript_path: tp });
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent implementer: stopped — Status: DONE\n');
  });

  it('does not use a report path for non-implementer agents', () => {
    withLedger();
    fs.writeFileSync(path.join(dir, '.agents', '7', 'task-1-report.md'), 'x');
    run({ cwd: dir, agent_type: 'reviewer' });
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent reviewer: stopped\n');
  });

  it('ignores a stale implementer report', () => {
    withLedger();
    const rp = path.join(dir, '.agents', '7', 'task-1-report.md');
    fs.writeFileSync(rp, 'x');
    const old = new Date(Date.now() - 3600_000);
    fs.utimesSync(rp, old, old);
    run({ cwd: dir, agent_type: 'implementer' });
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent implementer: stopped\n');
  });

  it('falls through without jq', () => {
    withLedger();
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
    for (const c of ['cat', 'sed', 'head', 'tail', 'cut', 'ls', 'dirname', 'tr', 'grep', 'find', 'sort', 'bash']) {
      const src = ['/usr/bin', '/bin'].map((d) => path.join(d, c)).find((f) => fs.existsSync(f));
      if (src) fs.symlinkSync(src, path.join(bin, c));
    }
    const r = spawnSync('bash', [SCRIPT], {
      input: JSON.stringify({ cwd: dir, agent_type: 'reviewer', agent_transcript_path: path.join(dir, 'x.jsonl') }),
      encoding: 'utf8',
      env: cleanEnv({ AGENTS_LEDGER: '', PATH: bin }),
    });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent reviewer: stopped\n');
  });

  it('never writes "no message"', () => {
    withLedger();
    run({ cwd: dir, agent_type: 'reviewer' });
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent reviewer: stopped\n');
  });

  it('drops orchestrator entries', () => {
    withLedger();
    const r = run({ cwd: dir, agent_type: 'orchestrator', last_assistant_message: 'done' });
    expect(r.status).toBe(0);
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\n');
  });

  it('drops namespaced and case-variant orchestrator entries', () => {
    withLedger();
    run({ cwd: dir, agent_type: 'agents:orchestrator', last_assistant_message: 'a' });
    run({ cwd: dir, agentType: 'Orchestrator', response: 'b' });
    run({ cwd: dir, agentName: 'ORCHESTRATOR', response: 'c' });
    run({ cwd: dir, subagent_type: 'orchestrator', response: 'd' });
    expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\n');
  });

  it('writes nothing and exits 0 without a ledger', () => {
    const r = run({ cwd: dir, agentType: 'reviewer', response: 'APPROVE' });
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(dir, '.agents'))).toBe(false);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  describe('agent allowlist and branch binding', () => {
    const git = (...args: string[]) =>
      spawnSync('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', env: cleanEnv() });
    const repo = (branch: string) => {
      for (const a of [['init', '-q'], ['checkout', '-q', '-b', branch], ['commit', '-q', '--allow-empty', '-m', 'init']]) {
        const r = git(...a);
        if (r.status !== 0) throw new Error(`git ${a.join(' ')} failed: ${r.stderr}`);
      }
      expect(git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim()).toBe(branch);
    };
    const stop = (type: string) => run({ cwd: dir, agent_type: type, last_assistant_message: 'ok' });
    const mk = (nr: string, mtime?: Date) => {
      const f = path.join(dir, '.agents', nr, 'progress.md');
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, `# ${nr}\n`);
      if (mtime) fs.utimesSync(f, mtime, mtime);
      return f;
    };
    const read = (f: string) => fs.readFileSync(f, 'utf8');

    it.each(['general-purpose', 'Explore', 'subagent', 'evil:general-purpose'])('writes nothing for foreign agent %s', (t) => {
      withLedger();
      const r = run({ cwd: dir, agent_type: t, last_assistant_message: 'x' });
      expect(r.status).toBe(0);
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\n');
    });

    it.each(['agents:implementer', 'agents/implementer', 'a:b:reviewer'])('writes for namespaced agent %s', (t) => {
      withLedger();
      run({ cwd: dir, agent_type: t, last_assistant_message: 'x' });
      expect(fs.readFileSync(ledger, 'utf8')).toBe(`# ledger\nSubagent ${t}: stopped — x\n`);
    });

    it.each(['issue-reader', 'explorer', 'planner', 'reviewer', 'review-lead', 'implementer', 'pr-writer', 'pbi-runner'])(
      'writes for %s',
      (t) => {
        withLedger();
        run({ cwd: dir, agent_type: t, last_assistant_message: 'x' });
        expect(fs.readFileSync(ledger, 'utf8')).toBe(`# ledger\nSubagent ${t}: stopped — x\n`);
      },
    );

    it('writes to the ledger of the branch issue although another ledger is newer', () => {
      repo('fix/7-x');
      const l7 = mk('7', new Date(2020, 1, 1));
      const l9 = mk('9');
      const r = run({ cwd: dir, agent_type: 'implementer', last_assistant_message: 'ok' });
      expect(r.status).toBe(0);
      expect(read(l7)).toBe('# 7\nSubagent implementer: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it('writes nothing when the branch issue has no ledger', () => {
      repo('feat/7-x');
      const l9 = mk('9');
      const r = run({ cwd: dir, agent_type: 'implementer', last_assistant_message: 'ok' });
      expect(r.status).toBe(0);
      expect(read(l9)).toBe('# 9\n');
    });

    it('falls back to the newest ledger on a branch without a number', () => {
      repo('main');
      const old = mk('7', new Date(2020, 1, 1));
      const nw = mk('9');
      run({ cwd: dir, agent_type: 'implementer', last_assistant_message: 'ok' });
      expect(read(nw)).toBe('# 9\nSubagent implementer: stopped — ok\n');
      expect(read(old)).toBe('# 7\n');
    });

    it('does not bind to loop-<nr> and keeps the loop ledger out of the fallback', () => {
      repo('main');
      const l7 = mk('7', new Date(2020, 1, 1));
      const loop = mk('loop-8');
      run({ cwd: dir, agent_type: 'reviewer', last_assistant_message: 'ok' });
      expect(read(loop)).toBe('# loop-8\n');
      expect(read(l7)).toBe('# 7\nSubagent reviewer: stopped — ok\n');
    });

    it.each(BRANCHES_BOUND)('binds branch %s to .agents/7', (b) => {
      repo(b);
      const l7 = mk('7', new Date(2020, 1, 1));
      const l9 = mk('9');
      stop('reviewer');
      expect(read(l7)).toBe('# 7\nSubagent reviewer: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it.each(BRANCHES_UNBOUND)('yields no number for branch %s and falls back to the newest ledger', (b) => {
      repo(b);
      const l7 = mk('7', new Date(2020, 1, 1));
      const l9 = mk('9');
      stop('reviewer');
      expect(read(l9)).toBe('# 9\nSubagent reviewer: stopped — ok\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it('without a .agents/current marker binds a stop to the ledger of the branch still checked out', () => {
      repo('fix/7-x'); // no loop binding: the branch rule applies although ledger 9 is newer
      const l7 = mk('7', new Date(2020, 1, 1));
      const l9 = mk('9');
      stop('issue-reader');
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it('does not write through a symlinked .agents/<nr> directory on the branch-bound path', () => {
      repo('fix/7-x');
      const real = path.join(dir, 'real');
      fs.mkdirSync(real);
      fs.writeFileSync(path.join(real, 'progress.md'), 'secret\n');
      fs.mkdirSync(path.join(dir, '.agents'));
      fs.symlinkSync(real, path.join(dir, '.agents', '7'));
      expect(stop('reviewer').status).toBe(0);
      expect(read(path.join(real, 'progress.md'))).toBe('secret\n');
    });

    it('does not write through a symlinked .agents directory', () => {
      repo('fix/7-x');
      const real = path.join(dir, 'real');
      fs.mkdirSync(path.join(real, '7'), { recursive: true });
      fs.writeFileSync(path.join(real, '7', 'progress.md'), 'secret\n');
      fs.symlinkSync(real, path.join(dir, '.agents'));
      expect(stop('reviewer').status).toBe(0);
      expect(read(path.join(real, '7', 'progress.md'))).toBe('secret\n');
    });

    it('falls back to the newest ledger when git is not on PATH', () => {
      repo('fix/7-x');
      const l7 = mk('7', new Date(2020, 1, 1));
      const l9 = mk('9');
      const bin = path.join(dir, 'bin');
      fs.mkdirSync(bin);
      for (const c of ['cat', 'sed', 'head', 'tail', 'cut', 'ls', 'dirname', 'tr', 'grep', 'find', 'sort', 'bash', 'cksum']) {
        const src = ['/usr/bin', '/bin'].map((d) => path.join(d, c)).find((f) => fs.existsSync(f));
        if (src) fs.symlinkSync(src, path.join(bin, c));
      }
      const r = spawnSync('bash', [SCRIPT], {
        input: JSON.stringify({ cwd: dir, agent_type: 'reviewer', last_assistant_message: 'ok' }),
        encoding: 'utf8',
        env: cleanEnv({ AGENTS_LEDGER: '', PATH: bin }),
      });
      expect(r.status).toBe(0);
      expect(read(l9)).toBe('# 9\nSubagent reviewer: stopped — ok\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it('writes a namespaced foreign prefix by the last name part (documented rule)', () => {
      withLedger();
      stop('evil:reviewer');
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent evil:reviewer: stopped — ok\n');
    });

    it('falls back to the newest ledger on a detached HEAD', () => {
      repo('fix/7-x');
      git('checkout', '-q', '--detach');
      const l7 = mk('7', new Date(2020, 1, 1));
      const l9 = mk('9');
      stop('reviewer');
      expect(read(l9)).toBe('# 9\nSubagent reviewer: stopped — ok\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it('falls back to the newest ledger outside a git repository', () => {
      const l7 = mk('7', new Date(2020, 1, 1));
      const l9 = mk('9');
      stop('reviewer');
      expect(read(l9)).toBe('# 9\nSubagent reviewer: stopped — ok\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it('writes nothing on fix/8-x when only the loop ledger .agents/loop-8 exists', () => {
      repo('fix/8-x');
      const loop = mk('loop-8');
      stop('reviewer');
      expect(read(loop)).toBe('# loop-8\n');
    });

    it('writes nothing for a payload without an agent field', () => {
      withLedger();
      const r = run({ cwd: dir, last_assistant_message: 'ok' });
      expect(r.status).toBe(0);
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\n');
    });

    it('cuts the agent name at 64 characters before the allowlist check', () => {
      withLedger();
      const fits = 'a'.repeat(55) + ':reviewer'; // 64 characters
      stop('a'.repeat(56) + ':reviewer'); // 65: cut to ":reviewe", not allowlisted
      stop(fits);
      expect(fs.readFileSync(ledger, 'utf8')).toBe(`# ledger\nSubagent ${fits}: stopped — ok\n`);
    });

    it.each(['agents.reviewer', 'a:b.explorer'])('accepts the "." namespace separator in %s', (t) => {
      withLedger();
      stop(t);
      expect(fs.readFileSync(ledger, 'utf8')).toBe(`# ledger\nSubagent ${t}: stopped — ok\n`);
    });

    /** Repo config whose fsmonitor command and hooks would create a marker file; checked live with `git status`. */
    const hostileConfig = () => {
      const marker = path.join(dir, 'MARKER');
      const hooks = path.join(dir, 'evil-hooks');
      fs.mkdirSync(hooks);
      for (const h of ['post-checkout', 'pre-commit', 'reference-transaction', 'post-index-change']) {
        fs.writeFileSync(path.join(hooks, h), `#!/bin/sh\ntouch '${marker}'\n`, { mode: 0o755 });
      }
      expect(git('config', 'core.fsmonitor', `touch '${marker}'; echo`).status).toBe(0);
      expect(git('config', 'core.hooksPath', hooks).status).toBe(0);
      git('status'); // positive control: this config does run the command
      expect(fs.existsSync(marker)).toBe(true);
      fs.rmSync(marker);
      return marker;
    };

    it('does not run a repository fsmonitor command or hooks and still binds to the branch issue', () => {
      repo('fix/7-x');
      const l7 = mk('7', new Date(2020, 1, 1));
      const l9 = mk('9');
      const marker = hostileConfig();
      expect(stop('reviewer').status).toBe(0);
      expect(fs.existsSync(marker)).toBe(false);
      expect(read(l7)).toBe('# 7\nSubagent reviewer: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    /** Runs the hook with a `git` on PATH that runs the given shell body (default: fail with exit 128). */
    const runWithBrokenGit = (cwd: string, script = 'exit 128') => {
      const bin = path.join(dir, 'broken-bin');
      fs.mkdirSync(bin, { recursive: true });
      fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
      return spawnSync('bash', [SCRIPT], {
        input: JSON.stringify({ cwd, agent_type: 'reviewer', last_assistant_message: 'ok' }),
        encoding: 'utf8',
        env: cleanEnv({ AGENTS_LEDGER: '', PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` }),
      });
    };

    it('writes nothing when git fails inside a repository (no newest-ledger fallback)', () => {
      repo('fix/7-x');
      const l7 = mk('7', new Date(2020, 1, 1));
      const l9 = mk('9');
      const r = runWithBrokenGit(dir);
      expect(r.status).toBe(0);
      expect(read(l7)).toBe('# 7\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it('writes nothing when git fails in a subdirectory of a repository', () => {
      repo('main');
      const sub = path.join(dir, 'pkg');
      const l3 = path.join(sub, '.agents', '3', 'progress.md');
      fs.mkdirSync(path.dirname(l3), { recursive: true });
      fs.writeFileSync(l3, '# 3\n');
      expect(runWithBrokenGit(sub).status).toBe(0);
      expect(read(l3)).toBe('# 3\n');
    });

    it('writes nothing when real git cannot read the repository (corrupt HEAD)', () => {
      repo('fix/7-x');
      const l9 = mk('9');
      fs.writeFileSync(path.join(dir, '.git', 'HEAD'), 'garbage\n');
      expect(stop('reviewer').status).toBe(0);
      expect(read(l9)).toBe('# 9\n');
    });

    it('still falls back to the newest ledger outside a repository when git fails', () => {
      const l7 = mk('7', new Date(2020, 1, 1));
      const l9 = mk('9');
      expect(runWithBrokenGit(dir).status).toBe(0);
      expect(read(l9)).toBe('# 9\nSubagent reviewer: stopped — ok\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it('passes -c core.fsmonitor=false -c core.hooksPath=/dev/null to git', () => {
      repo('fix/7-x');
      const l7 = mk('7');
      const realGit = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8', env: cleanEnv() }).stdout.trim();
      const bin = path.join(dir, 'shim');
      const log = path.join(dir, 'git-args.log');
      fs.mkdirSync(bin);
      fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh\nprintf '%s ' "$@" >> '${log}'\nexec '${realGit}' "$@"\n`, { mode: 0o755 });
      const r = spawnSync('bash', [SCRIPT], {
        input: JSON.stringify({ cwd: dir, agent_type: 'reviewer', last_assistant_message: 'ok' }),
        encoding: 'utf8',
        env: cleanEnv({ AGENTS_LEDGER: '', PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` }),
      });
      expect(r.status).toBe(0);
      expect(fs.readFileSync(log, 'utf8')).toContain('-c core.fsmonitor=false -c core.hooksPath=/dev/null rev-parse');
      expect(read(l7)).toBe('# 7\nSubagent reviewer: stopped — ok\n');
    });

    it('resolves .agents under the payload cwd: a stop from a repo subdirectory does not reach the root ledger', () => {
      repo('fix/7-x');
      const l7 = mk('7');
      const sub = path.join(dir, 'src', 'deep');
      fs.mkdirSync(sub, { recursive: true });
      const r = run({ cwd: sub, agent_type: 'reviewer', last_assistant_message: 'ok' });
      expect(r.status).toBe(0);
      expect(read(l7)).toBe('# 7\n');
      expect(fs.existsSync(path.join(sub, '.agents'))).toBe(false);
    });

    it('binds a subdirectory cwd to the branch issue ledger under that subdirectory', () => {
      repo('fix/7-x');
      const l7 = mk('7');
      const sub = path.join(dir, 'pkg');
      const own = path.join(sub, '.agents', '7', 'progress.md');
      const newer = path.join(sub, '.agents', '9', 'progress.md');
      for (const f of [own, newer]) {
        fs.mkdirSync(path.dirname(f), { recursive: true });
        fs.writeFileSync(f, '# sub\n');
      }
      fs.utimesSync(own, new Date(2020, 1, 1), new Date(2020, 1, 1));
      run({ cwd: sub, agent_type: 'reviewer', last_assistant_message: 'ok' });
      expect(read(own)).toBe('# sub\nSubagent reviewer: stopped — ok\n');
      expect(read(newer)).toBe('# sub\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it('lets AGENTS_LEDGER win over the branch binding', () => {
      repo('fix/7-x');
      mk('7');
      const l9 = mk('9');
      spawnSync('bash', [SCRIPT], {
        input: JSON.stringify({ cwd: dir, agent_type: 'reviewer', response: 'ok' }),
        encoding: 'utf8',
        env: cleanEnv({ AGENTS_LEDGER: l9 }),
      });
      expect(read(l9)).toBe('# 9\nSubagent reviewer: stopped — ok\n');
    });
  });

  describe('loop marker .agents/current (#375)', () => {
    const git = (...args: string[]) =>
      spawnSync('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', env: cleanEnv() });
    const repo = (branch: string) => {
      for (const a of [['init', '-q'], ['checkout', '-q', '-b', branch], ['commit', '-q', '--allow-empty', '-m', 'init']]) {
        const r = git(...a);
        if (r.status !== 0) throw new Error(`git ${a.join(' ')} failed: ${r.stderr}`);
      }
    };
    const mk = (nr: string, content = `# ${nr}\n`, mtime?: Date) => {
      const f = path.join(dir, '.agents', nr, 'progress.md');
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, content);
      if (mtime) fs.utimesSync(f, mtime, mtime);
      return f;
    };
    const read = (f: string) => fs.readFileSync(f, 'utf8');
    const marker = (content = '9 loop-5\n') => fs.writeFileSync(path.join(dir, '.agents', 'current'), content);
    const stop = (type = 'issue-reader', env: Record<string, string> = { AGENTS_LEDGER: '' }) =>
      spawnSync('bash', [SCRIPT], {
        input: JSON.stringify({ cwd: dir, agent_type: type, last_assistant_message: 'ok' }),
        encoding: 'utf8',
        env: cleanEnv(env),
      });
    const OLD = new Date(2020, 1, 1);
    const LOOP = '# loop\nLoop: PBI #7 started\nLoop: PBI #7 done — https://x/pr/7\nLoop: PBI #9 started\n';
    /** Previous PBI 7 checked out, next PBI 9 bound by the loop 5 (the #375 scenario). */
    const scenario = (loop = LOOP) => {
      repo('fix/7-x');
      const l7 = mk('7');
      const l9 = mk('9', '# 9\n', OLD);
      const lp = mk('loop-5', loop);
      return { l7, l9, lp };
    };

    it('sends a stop before the new PBI branch exists to the bound PBI, not the branch still checked out', () => {
      const { l7, l9, lp } = scenario();
      marker();
      expect(stop().status).toBe(0);
      expect(read(l9)).toBe('# 9\nSubagent issue-reader: stopped — ok\n');
      expect(read(l7)).toBe('# 7\n');
      expect(read(lp)).toBe(LOOP);
    });

    it('accepts a marker without a trailing newline', () => {
      const { l7, l9 } = scenario();
      marker('9 loop-5');
      stop();
      expect(read(l9)).toBe('# 9\nSubagent issue-reader: stopped — ok\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it('wins over the newest-ledger fallback on the integration branch', () => {
      repo('release/next');
      const l9 = mk('9', '# 9\n', OLD);
      const l7 = mk('7');
      mk('loop-5', LOOP);
      marker();
      stop();
      expect(read(l9)).toBe('# 9\nSubagent issue-reader: stopped — ok\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it('wins outside a git repository too', () => {
      const l9 = mk('9', '# 9\n', OLD);
      const l7 = mk('7');
      mk('loop-5', LOOP);
      marker();
      stop();
      expect(read(l9)).toBe('# 9\nSubagent issue-reader: stopped — ok\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it('loses against AGENTS_LEDGER', () => {
      const { l7, l9 } = scenario();
      const other = mk('3');
      marker();
      stop('reviewer', { AGENTS_LEDGER: other });
      expect(read(other)).toBe('# 3\nSubagent reviewer: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it.each(MARKERS_MALFORMED.map((m) => [JSON.stringify(m), m]))('ignores the malformed marker %s and binds to the branch', (_, m) => {
      const { l7, l9 } = scenario();
      marker(m);
      expect(stop().status).toBe(0);
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it('ignores a symlinked marker', () => {
      const { l7, l9 } = scenario();
      const real = path.join(dir, 'real-current');
      fs.writeFileSync(real, '9 loop-5\n');
      fs.symlinkSync(real, path.join(dir, '.agents', 'current'));
      stop();
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it('ignores a marker that is a directory', () => {
      const { l7 } = scenario();
      fs.mkdirSync(path.join(dir, '.agents', 'current'));
      stop();
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
    });

    it('ignores a marker whose PBI ledger does not exist and creates none', () => {
      repo('fix/7-x');
      const l7 = mk('7');
      mk('loop-5', LOOP);
      marker();
      stop();
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
      expect(fs.existsSync(path.join(dir, '.agents', '9'))).toBe(false);
    });

    it('ignores a marker whose loop ledger does not exist', () => {
      repo('fix/7-x');
      const l7 = mk('7');
      const l9 = mk('9', '# 9\n', OLD);
      marker();
      stop();
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it.each(LOOP_LEDGERS_STALE.map((l) => [JSON.stringify(l), l]))('ignores a stale marker when the loop ledger is %s', (_, l) => {
      const { l7, l9, lp } = scenario(l);
      marker();
      stop();
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
      expect(read(lp)).toBe(l);
    });

    it.each(LOOP_LEDGERS_LIVE.map((l) => [JSON.stringify(l), l]))('honours the marker while the loop ledger is %s', (_, l) => {
      const { l7, l9 } = scenario(l);
      marker();
      stop();
      expect(read(l9)).toBe('# 9\nSubagent issue-reader: stopped — ok\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it('ignores a marker whose loop ledger is a symlink', () => {
      repo('fix/7-x');
      const l7 = mk('7');
      const l9 = mk('9', '# 9\n', OLD);
      const real = path.join(dir, 'real-loop.md');
      fs.writeFileSync(real, LOOP);
      fs.mkdirSync(path.join(dir, '.agents', 'loop-5'));
      fs.symlinkSync(real, path.join(dir, '.agents', 'loop-5', 'progress.md'));
      marker();
      stop();
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it('does not write through a symlinked bound PBI directory and falls back to the branch', () => {
      repo('fix/7-x');
      const l7 = mk('7');
      mk('loop-5', LOOP);
      const real = path.join(dir, 'real');
      fs.mkdirSync(real);
      fs.writeFileSync(path.join(real, 'progress.md'), 'secret\n');
      fs.symlinkSync(real, path.join(dir, '.agents', '9'));
      marker();
      stop();
      expect(read(path.join(real, 'progress.md'))).toBe('secret\n');
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
    });

    it.each(LOOP_LEDGERS_FOREIGN_BRANCH.map((l) => [JSON.stringify(l), l]))('ignores the marker on a branch whose issue the loop has not finished: %s', (_, l) => {
      const { l7, l9 } = scenario(l);
      marker();
      stop();
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it('does not let the stale marker of a killed loop capture a later run on another issue branch', () => {
      repo('fix/12-other');
      const l12 = mk('12');
      const l9 = mk('9', '# 9\n', OLD);
      mk('loop-5', LOOP); // killed: no `Loop: stopped`, no -Unbind
      marker();
      stop();
      expect(read(l12)).toBe('# 12\nSubagent issue-reader: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it('honours the marker on the bound PBI branch itself', () => {
      repo('feat/9-next');
      const l9 = mk('9', '# 9\n', OLD);
      mk('7');
      mk('loop-5', '# loop\nLoop: PBI #9 started\n');
      marker();
      stop();
      expect(read(l9)).toBe('# 9\nSubagent issue-reader: stopped — ok\n');
    });

    it('honours the marker on a detached HEAD', () => {
      repo('fix/7-x');
      git('checkout', '-q', '--detach');
      const l9 = mk('9', '# 9\n', OLD);
      const l7 = mk('7');
      mk('loop-5', '# loop\nLoop: PBI #9 started\n');
      marker();
      stop();
      expect(read(l9)).toBe('# 9\nSubagent issue-reader: stopped — ok\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it('ignores a marker whose loop directory is a symlink', () => {
      repo('fix/7-x');
      const l7 = mk('7');
      const l9 = mk('9', '# 9\n', OLD);
      const real = path.join(dir, 'real-loop');
      fs.mkdirSync(real);
      fs.writeFileSync(path.join(real, 'progress.md'), LOOP);
      fs.symlinkSync(real, path.join(dir, '.agents', 'loop-5'));
      marker();
      stop();
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
      expect(read(path.join(real, 'progress.md'))).toBe(LOOP);
    });

    it('does not write through a symlinked bound PBI progress.md and falls back to the branch', () => {
      repo('fix/7-x');
      const l7 = mk('7');
      mk('loop-5', LOOP);
      const target = path.join(dir, 'target.md');
      fs.writeFileSync(target, 'secret\n');
      fs.mkdirSync(path.join(dir, '.agents', '9'));
      fs.symlinkSync(target, path.join(dir, '.agents', '9', 'progress.md'));
      marker();
      stop();
      expect(read(target)).toBe('secret\n');
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
    });

    it('writes nothing through a symlinked .agents even with a valid marker', () => {
      repo('fix/7-x');
      const real = path.join(dir, 'real');
      for (const [f, c] of [['7/progress.md', '# 7\n'], ['9/progress.md', '# 9\n'], ['loop-5/progress.md', LOOP], ['current', '9 loop-5\n']]) {
        fs.mkdirSync(path.dirname(path.join(real, f)), { recursive: true });
        fs.writeFileSync(path.join(real, f), c);
      }
      fs.symlinkSync(real, path.join(dir, '.agents'));
      expect(stop().status).toBe(0);
      expect(read(path.join(real, '9', 'progress.md'))).toBe('# 9\n');
      expect(read(path.join(real, '7', 'progress.md'))).toBe('# 7\n');
      expect(read(path.join(real, 'loop-5', 'progress.md'))).toBe(LOOP);
    });

    it('dedupes a repeated stop per agent_id with the sidecar next to the bound ledger', () => {
      const { l7, l9 } = scenario();
      marker();
      const payload = JSON.stringify({ cwd: dir, agent_type: 'reviewer', agent_id: 'a1b2', last_assistant_message: 'APPROVE' });
      const fire = () => spawnSync('bash', [SCRIPT], { input: payload, encoding: 'utf8', env: cleanEnv({ AGENTS_LEDGER: '' }) });
      expect(fire().status).toBe(0);
      expect(fire().status).toBe(0);
      expect(read(l9)).toBe('# 9\nSubagent reviewer: stopped — APPROVE\n');
      expect(read(l7)).toBe('# 7\n');
      expect(fs.existsSync(path.join(dir, '.agents', '9', '.ledger-seen'))).toBe(true);
      expect(fs.existsSync(path.join(dir, '.agents', '7', '.ledger-seen'))).toBe(false);
    });

    it('writes nothing with a live marker when real git cannot read the repository (corrupt HEAD)', () => {
      const { l7, l9, lp } = scenario();
      marker();
      fs.writeFileSync(path.join(dir, '.git', 'HEAD'), 'garbage\n');
      stop();
      expect(read(l9)).toBe('# 9\n');
      expect(read(l7)).toBe('# 7\n');
      expect(read(lp)).toBe(LOOP);
    });

    it('writes nothing with a live marker when git fails inside a repository', () => {
      const { l7, l9 } = scenario();
      marker();
      const bin = path.join(dir, 'broken-bin');
      fs.mkdirSync(bin, { recursive: true });
      fs.writeFileSync(path.join(bin, 'git'), '#!/bin/sh\nexit 128\n', { mode: 0o755 });
      expect(stop('issue-reader', { AGENTS_LEDGER: '', PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}` }).status).toBe(0);
      expect(read(l9)).toBe('# 9\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it.each(BRANCHES_UNBOUND)('honours a live marker on the branch %s without an issue number', (b) => {
      repo(b);
      const l9 = mk('9', '# 9\n', OLD);
      const l7 = mk('7');
      mk('loop-5', '# loop\nLoop: PBI #9 started\n');
      marker();
      stop();
      expect(read(l9)).toBe('# 9\nSubagent issue-reader: stopped — ok\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it('honours the marker on the branch recorded at -Bind (first PBI bound from an unrelated issue branch)', () => {
      repo('fix/12-x');
      const l12 = mk('12');
      const l9 = mk('9', '# 9\n', OLD);
      mk('loop-5', '# loop\nLoop: PBI #9 started\n');
      marker('9 loop-5 12\n');
      stop();
      expect(read(l9)).toBe('# 9\nSubagent issue-reader: stopped — ok\n');
      expect(read(l12)).toBe('# 12\n');
    });

    it('still treats another issue branch as foreign when the marker recorded a different one', () => {
      repo('fix/13-x');
      const l13 = mk('13');
      const l9 = mk('9', '# 9\n', OLD);
      mk('loop-5', '# loop\nLoop: PBI #9 started\n');
      marker('9 loop-5 12\n');
      stop();
      expect(read(l13)).toBe('# 13\nSubagent issue-reader: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it('ignores the recorded-branch marker of a stopped loop: the line lands in the origin ledger', () => {
      repo('fix/12-x');
      const l12 = mk('12');
      const l9 = mk('9', '# 9\n', OLD);
      mk('loop-5', '# loop\nLoop: PBI #9 started\nLoop: stopped — user stop\n');
      marker('9 loop-5 12\n');
      stop();
      expect(read(l12)).toBe('# 12\nSubagent issue-reader: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it('does not create the missing PBI ledger of a recorded-branch marker', () => {
      repo('fix/12-x');
      const l12 = mk('12');
      mk('loop-5', '# loop\nLoop: PBI #9 started\n');
      marker('9 loop-5 12\n');
      stop();
      expect(fs.existsSync(path.join(dir, '.agents', '9'))).toBe(false);
      expect(read(l12)).toBe('# 12\nSubagent issue-reader: stopped — ok\n');
    });

    it('accepts the recorded-branch marker without a trailing newline', () => {
      repo('fix/12-x');
      mk('12');
      const l9 = mk('9', '# 9\n', OLD);
      mk('loop-5', '# loop\nLoop: PBI #9 started\n');
      marker('9 loop-5 12');
      stop();
      expect(read(l9)).toBe('# 9\nSubagent issue-reader: stopped — ok\n');
    });

    it.each(['general-purpose', 'Explore', 'subagent'])('writes nothing for the foreign agent %s with a valid marker', (t) => {
      const { l7, l9, lp } = scenario();
      marker();
      expect(stop(t).status).toBe(0);
      expect(read(l9)).toBe('# 9\n');
      expect(read(l7)).toBe('# 7\n');
      expect(read(lp)).toBe(LOOP);
    });
  });

  describe('pbi-runner and nested stops', () => {
    const runner = (reply: unknown, extra: object = {}) => ({
      cwd: dir,
      agent_type: 'pbi-runner',
      agent_id: 'r1',
      last_assistant_message: typeof reply === 'string' ? reply : JSON.stringify(reply),
      ...extra,
    });

    it('summarises a GATE reply with its phase', () => {
      withLedger();
      run(runner({ status: 'GATE', pbi: 7, phase: 'plan', question: 'Proceed?', options: ['yes', 'no'] }));
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent pbi-runner: stopped — GATE plan\n');
    });

    it('summarises a DONE reply with the PR url, also pretty-printed in a code fence', () => {
      withLedger();
      const json = JSON.stringify({ status: 'DONE', pbi: 7, pr: 'https://x/pull/9', summary: 'a\nb' }, null, 2);
      run(runner('```json\n' + json + '\n```'));
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent pbi-runner: stopped — DONE https://x/pull/9\n');
    });

    it('summarises BLOCKED and FAILED by status only', () => {
      withLedger();
      run(runner({ status: 'BLOCKED', pbi: 7, pr: null, summary: 's' }, { agent_id: 'r2' }));
      run(runner({ status: 'FAILED', pbi: 7, pr: null, summary: 's' }, { agent_id: 'r3' }));
      expect(fs.readFileSync(ledger, 'utf8')).toBe(
        '# ledger\nSubagent pbi-runner: stopped — BLOCKED\nSubagent pbi-runner: stopped — FAILED\n',
      );
    });

    it('writes a depth-2 implementer stop into the PBI ledger, not a newer loop ledger', () => {
      withLedger();
      fs.mkdirSync(path.join(dir, '.agents', 'loop-300'), { recursive: true });
      const loop = path.join(dir, '.agents', 'loop-300', 'progress.md');
      fs.writeFileSync(loop, '# loop\n');
      run({ cwd: dir, agent_type: 'implementer', agent_id: 'i1', last_assistant_message: 'Status: DONE' });
      run(runner({ status: 'DONE', pbi: 7, pr: 'https://x/pull/9' }));
      expect(fs.readFileSync(loop, 'utf8')).toBe('# loop\n');
      expect(fs.readFileSync(ledger, 'utf8')).toBe(
        '# ledger\nSubagent implementer: stopped — Status: DONE\nSubagent pbi-runner: stopped — DONE https://x/pull/9\n',
      );
    });

    it('records a resumed runner (same agent_id) once per distinct outcome', () => {
      withLedger();
      run(runner({ status: 'GATE', phase: 'plan' }));
      run(runner({ status: 'DONE', pr: 'https://x/pull/9' }));
      // an interleaved child line and a repeated resume stop must not duplicate the earlier runner line
      run({ cwd: dir, agent_type: 'reviewer', agent_id: 'v1', last_assistant_message: 'APPROVE' });
      run(runner({ status: 'DONE', pr: 'https://x/pull/9' }));
      expect(fs.readFileSync(ledger, 'utf8')).toBe(
        '# ledger\nSubagent pbi-runner: stopped — GATE plan\nSubagent pbi-runner: stopped — DONE https://x/pull/9\nSubagent reviewer: stopped — APPROVE\n',
      );
    });

    it('still records two different agents with the same message', () => {
      withLedger();
      run({ cwd: dir, agent_type: 'implementer', agent_id: 'a', last_assistant_message: 'Status: DONE' });
      run({ cwd: dir, agent_type: 'reviewer', agent_id: 'b', last_assistant_message: 'x' });
      run({ cwd: dir, agent_type: 'implementer', agent_id: 'c', last_assistant_message: 'Status: DONE' });
      expect(fs.readFileSync(ledger, 'utf8').split('\n').filter(Boolean)).toHaveLength(4);
    });

    const LEDGER = (...lines: string[]) => '# ledger\n' + lines.map((l) => l + '\n').join('');

    it('keeps two GATE replies of the same phase and runner as separate entries', () => {
      withLedger();
      run(runner({ status: 'GATE', phase: 'review', question: 'Fix advisories?' }));
      run(runner({ status: 'GATE', phase: 'review', question: 'Still blocked?' }));
      run(runner({ status: 'GATE', phase: 'review', question: 'Still blocked?' }));
      expect(fs.readFileSync(ledger, 'utf8')).toBe(
        LEDGER('Subagent pbi-runner: stopped — GATE review', 'Subagent pbi-runner: stopped — GATE review'),
      );
    });

    it('reads the status from the agent transcript when the message is missing', () => {
      withLedger();
      const t = path.join(dir, 'agent.jsonl');
      fs.writeFileSync(
        t,
        JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'x {"status":"GATE","phase":"plan"}' }] } }) + '\n',
      );
      run({ cwd: dir, agent_type: 'pbi-runner', agent_id: 'r1', agent_transcript_path: t });
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER('Subagent pbi-runner: stopped — GATE plan'));
    });

    it('uses the last status object when the reply holds several', () => {
      withLedger();
      run(runner('earlier {"status":"GATE","phase":"plan"} then {"status":"DONE","pr":"#12"} and {"note":1}'));
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER('Subagent pbi-runner: stopped — DONE #12'));
    });

    it.each([
      [{ status: 'GATE' }, 'GATE'],
      [{ status: 'DONE' }, 'DONE'],
      [{ status: 'DONE', pr: 12 }, 'DONE'],
      [{ status: 'DONE', pr: null }, 'DONE'],
      [{ status: 'DONE', pr: 'javascript:alert(1)' }, 'DONE'],
      [{ status: 'GATE', phase: 'a b\nc' }, 'GATE'],
    ])('summarises %j as %s', (reply, expected) => {
      withLedger();
      run(runner(reply));
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER(`Subagent pbi-runner: stopped — ${expected}`));
    });

    it('falls back to the first line for an unknown status', () => {
      withLedger();
      run(runner('{"status":"WAITING"}'));
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER('Subagent pbi-runner: stopped — {"status":"WAITING"}'));
    });

    it('recognises a namespaced runner name', () => {
      withLedger();
      run(runner({ status: 'DONE', pr: 'https://x/pull/1' }, { agent_type: 'agents:pbi-runner' }));
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER('Subagent agents:pbi-runner: stopped — DONE https://x/pull/1'));
    });

    it('writes no status summary without jq', () => {
      withLedger();
      const bin = path.join(dir, 'bin');
      fs.mkdirSync(bin);
      for (const c of ['cat', 'sed', 'head', 'tail', 'cut', 'ls', 'dirname', 'tr', 'grep', 'find', 'sort', 'bash', 'cksum']) {
        const src = ['/usr/bin', '/bin'].map((d) => path.join(d, c)).find((f) => fs.existsSync(f));
        if (src) fs.symlinkSync(src, path.join(bin, c));
      }
      const r = spawnSync('bash', [SCRIPT], {
        input: JSON.stringify(runner({ status: 'DONE', pr: 'https://x/pull/9' })),
        encoding: 'utf8',
        env: cleanEnv({ AGENTS_LEDGER: '', PATH: bin }),
      });
      expect(r.status).toBe(0);
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER('Subagent pbi-runner: stopped'));
    });

    it('sanitises the agent name', () => {
      withLedger();
      run({ cwd: dir, agent_type: 'evil\r\n- injected `x` ' + 'a'.repeat(100) + '/reviewer', agent_id: 'e1', last_assistant_message: 'ok' }); // cut at 64: dropped
      run({ cwd: dir, agent_type: 'agents:re\r\nviewer`', agent_id: 'e2', last_assistant_message: 'ok' });
      run({ cwd: dir, agent_type: 'ev\r\nil- `x`:reviewer', agent_id: 'e3', last_assistant_message: 'ok' });
      const out = fs.readFileSync(ledger, 'utf8').split('\n');
      expect(out).toEqual(['# ledger', 'Subagent agents:reviewer: stopped — ok', 'Subagent evil-x:reviewer: stopped — ok', '']);
    });

    it('does not dedupe without a valid agent_id and does not write a sidecar', () => {
      withLedger();
      run({ cwd: dir, agent_type: 'implementer', agent_id: 'bad id!', last_assistant_message: 'Status: DONE' });
      run({ cwd: dir, agent_type: 'implementer', last_assistant_message: 'Status: DONE' });
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER('Subagent implementer: stopped — Status: DONE'));
      expect(fs.existsSync(path.join(dir, '.agents', '7', '.ledger-seen'))).toBe(false);
    });

    it('records every stop of different agents with the same message when ids differ', () => {
      withLedger();
      run({ cwd: dir, agent_type: 'implementer', agent_id: 'a', last_assistant_message: 'Status: DONE' });
      run({ cwd: dir, agent_type: 'implementer', agent_id: 'b', last_assistant_message: 'Status: DONE' });
      expect(fs.readFileSync(ledger, 'utf8')).toBe(
        LEDGER('Subagent implementer: stopped — Status: DONE', 'Subagent implementer: stopped — Status: DONE'),
      );
    });

    it('ignores a symlinked sidecar and still writes the line', () => {
      withLedger();
      const target = path.join(dir, 'elsewhere');
      fs.writeFileSync(target, '');
      fs.symlinkSync(target, path.join(dir, '.agents', '7', '.ledger-seen'));
      const r = run({ cwd: dir, agent_type: 'reviewer', agent_id: 'a', last_assistant_message: 'x' });
      expect(r.status).toBe(0);
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER('Subagent reviewer: stopped — x'));
      expect(fs.readFileSync(target, 'utf8')).toBe('');
    });

    it('exits 0 and still writes the line when the sidecar cannot be written', () => {
      withLedger();
      fs.mkdirSync(path.join(dir, '.agents', '7', '.ledger-seen'));
      const r = run({ cwd: dir, agent_type: 'reviewer', agent_id: 'a', last_assistant_message: 'x' });
      expect(r.status).toBe(0);
      expect(fs.readFileSync(ledger, 'utf8')).toBe(LEDGER('Subagent reviewer: stopped — x'));
    });

    it('falls back to the first line for a runner reply without a status object', () => {
      withLedger();
      run(runner('plain text'));
      expect(fs.readFileSync(ledger, 'utf8')).toBe('# ledger\nSubagent pbi-runner: stopped — plain text\n');
    });
  });

  it('exits 0 on an empty payload', () => {
    expect(run('').status).toBe(0);
  });
});
