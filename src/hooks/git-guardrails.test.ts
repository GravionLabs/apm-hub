import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(__dirname, '../../packages/hooks/.apm/hooks/git-guardrails.sh');

describe('git-guardrails hook', () => {
  let repo: string;

  const git = (...args: string[]) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
    git('init', '-q', '-b', 'feature');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  const claude = (command: string, extra: object = {}) => ({
    tool_name: 'Bash',
    tool_input: { command },
    cwd: repo,
    ...extra,
  });
  const copilot = (command: string) => ({
    toolName: 'bash',
    toolArgs: JSON.stringify({ command }),
    cwd: repo,
  });

  const run = (payload: unknown, env: Record<string, string> = {}) => {
    const r = spawnSync('bash', [SCRIPT], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
    return { code: r.status, out: r.stdout.trim() };
  };
  const dirty = () => fs.writeFileSync(path.join(repo, 'a.txt'), 'x');

  const blocked = [
    'git push --force origin main',
    'git push -f origin main',
    'git push --force-with-lease origin main',
    'git push --force-with-lease=main origin main',
    'git push --force origin release/2.1',
    'git push origin +main',
    'git push origin HEAD:main --force',
    'git push --delete origin release/2.1',
    'git push origin :main',
    'git reset --hard',
    'git reset --hard HEAD~1',
    'git clean -f',
    'git clean -fd',
    'git branch -D old',
    'cd x && git reset --hard',
    'echo hi; git -C . reset --hard',
    'FOO=1 git reset --hard',
  ];
  const allowed = [
    'git push --force origin feature',
    'git push -f origin feat/199-x',
    'git push --force-with-lease origin feature',
    'git push origin main',
    'git push --delete origin feature',
    'git reset --soft HEAD~1',
    'git reset HEAD file',
    'git clean -n',
    'git clean -nfd',
    'git branch -d merged',
    'git status',
    'git commit -m "docs: mention git reset"',
    'ls -la',
    'cd x && git status',
    'git restore --staged .',
    'git checkout -- .',
  ];

  describe.each([
    ['Claude', claude],
    ['Copilot', copilot],
  ] as const)('%s payload', (_n, mk) => {
    it.each(blocked)('denies %s', (c) => {
      const r = run(mk(c));
      expect(r.code).toBe(0);
      const j = JSON.parse(r.out);
      expect(j.permissionDecision).toBe('deny');
      expect(j.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(j.hookSpecificOutput.hookEventName).toBe('PreToolUse');
      expect(j.permissionDecisionReason).not.toContain('\n');
    });
    it.each(allowed)('passes %s', (c) => {
      const r = run(mk(c));
      expect(r).toEqual({ code: 0, out: '' });
    });
  });

  it('denies a bare force push while on main', () => {
    git('checkout', '-q', '-b', 'main');
    expect(JSON.parse(run(claude('git push --force')).out).permissionDecision).toBe('deny');
    expect(JSON.parse(run(claude('git push -f origin')).out).permissionDecision).toBe('deny');
  });
  it('passes a bare force push on a feature branch', () => {
    expect(run(claude('git push --force')).out).toBe('');
  });

  it.each(['git checkout -- .', 'git checkout .', 'git restore .', 'git restore --worktree .'])(
    'denies %s only with uncommitted changes',
    (c) => {
      expect(run(claude(c)).out).toBe('');
      dirty();
      expect(JSON.parse(run(claude(c)).out).permissionDecision).toBe('deny');
      expect(JSON.parse(run(copilot(c)).out).permissionDecision).toBe('deny');
    },
  );
  it('allows restore --staged . even when dirty', () => {
    dirty();
    expect(run(claude('git restore --staged .')).out).toBe('');
  });
  it('treats a directory change before checkout . as possibly dirty', () => {
    expect(JSON.parse(run(claude('cd other && git checkout -- .')).out).permissionDecision).toBe('deny');
  });

  it('ignores other tools', () => {
    expect(run({ tool_name: 'Read', tool_input: { command: 'git reset --hard' }, cwd: repo }).out).toBe('');
    expect(run({ toolName: 'view', toolArgs: '{"command":"git reset --hard"}', cwd: repo }).out).toBe('');
  });
  it('passes on empty or invalid payloads', () => {
    expect(run('').out).toBe('');
    expect(run({}).out).toBe('');
  });
  it('accepts toolArgs given as an object', () => {
    const p = { toolName: 'bash', toolArgs: { command: 'git reset --hard' }, cwd: repo };
    expect(JSON.parse(run(p).out).permissionDecision).toBe('deny');
  });

  describe('opt-out', () => {
    it('GIT_GUARDRAILS_OFF=1 disables the hook', () => {
      expect(run(claude('git reset --hard'), { GIT_GUARDRAILS_OFF: '1' }).out).toBe('');
    });
    it('.agents/guardrails.off disables the hook', () => {
      fs.mkdirSync(path.join(repo, '.agents'));
      fs.writeFileSync(path.join(repo, '.agents', 'guardrails.off'), '');
      expect(run(claude('git reset --hard')).out).toBe('');
      expect(run(copilot('git reset --hard')).out).toBe('');
    });
    it('.agents/guardrails.off in the repo root applies from a subdirectory', () => {
      fs.mkdirSync(path.join(repo, '.agents'));
      fs.writeFileSync(path.join(repo, '.agents', 'guardrails.off'), '');
      fs.mkdirSync(path.join(repo, 'sub'));
      expect(run(claude('git reset --hard', { cwd: path.join(repo, 'sub') })).out).toBe('');
    });
  });
});
