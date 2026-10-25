import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  readLedger,
  BRANCHES_UNBOUND,
  LOOP_LEDGERS_FOREIGN_BRANCH,
  LOOP_LEDGERS_LIVE,
  LOOP_LEDGERS_STALE,
  MARKERS_MALFORMED,
} from './ledger-test-helpers';
import { SCRIPT, useLedgerFixture } from '../../helpers/subagent-ledger-fixture';

describe('subagent-ledger hook', () => {
  const fx = useLedgerFixture();
  const { cleanEnv, withLedger, run } = fx;

  describe('loop marker .agents/current (#375)', () => {
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
    };
    const mk = (nr: string, content = `# ${nr}\n`, mtime?: Date) => {
      const f = path.join(fx.dir, '.agents', nr, 'progress.md');
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, content);
      if (mtime) fs.utimesSync(f, mtime, mtime);
      return f;
    };
    const read = (f: string) => readLedger(f);
    const marker = (content = '9 loop-5\n') =>
      fs.writeFileSync(path.join(fx.dir, '.agents', 'current'), content);
    const stop = (type = 'issue-reader', env: Record<string, string> = { AGENTS_LEDGER: '' }) =>
      spawnSync('bash', [SCRIPT], {
        input: JSON.stringify({ cwd: fx.dir, agent_type: type, last_assistant_message: 'ok' }),
        encoding: 'utf8',
        env: cleanEnv(env),
      });
    const OLD = new Date(2020, 1, 1);
    const LOOP =
      '# loop\nLoop: PBI #7 started\nLoop: PBI #7 done — https://x/pr/7\nLoop: PBI #9 started\n';
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

    it.each(MARKERS_MALFORMED.map((m) => [JSON.stringify(m), m]))(
      'ignores the malformed marker %s and binds to the branch',
      (_, m) => {
        const { l7, l9 } = scenario();
        marker(m);
        expect(stop().status).toBe(0);
        expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
        expect(read(l9)).toBe('# 9\n');
      }
    );

    it('ignores a symlinked marker', () => {
      const { l7, l9 } = scenario();
      const real = path.join(fx.dir, 'real-current');
      fs.writeFileSync(real, '9 loop-5\n');
      fs.symlinkSync(real, path.join(fx.dir, '.agents', 'current'));
      stop();
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it('ignores a marker that is a directory', () => {
      const { l7 } = scenario();
      fs.mkdirSync(path.join(fx.dir, '.agents', 'current'));
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
      expect(fs.existsSync(path.join(fx.dir, '.agents', '9'))).toBe(false);
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

    it.each(LOOP_LEDGERS_STALE.map((l) => [JSON.stringify(l), l]))(
      'ignores a stale marker when the loop ledger is %s',
      (_, l) => {
        const { l7, l9, lp } = scenario(l);
        marker();
        stop();
        expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
        expect(read(l9)).toBe('# 9\n');
        expect(fs.readFileSync(lp, 'utf8')).toBe(l);
      }
    );

    it.each(LOOP_LEDGERS_LIVE.map((l) => [JSON.stringify(l), l]))(
      'honours the marker while the loop ledger is %s',
      (_, l) => {
        const { l7, l9 } = scenario(l);
        marker();
        stop();
        expect(read(l9)).toBe('# 9\nSubagent issue-reader: stopped — ok\n');
        expect(read(l7)).toBe('# 7\n');
      }
    );

    it('ignores a marker whose loop ledger is a symlink', () => {
      repo('fix/7-x');
      const l7 = mk('7');
      const l9 = mk('9', '# 9\n', OLD);
      const real = path.join(fx.dir, 'real-loop.md');
      fs.writeFileSync(real, LOOP);
      fs.mkdirSync(path.join(fx.dir, '.agents', 'loop-5'));
      fs.symlinkSync(real, path.join(fx.dir, '.agents', 'loop-5', 'progress.md'));
      marker();
      stop();
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
      expect(read(l9)).toBe('# 9\n');
    });

    it('does not write through a symlinked bound PBI directory and falls back to the branch', () => {
      repo('fix/7-x');
      const l7 = mk('7');
      mk('loop-5', LOOP);
      const real = path.join(fx.dir, 'real');
      fs.mkdirSync(real);
      fs.writeFileSync(path.join(real, 'progress.md'), 'secret\n');
      fs.symlinkSync(real, path.join(fx.dir, '.agents', '9'));
      marker();
      stop();
      expect(read(path.join(real, 'progress.md'))).toBe('secret\n');
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
    });

    it.each(LOOP_LEDGERS_FOREIGN_BRANCH.map((l) => [JSON.stringify(l), l]))(
      'ignores the marker on a branch whose issue the loop has not finished: %s',
      (_, l) => {
        const { l7, l9 } = scenario(l);
        marker();
        stop();
        expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
        expect(read(l9)).toBe('# 9\n');
      }
    );

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
      const real = path.join(fx.dir, 'real-loop');
      fs.mkdirSync(real);
      fs.writeFileSync(path.join(real, 'progress.md'), LOOP);
      fs.symlinkSync(real, path.join(fx.dir, '.agents', 'loop-5'));
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
      const target = path.join(fx.dir, 'target.md');
      fs.writeFileSync(target, 'secret\n');
      fs.mkdirSync(path.join(fx.dir, '.agents', '9'));
      fs.symlinkSync(target, path.join(fx.dir, '.agents', '9', 'progress.md'));
      marker();
      stop();
      expect(read(target)).toBe('secret\n');
      expect(read(l7)).toBe('# 7\nSubagent issue-reader: stopped — ok\n');
    });

    it('writes nothing through a symlinked .agents even with a valid marker', () => {
      repo('fix/7-x');
      const real = path.join(fx.dir, 'real');
      for (const [f, c] of [
        ['7/progress.md', '# 7\n'],
        ['9/progress.md', '# 9\n'],
        ['loop-5/progress.md', LOOP],
        ['current', '9 loop-5\n'],
      ]) {
        fs.mkdirSync(path.dirname(path.join(real, f)), { recursive: true });
        fs.writeFileSync(path.join(real, f), c);
      }
      fs.symlinkSync(real, path.join(fx.dir, '.agents'));
      expect(stop().status).toBe(0);
      expect(read(path.join(real, '9', 'progress.md'))).toBe('# 9\n');
      expect(read(path.join(real, '7', 'progress.md'))).toBe('# 7\n');
      expect(read(path.join(real, 'loop-5', 'progress.md'))).toBe(LOOP);
    });

    it('dedupes a repeated stop per agent_id with the sidecar next to the bound ledger', () => {
      const { l7, l9 } = scenario();
      marker();
      const payload = JSON.stringify({
        cwd: fx.dir,
        agent_type: 'reviewer',
        agent_id: 'a1b2',
        last_assistant_message: 'APPROVE',
      });
      const fire = () =>
        spawnSync('bash', [SCRIPT], {
          input: payload,
          encoding: 'utf8',
          env: cleanEnv({ AGENTS_LEDGER: '' }),
        });
      expect(fire().status).toBe(0);
      expect(fire().status).toBe(0);
      expect(read(l9)).toBe('# 9\nSubagent reviewer: stopped — APPROVE\n');
      expect(read(l7)).toBe('# 7\n');
      expect(fs.existsSync(path.join(fx.dir, '.agents', '9', '.ledger-seen'))).toBe(true);
      expect(fs.existsSync(path.join(fx.dir, '.agents', '7', '.ledger-seen'))).toBe(false);
    });

    it('writes nothing with a live marker when real git cannot read the repository (corrupt HEAD)', () => {
      const { l7, l9, lp } = scenario();
      marker();
      fs.writeFileSync(path.join(fx.dir, '.git', 'HEAD'), 'garbage\n');
      stop();
      expect(read(l9)).toBe('# 9\n');
      expect(read(l7)).toBe('# 7\n');
      expect(read(lp)).toBe(LOOP);
    });

    it('writes nothing with a live marker when git fails inside a repository', () => {
      const { l7, l9 } = scenario();
      marker();
      const bin = path.join(fx.dir, 'broken-bin');
      fs.mkdirSync(bin, { recursive: true });
      fs.writeFileSync(path.join(bin, 'git'), '#!/bin/sh\nexit 128\n', { mode: 0o755 });
      expect(
        stop('issue-reader', {
          AGENTS_LEDGER: '',
          PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
        }).status
      ).toBe(0);
      expect(read(l9)).toBe('# 9\n');
      expect(read(l7)).toBe('# 7\n');
    });

    it.each(BRANCHES_UNBOUND)(
      'honours a live marker on the branch %s without an issue number',
      (b) => {
        repo(b);
        const l9 = mk('9', '# 9\n', OLD);
        const l7 = mk('7');
        mk('loop-5', '# loop\nLoop: PBI #9 started\n');
        marker();
        stop();
        expect(read(l9)).toBe('# 9\nSubagent issue-reader: stopped — ok\n');
        expect(read(l7)).toBe('# 7\n');
      }
    );

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
      expect(fs.existsSync(path.join(fx.dir, '.agents', '9'))).toBe(false);
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

    it.each(['general-purpose', 'Explore', 'subagent'])(
      'writes nothing for the foreign agent %s with a valid marker',
      (t) => {
        const { l7, l9, lp } = scenario();
        marker();
        expect(stop(t).status).toBe(0);
        expect(read(l9)).toBe('# 9\n');
        expect(read(l7)).toBe('# 7\n');
        expect(read(lp)).toBe(LOOP);
      }
    );
  });
});
