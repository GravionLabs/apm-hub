import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createGuardFixture, hermetic } from '../../helpers/git-guardrails-fixture';

describe('git-guardrails hook', () => {
  const fx = createGuardFixture();
  const {
    git,
    withFreshRepo,
    claude,
    copilot,
    runRaw,
    run,
    denied,
    runNoJq,
    dirty,
    untracked,
    which,
  } = fx;

  describe('hardening', () => {
    it('does not run a core.fsmonitor helper from a hostile repo', () => {
      const evil = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-evil-'));
      const marker = path.join(evil, 'pwned');
      try {
        spawnSync('git', ['init', '-q', evil], { env: hermetic(fx.home) });
        fs.writeFileSync(path.join(evil, 'hook.sh'), `#!/bin/sh\ntouch ${marker}\n`, {
          mode: 0o755,
        });
        spawnSync('git', ['-C', evil, 'config', 'core.fsmonitor', path.join(evil, 'hook.sh')], {
          env: hermetic(fx.home),
        });
        run(claude(`git -C ${evil} checkout .`));
        expect(fs.existsSync(marker)).toBe(false);
      } finally {
        fs.rmSync(evil, { recursive: true, force: true });
      }
    });
    it('does not run a .gitattributes clean filter of a repo given via git -C', () => {
      const evil = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-filter-'));
      const marker = path.join(evil, 'PWNED');
      const env = hermetic(fx.home);
      try {
        spawnSync('git', ['init', '-q', '-b', 'feature', evil], { env });
        fs.writeFileSync(path.join(evil, '.gitattributes'), 'f filter=x\n');
        fs.writeFileSync(path.join(evil, 'f'), 'a\n');
        spawnSync('git', ['-C', evil, 'add', '.'], { env });
        spawnSync(
          'git',
          ['-C', evil, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'i'],
          { env }
        );
        spawnSync('git', ['-C', evil, 'config', 'filter.x.clean', `touch ${marker}; cat`], { env });
        fs.writeFileSync(path.join(evil, 'f'), 'b\n'); // same size, old mtime: git status would hash it through the filter
        fs.utimesSync(path.join(evil, 'f'), new Date('2000-01-01'), new Date('2000-01-01'));
        // control: a plain git status in that repo does run the filter
        spawnSync('git', ['-C', evil, 'status', '--porcelain'], { env });
        expect(fs.existsSync(marker)).toBe(true);
        fs.rmSync(marker);
        fs.utimesSync(path.join(evil, 'f'), new Date('2000-01-01'), new Date('2000-01-01'));
        for (const fn of [run, runNoJq]) {
          expect(denied(fn(claude(`git -C ${evil} checkout .`)))).toBe(true);
          expect(fn(claude(`git -C ${evil} push -f`)).out).toBe(''); // branch read from the HEAD file
        }
        expect(fs.existsSync(marker)).toBe(false);
      } finally {
        fs.rmSync(evil, { recursive: true, force: true });
      }
    });
    describe('a bare repository or git dir inside the session repo', () => {
      let wt: string;
      let marker: string;
      const bare = () => path.join(fx.repo, 'bare.git');
      const stale = () =>
        fs.utimesSync(path.join(wt, 'f'), new Date('2000-01-01'), new Date('2000-01-01'));
      beforeEach(() => {
        withFreshRepo();
        // a git dir (no .git entry) inside the cwd whose config points at a work tree and defines a clean filter
        wt = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-barewt-'));
        marker = path.join(wt, 'PWNED');
        const env = hermetic(fx.home);
        spawnSync('git', ['init', '-q', '-b', 'main', wt], { env });
        fs.writeFileSync(path.join(wt, '.git', 'info', 'attributes'), 'f filter=x\n');
        fs.writeFileSync(path.join(wt, 'f'), 'a\n');
        spawnSync('git', ['-C', wt, 'add', 'f'], { env });
        spawnSync(
          'git',
          ['-C', wt, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'i'],
          { env }
        );
        fs.renameSync(path.join(wt, '.git'), bare());
        spawnSync('git', ['--git-dir', bare(), 'config', 'core.worktree', wt], { env });
        spawnSync(
          'git',
          ['--git-dir', bare(), 'config', 'filter.x.clean', `touch ${marker}; cat`],
          { env }
        );
        fs.writeFileSync(path.join(wt, 'f'), 'b\n'); // same size, old mtime: git status hashes it through the filter
        stale();
        // control: a plain git status there does run the filter
        spawnSync('git', ['-C', bare(), 'status', '--porcelain'], { env });
        expect(fs.existsSync(marker)).toBe(true);
        fs.rmSync(marker);
        stale();
        fs.symlinkSync(bare(), path.join(fx.repo, 'link'));
      });
      afterEach(() => fs.rmSync(wt, { recursive: true, force: true }));

      it.each([
        'git -C bare.git checkout .',
        'git -C bare.git restore .',
        'git -C ./bare.git/refs checkout .',
        'git -C link checkout .',
        'git --git-dir=./bare.git checkout .',
        'GIT_DIR=bare.git git checkout .',
        'cd bare.git && git checkout .',
        'git -C bare.git -c alias.co=checkout co .',
      ])('denies %s as not inspected and never runs its filter, with and without jq', (c) => {
        for (const fn of [run, runNoJq]) {
          const r = fn(claude(c));
          expect(denied(r)).toBe(true);
          expect(JSON.parse(r.out).permissionDecisionReason).toContain('not inspected');
        }
        expect(fs.existsSync(marker)).toBe(false);
      });
      it('reads the branch of a bare repo from its HEAD file for a force push', () => {
        for (const fn of [run, runNoJq]) {
          expect(denied(fn(claude('git -C bare.git push -f')))).toBe(true);
          expect(denied(fn(claude('git -C link push -f origin HEAD')))).toBe(true);
        }
        fs.writeFileSync(path.join(bare(), 'HEAD'), 'ref: refs/heads/topic\n');
        expect(run(claude('git -C bare.git push -f')).out).toBe('');
        expect(fs.existsSync(marker)).toBe(false);
      });
      it('still inspects the session repository itself', () => {
        expect(run(claude('git -C . checkout .')).out).toBe('');
        dirty();
        expect(denied(run(claude('git -C . checkout .')))).toBe(true);
        expect(fs.existsSync(marker)).toBe(false);
      });
    });
    it('runs its own git hardened and never inside another repository', () => {
      withFreshRepo();
      const shim = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-shim-'));
      const other = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-foreign-'));
      const log = path.join(shim, 'log');
      try {
        fs.writeFileSync(
          path.join(shim, 'git'),
          `#!/bin/sh\nprintf '%s|%s\\n' "$GIT_OPTIONAL_LOCKS" "$*" >> ${log}\nexec ${fs.realpathSync(which('git')!)} "$@"\n`,
          { mode: 0o755 }
        );
        const shimmed = { ...process.env, PATH: `${shim}${path.delimiter}${process.env.PATH}` };
        dirty();
        expect(denied(runRaw(JSON.stringify(claude('git checkout .')), {}, shimmed))).toBe(true);
        expect(
          denied(
            runRaw(
              JSON.stringify(claude(`git -C ${other} checkout . && git -C ${other} push -f`)),
              {},
              shimmed
            )
          )
        ).toBe(true);
        const lines = fs.readFileSync(log, 'utf8').trim().split('\n');
        expect(lines.some((l) => l.includes('status'))).toBe(true);
        for (const l of lines) {
          expect(l.startsWith('0|')).toBe(true);
          expect(l).toContain('--no-optional-locks');
          expect(l).toContain('core.hooksPath=/dev/null');
          expect(l).toContain('core.fsmonitor=false');
          expect(l).not.toContain(other);
        }
      } finally {
        fs.rmSync(shim, { recursive: true, force: true });
        fs.rmSync(other, { recursive: true, force: true });
      }
    });
    it('ignores untracked files for the checkout . dirty check', () => {
      withFreshRepo();
      untracked();
      expect(run(claude('git checkout .')).out).toBe('');
    });
  });

  describe('opt-out', () => {
    it('GIT_GUARDRAILS_OFF=0 does not disable the hook', () => {
      expect(denied(run(claude('git reset --hard'), { GIT_GUARDRAILS_OFF: '0' }))).toBe(true);
    });
    it('GIT_GUARDRAILS_OFF=1 disables the hook for Copilot payloads, with and without jq', () => {
      expect(run(copilot('git reset --hard'), { GIT_GUARDRAILS_OFF: '1' }).out).toBe('');
      expect(
        runRaw(
          JSON.stringify(copilot('git reset --hard')),
          { GIT_GUARDRAILS_OFF: '1' },
          { ...process.env, PATH: fx.nojq }
        ).out
      ).toBe('');
      expect(denied(runNoJq(copilot('git reset --hard')))).toBe(true);
    });
    it('an inline GIT_GUARDRAILS_OFF=1 in the command does not disable the hook', () => {
      expect(denied(run(claude('GIT_GUARDRAILS_OFF=1 git reset --hard')))).toBe(true);
    });
    it('GIT_GUARDRAILS_OFF=1 disables the hook', () => {
      expect(run(claude('git reset --hard'), { GIT_GUARDRAILS_OFF: '1' }).out).toBe('');
    });
    it('<git common dir>/agents/guardrails.off disables the hook', () => {
      withFreshRepo();
      fs.mkdirSync(path.join(fx.repo, '.git', 'agents'));
      fs.writeFileSync(path.join(fx.repo, '.git', 'agents', 'guardrails.off'), '');
      expect(run(claude('git reset --hard')).out).toBe('');
      expect(run(copilot('git reset --hard')).out).toBe('');
    });
    it('ignores the old working-tree .agents/guardrails.off', () => {
      withFreshRepo();
      fs.mkdirSync(path.join(fx.repo, '.agents'));
      fs.writeFileSync(path.join(fx.repo, '.agents', 'guardrails.off'), '');
      expect(denied(run(claude('git reset --hard')))).toBe(true);
    });
    it('names the legacy .agents/guardrails.off in the deny reason and still denies', () => {
      withFreshRepo();
      fs.mkdirSync(path.join(fx.repo, '.agents'));
      fs.writeFileSync(path.join(fx.repo, '.agents', 'guardrails.off'), '');
      const r = run(claude('git reset --hard'));
      expect(denied(r)).toBe(true);
      expect(r.out).toContain('legacy .agents/guardrails.off is no longer read');
    });
    it('DROMOS_STATE_DIR/guardrails.off disables the hook and the override wins over the common dir', () => {
      withFreshRepo();
      const st = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-state-'));
      try {
        fs.writeFileSync(path.join(st, 'guardrails.off'), '');
        expect(run(claude('git reset --hard'), { DROMOS_STATE_DIR: st }).out).toBe('');
        fs.rmSync(path.join(st, 'guardrails.off'));
        fs.mkdirSync(path.join(fx.repo, '.git', 'agents'));
        fs.writeFileSync(path.join(fx.repo, '.git', 'agents', 'guardrails.off'), '');
        expect(denied(run(claude('git reset --hard'), { DROMOS_STATE_DIR: st }))).toBe(true);
      } finally {
        fs.rmSync(st, { recursive: true, force: true });
      }
    });
    it('the state dir of the main repository applies from a linked worktree', () => {
      withFreshRepo();
      const wt = path.join(fx.repo, '..', path.basename(fx.repo) + '-wt');
      git('worktree', 'add', '-q', '-b', 'wt-branch', wt);
      try {
        fs.mkdirSync(path.join(fx.repo, '.git', 'agents'));
        fs.writeFileSync(path.join(fx.repo, '.git', 'agents', 'guardrails.off'), '');
        expect(run(claude('git reset --hard', { cwd: wt })).out).toBe('');
      } finally {
        fs.rmSync(wt, { recursive: true, force: true });
      }
    });
    it('guardrails.off in the state dir applies from a subdirectory', () => {
      withFreshRepo();
      fs.mkdirSync(path.join(fx.repo, '.git', 'agents'));
      fs.writeFileSync(path.join(fx.repo, '.git', 'agents', 'guardrails.off'), '');
      fs.mkdirSync(path.join(fx.repo, 'sub'));
      expect(run(claude('git reset --hard', { cwd: path.join(fx.repo, 'sub') })).out).toBe('');
    });
  });
});
