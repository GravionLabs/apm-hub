import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { readLedger, BRANCHES_BOUND, BRANCHES_UNBOUND } from './ledger-test-helpers';
import { SCRIPT, useLedgerFixture } from '../../helpers/subagent-ledger-fixture';

describe('subagent-ledger hook', () => {
  const fx = useLedgerFixture();
  const { cleanEnv, withLedger, run } = fx;

  describe('agent allowlist and branch binding', () => {
    const git = (...args: string[]) =>
      spawnSync(
        'git',
        [
          '-C',
          fx.dir,
          '-c',
          'user.email=t@t',
          '-c',
          'user.name=t',
          '-c',
          'commit.gpgsign=false',
          ...args,
        ],
        { encoding: 'utf8', env: cleanEnv() }
      );
    const repo = (branch: string) => {
      for (const a of [
        ['init', '-q'],
        ['checkout', '-q', '-b', branch],
        ['commit', '-q', '--allow-empty', '-m', 'init'],
      ]) {
        const r = git(...a);
        if (r.status !== 0) throw new Error(`git ${a.join(' ')} failed: ${r.stderr}`);
      }
      expect(git('rev-parse', '--abbrev-ref', 'HEAD').stdout.trim()).toBe(branch);
    };
    const stop = (type: string) =>
      run({ cwd: fx.dir, agent_type: type, last_assistant_message: 'ok' });
    const mk = (nr: string, mtime?: Date) => {
      const f = path.join(fx.dir, '.agents', nr, 'progress.md');
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, `# ${nr}\n`);
      if (mtime) fs.utimesSync(f, mtime, mtime);
      return f;
    };
    const read = (f: string) => readLedger(f);

    it.each(['general-purpose', 'Explore', 'subagent', 'evil:general-purpose'])(
      'writes nothing for foreign agent %s',
      (t) => {
        withLedger();
        const r = run({ cwd: fx.dir, agent_type: t, last_assistant_message: 'x' });
        expect(r.status).toBe(0);
        expect(readLedger(fx.ledger)).toBe('# ledger\n');
      }
    );

    it.each(['agents:implementer', 'agents/implementer', 'a:b:reviewer'])(
      'writes for namespaced agent %s',
      (t) => {
        withLedger();
        run({ cwd: fx.dir, agent_type: t, last_assistant_message: 'x' });
        expect(readLedger(fx.ledger)).toBe(`# ledger\nSubagent ${t}: stopped — x\n`);
      }
    );

    it.each([
      'issue-reader',
      'explorer',
      'planner',
      'reviewer',
      'review-lead',
      'implementer',
      'pr-writer',
      'pbi-runner',
    ])('writes for %s', (t) => {
      withLedger();
      run({ cwd: fx.dir, agent_type: t, last_assistant_message: 'x' });
      expect(readLedger(fx.ledger)).toBe(`# ledger\nSubagent ${t}: stopped — x\n`);
    });

    it('writes to the ledger of the branch issue although another ledger is newer', () => {
      repo('fix/7-x');
      const l7 = mk('7', new Date(2020, 1, 1));
      const l9 = mk('9');
      const r = run({ cwd: fx.dir, agent_type: 'implementer', last_assistant_message: 'ok' });
      expect(r.status).toBe(0);
      expect(read(l7)).toBe('# 7\nSubagent implementer: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it('writes nothing when the branch issue has no ledger', () => {
      repo('feat/7-x');
      const l9 = mk('9');
      const r = run({ cwd: fx.dir, agent_type: 'implementer', last_assistant_message: 'ok' });
      expect(r.status).toBe(0);
      expect(read(l9)).toBe('# 9\n');
    });

    it('falls back to the newest ledger on a branch without a number', () => {
      repo('main');
      const old = mk('7', new Date(2020, 1, 1));
      const nw = mk('9');
      run({ cwd: fx.dir, agent_type: 'implementer', last_assistant_message: 'ok' });
      expect(read(nw)).toBe('# 9\nSubagent implementer: stopped — ok\n');
      expect(read(old)).toBe('# 7\n');
    });

    it('does not bind to loop-<nr> and keeps the loop ledger out of the fallback', () => {
      repo('main');
      const l7 = mk('7', new Date(2020, 1, 1));
      const loop = mk('loop-8');
      run({ cwd: fx.dir, agent_type: 'reviewer', last_assistant_message: 'ok' });
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

    it.each(BRANCHES_UNBOUND)(
      'yields no number for branch %s and falls back to the newest ledger',
      (b) => {
        repo(b);
        const l7 = mk('7', new Date(2020, 1, 1));
        const l9 = mk('9');
        stop('reviewer');
        expect(read(l9)).toBe('# 9\nSubagent reviewer: stopped — ok\n');
        expect(read(l7)).toBe('# 7\n');
      }
    );

    it('without a .agents/current marker binds a stop to the ledger of the branch still checked out', () => {
      repo('fix/7-x'); // no loop binding: the branch rule applies although fx.ledger 9 is newer
      const l7 = mk('7', new Date(2020, 1, 1));
      const l9 = mk('9');
      stop('issue-reader');
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it('does not write through a symlinked .agents/<nr> directory on the branch-bound path', () => {
      repo('fix/7-x');
      const real = path.join(fx.dir, 'real');
      fs.mkdirSync(real);
      fs.writeFileSync(path.join(real, 'progress.md'), 'secret\n');
      fs.mkdirSync(path.join(fx.dir, '.agents'));
      fs.symlinkSync(real, path.join(fx.dir, '.agents', '7'));
      expect(stop('reviewer').status).toBe(0);
      expect(read(path.join(real, 'progress.md'))).toBe('secret\n');
    });

    it('does not write through a symlinked .agents directory', () => {
      repo('fix/7-x');
      const real = path.join(fx.dir, 'real');
      fs.mkdirSync(path.join(real, '7'), { recursive: true });
      fs.writeFileSync(path.join(real, '7', 'progress.md'), 'secret\n');
      fs.symlinkSync(real, path.join(fx.dir, '.agents'));
      expect(stop('reviewer').status).toBe(0);
      expect(read(path.join(real, '7', 'progress.md'))).toBe('secret\n');
    });

    it('falls back to the newest ledger when git is not on PATH', () => {
      repo('fix/7-x');
      const l7 = mk('7', new Date(2020, 1, 1));
      const l9 = mk('9');
      const bin = path.join(fx.dir, 'bin');
      fs.mkdirSync(bin);
      for (const c of [
        'cat',
        'sed',
        'head',
        'tail',
        'cut',
        'ls',
        'dirname',
        'tr',
        'grep',
        'find',
        'sort',
        'bash',
        'cksum',
      ]) {
        const src = ['/usr/bin', '/bin'].map((d) => path.join(d, c)).find((f) => fs.existsSync(f));
        if (src) fs.symlinkSync(src, path.join(bin, c));
      }
      const r = spawnSync('bash', [SCRIPT], {
        input: JSON.stringify({
          cwd: fx.dir,
          agent_type: 'reviewer',
          last_assistant_message: 'ok',
        }),
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
      expect(readLedger(fx.ledger)).toBe('# ledger\nSubagent evil:reviewer: stopped — ok\n');
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
      const r = run({ cwd: fx.dir, last_assistant_message: 'ok' });
      expect(r.status).toBe(0);
      expect(readLedger(fx.ledger)).toBe('# ledger\n');
    });

    it('cuts the agent name at 64 characters before the allowlist check', () => {
      withLedger();
      const fits = 'a'.repeat(55) + ':reviewer'; // 64 characters
      stop('a'.repeat(56) + ':reviewer'); // 65: cut to ":reviewe", not allowlisted
      stop(fits);
      expect(readLedger(fx.ledger)).toBe(`# ledger\nSubagent ${fits}: stopped — ok\n`);
    });

    it.each(['agents.reviewer', 'a:b.explorer'])(
      'accepts the "." namespace separator in %s',
      (t) => {
        withLedger();
        stop(t);
        expect(readLedger(fx.ledger)).toBe(`# ledger\nSubagent ${t}: stopped — ok\n`);
      }
    );

    /** Repo config whose fsmonitor command and hooks would create a marker file; checked live with `git status`. */
    const hostileConfig = () => {
      const marker = path.join(fx.dir, 'MARKER');
      const hooks = path.join(fx.dir, 'evil-hooks');
      fs.mkdirSync(hooks);
      for (const h of [
        'post-checkout',
        'pre-commit',
        'reference-transaction',
        'post-index-change',
      ]) {
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
      const bin = path.join(fx.dir, 'broken-bin');
      fs.mkdirSync(bin, { recursive: true });
      fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
      return spawnSync('bash', [SCRIPT], {
        input: JSON.stringify({ cwd, agent_type: 'reviewer', last_assistant_message: 'ok' }),
        encoding: 'utf8',
        env: cleanEnv({
          AGENTS_LEDGER: '',
          PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
        }),
      });
    };

    it('writes nothing when git fails inside a repository (no newest-ledger fallback)', () => {
      repo('fix/7-x');
      const l7 = mk('7', new Date(2020, 1, 1));
      const l9 = mk('9');
      const r = runWithBrokenGit(fx.dir);
      expect(r.status).toBe(0);
      expect(read(l7)).toBe('# 7\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it('writes nothing when git fails in a subdirectory of a repository', () => {
      repo('main');
      const sub = path.join(fx.dir, 'pkg');
      const l3 = path.join(sub, '.agents', '3', 'progress.md');
      fs.mkdirSync(path.dirname(l3), { recursive: true });
      fs.writeFileSync(l3, '# 3\n');
      expect(runWithBrokenGit(sub).status).toBe(0);
      expect(read(l3)).toBe('# 3\n');
    });

    it('writes nothing when real git cannot read the repository (corrupt HEAD)', () => {
      repo('fix/7-x');
      const l9 = mk('9');
      fs.writeFileSync(path.join(fx.dir, '.git', 'HEAD'), 'garbage\n');
      expect(stop('reviewer').status).toBe(0);
      expect(read(l9)).toBe('# 9\n');
    });

    it('still falls back to the newest ledger outside a repository when git fails', () => {
      const l7 = mk('7', new Date(2020, 1, 1));
      const l9 = mk('9');
      expect(runWithBrokenGit(fx.dir).status).toBe(0);
      expect(read(l9)).toBe('# 9\nSubagent reviewer: stopped — ok\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it('passes -c core.fsmonitor=false -c core.hooksPath=/dev/null to git', () => {
      repo('fix/7-x');
      const l7 = mk('7');
      const realGit = spawnSync('sh', ['-c', 'command -v git'], {
        encoding: 'utf8',
        env: cleanEnv(),
      }).stdout.trim();
      const bin = path.join(fx.dir, 'shim');
      const log = path.join(fx.dir, 'git-args.log');
      fs.mkdirSync(bin);
      fs.writeFileSync(
        path.join(bin, 'git'),
        `#!/bin/sh\nprintf '%s ' "$@" >> '${log}'\nexec '${realGit}' "$@"\n`,
        { mode: 0o755 }
      );
      const r = spawnSync('bash', [SCRIPT], {
        input: JSON.stringify({
          cwd: fx.dir,
          agent_type: 'reviewer',
          last_assistant_message: 'ok',
        }),
        encoding: 'utf8',
        env: cleanEnv({
          AGENTS_LEDGER: '',
          PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
        }),
      });
      expect(r.status).toBe(0);
      expect(readLedger(log)).toContain(
        '-c core.fsmonitor=false -c core.hooksPath=/dev/null rev-parse'
      );
      expect(read(l7)).toBe('# 7\nSubagent reviewer: stopped — ok\n');
    });

    it('lets AGENTS_LEDGER win over the branch binding', () => {
      repo('fix/7-x');
      mk('7');
      const l9 = mk('9');
      spawnSync('bash', [SCRIPT], {
        input: JSON.stringify({ cwd: fx.dir, agent_type: 'reviewer', response: 'ok' }),
        encoding: 'utf8',
        env: cleanEnv({ AGENTS_LEDGER: l9 }),
      });
      expect(read(l9)).toBe('# 9\nSubagent reviewer: stopped — ok\n');
    });
  });

  describe('pbi-runner and nested stops', () => {
    const runner = (reply: unknown, extra: object = {}) => ({
      cwd: fx.dir,
      agent_type: 'pbi-runner',
      agent_id: 'r1',
      last_assistant_message: typeof reply === 'string' ? reply : JSON.stringify(reply),
      ...extra,
    });

    it('summarises a GATE reply with its phase', () => {
      withLedger();
      run(
        runner({
          status: 'GATE',
          pbi: 7,
          phase: 'plan',
          question: 'Proceed?',
          options: ['yes', 'no'],
        })
      );
      expect(readLedger(fx.ledger)).toBe('# ledger\nSubagent pbi-runner: stopped — GATE plan\n');
    });

    it('summarises a DONE reply with the PR url, also pretty-printed in a code fence', () => {
      withLedger();
      const json = JSON.stringify(
        { status: 'DONE', pbi: 7, pr: 'https://x/pull/9', summary: 'a\nb' },
        null,
        2
      );
      run(runner('```json\n' + json + '\n```'));
      expect(readLedger(fx.ledger)).toBe(
        '# ledger\nSubagent pbi-runner: stopped — DONE https://x/pull/9\n'
      );
    });

    it('summarises BLOCKED and FAILED by status only', () => {
      withLedger();
      run(runner({ status: 'BLOCKED', pbi: 7, pr: null, summary: 's' }, { agent_id: 'r2' }));
      run(runner({ status: 'FAILED', pbi: 7, pr: null, summary: 's' }, { agent_id: 'r3' }));
      expect(readLedger(fx.ledger)).toBe(
        '# ledger\nSubagent pbi-runner: stopped — BLOCKED\nSubagent pbi-runner: stopped — FAILED\n'
      );
    });

    it('writes a depth-2 implementer stop into the PBI ledger, not a newer loop ledger', () => {
      withLedger();
      fs.mkdirSync(path.join(fx.dir, '.agents', 'loop-300'), { recursive: true });
      const loop = path.join(fx.dir, '.agents', 'loop-300', 'progress.md');
      fs.writeFileSync(loop, '# loop\n');
      run({
        cwd: fx.dir,
        agent_type: 'implementer',
        agent_id: 'i1',
        last_assistant_message: 'Status: DONE',
      });
      run(runner({ status: 'DONE', pbi: 7, pr: 'https://x/pull/9' }));
      expect(readLedger(loop)).toBe('# loop\n');
      expect(readLedger(fx.ledger)).toBe(
        '# ledger\nSubagent implementer: stopped — Status: DONE\nSubagent pbi-runner: stopped — DONE https://x/pull/9\n'
      );
    });

    it('records a resumed runner (same agent_id) once per distinct outcome', () => {
      withLedger();
      run(runner({ status: 'GATE', phase: 'plan' }));
      run(runner({ status: 'DONE', pr: 'https://x/pull/9' }));
      // an interleaved child line and a repeated resume stop must not duplicate the earlier runner line
      run({
        cwd: fx.dir,
        agent_type: 'reviewer',
        agent_id: 'v1',
        last_assistant_message: 'APPROVE',
      });
      run(runner({ status: 'DONE', pr: 'https://x/pull/9' }));
      expect(readLedger(fx.ledger)).toBe(
        '# ledger\nSubagent pbi-runner: stopped — GATE plan\nSubagent pbi-runner: stopped — DONE https://x/pull/9\nSubagent reviewer: stopped — APPROVE\n'
      );
    });

    it('still records two different agents with the same message', () => {
      withLedger();
      run({
        cwd: fx.dir,
        agent_type: 'implementer',
        agent_id: 'a',
        last_assistant_message: 'Status: DONE',
      });
      run({ cwd: fx.dir, agent_type: 'reviewer', agent_id: 'b', last_assistant_message: 'x' });
      run({
        cwd: fx.dir,
        agent_type: 'implementer',
        agent_id: 'c',
        last_assistant_message: 'Status: DONE',
      });
      expect(readLedger(fx.ledger).split('\n').filter(Boolean)).toHaveLength(4);
    });

    const LEDGER = (...lines: string[]) => '# ledger\n' + lines.map((l) => l + '\n').join('');

    it('keeps two GATE replies of the same phase and runner as separate entries', () => {
      withLedger();
      run(runner({ status: 'GATE', phase: 'review', question: 'Fix advisories?' }));
      run(runner({ status: 'GATE', phase: 'review', question: 'Still blocked?' }));
      run(runner({ status: 'GATE', phase: 'review', question: 'Still blocked?' }));
      expect(readLedger(fx.ledger)).toBe(
        LEDGER(
          'Subagent pbi-runner: stopped — GATE review',
          'Subagent pbi-runner: stopped — GATE review'
        )
      );
    });

    it('reads the status from the agent transcript when the message is missing', () => {
      withLedger();
      const t = path.join(fx.dir, 'agent.jsonl');
      fs.writeFileSync(
        t,
        JSON.stringify({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'x {"status":"GATE","phase":"plan"}' }],
          },
        }) + '\n'
      );
      run({ cwd: fx.dir, agent_type: 'pbi-runner', agent_id: 'r1', agent_transcript_path: t });
      expect(readLedger(fx.ledger)).toBe(LEDGER('Subagent pbi-runner: stopped — GATE plan'));
    });

    it('uses the last status object when the reply holds several', () => {
      withLedger();
      run(
        runner(
          'earlier {"status":"GATE","phase":"plan"} then {"status":"DONE","pr":"#12"} and {"note":1}'
        )
      );
      expect(readLedger(fx.ledger)).toBe(LEDGER('Subagent pbi-runner: stopped — DONE #12'));
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
      expect(readLedger(fx.ledger)).toBe(LEDGER(`Subagent pbi-runner: stopped — ${expected}`));
    });

    it('falls back to the first line for an unknown status', () => {
      withLedger();
      run(runner('{"status":"WAITING"}'));
      expect(readLedger(fx.ledger)).toBe(
        LEDGER('Subagent pbi-runner: stopped — {"status":"WAITING"}')
      );
    });

    it('recognises a namespaced runner name', () => {
      withLedger();
      run(runner({ status: 'DONE', pr: 'https://x/pull/1' }, { agent_type: 'agents:pbi-runner' }));
      expect(readLedger(fx.ledger)).toBe(
        LEDGER('Subagent agents:pbi-runner: stopped — DONE https://x/pull/1')
      );
    });

    it('writes no status summary without jq', () => {
      withLedger();
      const bin = path.join(fx.dir, 'bin');
      fs.mkdirSync(bin);
      for (const c of [
        'cat',
        'sed',
        'head',
        'tail',
        'cut',
        'ls',
        'dirname',
        'tr',
        'grep',
        'find',
        'sort',
        'bash',
        'cksum',
      ]) {
        const src = ['/usr/bin', '/bin'].map((d) => path.join(d, c)).find((f) => fs.existsSync(f));
        if (src) fs.symlinkSync(src, path.join(bin, c));
      }
      const r = spawnSync('bash', [SCRIPT], {
        input: JSON.stringify(runner({ status: 'DONE', pr: 'https://x/pull/9' })),
        encoding: 'utf8',
        env: cleanEnv({ AGENTS_LEDGER: '', PATH: bin }),
      });
      expect(r.status).toBe(0);
      expect(readLedger(fx.ledger)).toBe(LEDGER('Subagent pbi-runner: stopped'));
    });

    it('sanitises the agent name', () => {
      withLedger();
      run({
        cwd: fx.dir,
        agent_type: 'evil\r\n- injected `x` ' + 'a'.repeat(100) + '/reviewer',
        agent_id: 'e1',
        last_assistant_message: 'ok',
      }); // cut at 64: dropped
      run({
        cwd: fx.dir,
        agent_type: 'agents:re\r\nviewer`',
        agent_id: 'e2',
        last_assistant_message: 'ok',
      });
      run({
        cwd: fx.dir,
        agent_type: 'ev\r\nil- `x`:reviewer',
        agent_id: 'e3',
        last_assistant_message: 'ok',
      });
      const out = readLedger(fx.ledger).split('\n');
      expect(out).toEqual([
        '# ledger',
        'Subagent agents:reviewer: stopped — ok',
        'Subagent evil-x:reviewer: stopped — ok',
        '',
      ]);
    });

    it('does not dedupe without a valid agent_id and does not write a sidecar', () => {
      withLedger();
      run({
        cwd: fx.dir,
        agent_type: 'implementer',
        agent_id: 'bad id!',
        last_assistant_message: 'Status: DONE',
      });
      run({ cwd: fx.dir, agent_type: 'implementer', last_assistant_message: 'Status: DONE' });
      expect(readLedger(fx.ledger)).toBe(LEDGER('Subagent implementer: stopped — Status: DONE'));
      expect(fs.existsSync(path.join(fx.dir, '.agents', '7', '.ledger-seen'))).toBe(false);
    });

    it('records every stop of different agents with the same message when ids differ', () => {
      withLedger();
      run({
        cwd: fx.dir,
        agent_type: 'implementer',
        agent_id: 'a',
        last_assistant_message: 'Status: DONE',
      });
      run({
        cwd: fx.dir,
        agent_type: 'implementer',
        agent_id: 'b',
        last_assistant_message: 'Status: DONE',
      });
      expect(readLedger(fx.ledger)).toBe(
        LEDGER(
          'Subagent implementer: stopped — Status: DONE',
          'Subagent implementer: stopped — Status: DONE'
        )
      );
    });

    it('ignores a symlinked sidecar and still writes the line', () => {
      withLedger();
      const target = path.join(fx.dir, 'elsewhere');
      fs.writeFileSync(target, '');
      fs.symlinkSync(target, path.join(fx.dir, '.agents', '7', '.ledger-seen'));
      const r = run({
        cwd: fx.dir,
        agent_type: 'reviewer',
        agent_id: 'a',
        last_assistant_message: 'x',
      });
      expect(r.status).toBe(0);
      expect(readLedger(fx.ledger)).toBe(LEDGER('Subagent reviewer: stopped — x'));
      expect(readLedger(target)).toBe('');
    });

    it('exits 0 and still writes the line when the sidecar cannot be written', () => {
      withLedger();
      fs.mkdirSync(path.join(fx.dir, '.agents', '7', '.ledger-seen'));
      const r = run({
        cwd: fx.dir,
        agent_type: 'reviewer',
        agent_id: 'a',
        last_assistant_message: 'x',
      });
      expect(r.status).toBe(0);
      expect(readLedger(fx.ledger)).toBe(LEDGER('Subagent reviewer: stopped — x'));
    });

    it('falls back to the first line for a runner reply without a status object', () => {
      withLedger();
      run(runner('plain text'));
      expect(readLedger(fx.ledger)).toBe('# ledger\nSubagent pbi-runner: stopped — plain text\n');
    });
  });
});
