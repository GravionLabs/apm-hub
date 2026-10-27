import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createGuardFixture, hermetic } from '../../helpers/git-guardrails-fixture';

describe('git-guardrails hook', () => {
  const fx = createGuardFixture();
  const { git, withFreshRepo, claude, run, denied, runNoJq, dirty } = fx;

  describe('git -C targets', () => {
    let other: string;
    const initRepo = (dir: string, branch = 'feature') => {
      const env = hermetic(fx.home);
      spawnSync('git', ['init', '-q', '-b', branch, dir], { env });
      fs.writeFileSync(path.join(dir, 'b.txt'), 'x');
      spawnSync('git', ['-C', dir, 'add', 'b.txt'], { env });
      spawnSync(
        'git',
        ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'i'],
        { env }
      );
    };
    beforeEach(() => {
      other = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-other-'));
    });
    afterEach(() => fs.rmSync(other, { recursive: true, force: true }));

    it('counts checkout . in another repository as dirty, even when it is clean', () => {
      initRepo(other);
      const r = run(claude(`git -C ${other} checkout .`));
      expect(denied(r)).toBe(true);
      expect(JSON.parse(r.out).permissionDecisionReason).toContain('not inspected');
      expect(run(claude(`git -C ${other} status`)).out).toBe('');
    });
    it('checks the session repository itself for -C . and -C <subdir>', () => {
      withFreshRepo();
      fs.mkdirSync(path.join(fx.repo, 'sub'));
      expect(run(claude('git -C . checkout .')).out).toBe('');
      expect(run(claude(`git -C ${fx.repo} checkout .`)).out).toBe('');
      expect(run(claude('git -C sub checkout .')).out).toBe('');
      dirty();
      expect(denied(run(claude('git -C sub checkout .')))).toBe(true);
    });
    it('treats a nested repository inside the session repo as another repository', () => {
      withFreshRepo();
      const nested = path.join(fx.repo, 'nested');
      fs.mkdirSync(nested);
      initRepo(nested);
      expect(denied(run(claude('git -C nested checkout .')))).toBe(true);
    });
    it('reads the branch of another repository from its HEAD file for a bare force push', () => {
      initRepo(other, 'main');
      expect(denied(run(claude(`git -C ${other} push -f`)))).toBe(true);
      expect(denied(runNoJq(claude(`git -C ${other} push -f origin HEAD`)))).toBe(true);
      const feat = path.join(other, 'feat');
      initRepo(feat, 'topic');
      expect(run(claude(`git -C ${feat} push -f`)).out).toBe('');
    });
    it('blocks a bare force push when the branch cannot be read', () => {
      const r = run(claude(`git -C ${other} push -f`));
      expect(JSON.parse(r.out).permissionDecisionReason).toContain('unknown branch');
    });
  });
  it('explains the reason and escapes quotes in the deny JSON', () => {
    withFreshRepo();
    expect(JSON.parse(run(claude('git reset --hard')).out).permissionDecisionReason).toContain(
      'git reset --hard'
    );
    expect(JSON.parse(run(claude('git clean -fd')).out).permissionDecisionReason).toContain(
      'git clean -f'
    );
    git('checkout', '-q', '-b', 'release/a"b');
    const r = run(claude('git push -f'));
    expect(JSON.parse(r.out).permissionDecisionReason).toContain('release/a"b');
  });
  it('denies a dirty checkout inside a wrapper and a chain', () => {
    withFreshRepo();
    dirty();
    expect(denied(run(claude("bash -c 'git checkout .'")))).toBe(true);
    expect(denied(run(claude('echo a; env X=1 git restore .')))).toBe(true);
  });
  it('accepts toolArgs given as an object', () => {
    const p = { toolName: 'bash', toolArgs: { command: 'git reset --hard' }, cwd: fx.repo };
    expect(JSON.parse(run(p).out).permissionDecision).toBe('deny');
  });
});
