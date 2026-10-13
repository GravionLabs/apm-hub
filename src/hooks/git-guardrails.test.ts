import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(__dirname, '../../packages/hooks/.apm/hooks/git-guardrails.sh');

const hermetic = (home: string, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => {
  const env = { ...base };
  for (const k of Object.keys(env)) if (k.startsWith('GIT_') || k === 'XDG_CONFIG_HOME') delete env[k];
  return { ...env, HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
};

describe('git-guardrails hook', () => {
  let repo: string;
  let home: string;

  const git = (...args: string[]) => spawnSync('git', args, { cwd: repo, encoding: 'utf8', env: hermetic(home) });

  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-home-'));
  });
  afterAll(() => fs.rmSync(home, { recursive: true, force: true }));

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
    git('init', '-q', '-b', 'feature');
    fs.writeFileSync(path.join(repo, 'a.txt'), 'base');
    git('add', 'a.txt');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
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

  const runRaw = (input: string, env: Record<string, string> = {}, base: NodeJS.ProcessEnv = process.env) => {
    const clean = hermetic(home, base);
    delete clean.GIT_GUARDRAILS_OFF;
    const r = spawnSync('bash', [SCRIPT], { input, encoding: 'utf8', env: { ...clean, ...env } });
    return { code: r.status, out: r.stdout.trim() };
  };
  const run = (payload: unknown, env: Record<string, string> = {}) => runRaw(JSON.stringify(payload), env);
  const denied = (r: { out: string }) => JSON.parse(r.out).permissionDecision === 'deny';

  // PATH with only bash, sed, tr, head, cat, git, grep: no jq
  const which = (bin: string) =>
    (process.env.PATH ?? '')
      .split(path.delimiter)
      .map((d) => path.join(d, bin))
      .find((f) => fs.existsSync(f));
  let nojq: string;
  beforeAll(() => {
    nojq = fs.mkdtempSync(path.join(os.tmpdir(), 'nojq-'));
    for (const b of ['bash', 'sed', 'tr', 'head', 'cat', 'git', 'grep']) fs.symlinkSync(fs.realpathSync(which(b)!), path.join(nojq, b));
  });
  afterAll(() => fs.rmSync(nojq, { recursive: true, force: true }));
  const runNoJq = (payload: unknown) => runRaw(JSON.stringify(payload), {}, { ...process.env, PATH: nojq });
  const dirty = () => fs.writeFileSync(path.join(repo, 'a.txt'), 'x'); // modifies a tracked file
  const untracked = () => fs.writeFileSync(path.join(repo, 'new.txt'), 'x');

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
    'git push origin HEAD:refs/heads/main -f',
    'git push origin +refs/heads/main',
    'git push -o x -f origin main',
    'git push --repo origin -f main',
    'git branch -d -f old',
    'git branch -df old',
    'git branch -fd old',
    'git branch --delete --force old',
    'env git reset --hard',
    'env FOO=1 -i git reset --hard',
    'env -u X git reset --hard',
    "bash -c 'git reset --hard'",
    'sh -c "git clean -fd"',
    "bash -lc 'cd x && git reset --hard'",
    "zsh -c \"bash -c 'git reset --hard'\"",
    'timeout 5 git reset --hard',
    'timeout -s KILL 5 git reset --hard',
    'echo x | xargs git reset --hard',
    'echo x | xargs -n 1 git branch -D',
    'nohup git reset --hard',
    'nice -n 5 git reset --hard',
    'sudo -u bob git reset --hard',
    'echo `git reset --hard`',
    'echo $(git reset --hard)',
    'echo "x $(git reset --hard)"',
    'eval "git reset --hard"',
    'bash <<EOF\ngit reset --hard\nEOF',
    'sh <<-EOF\n\tgit clean -fd\nEOF',
    'cat <<EOF\n$(git reset --hard)\nEOF',
    'cat <<EOF\n`git reset --hard`\nEOF',
    'sh <<< "git reset --hard"',
    'bash <<<"git push -f origin main"',
    '(( x<<2 ))\ngit reset --hard',
    'echo $((1<<2))\ngit reset --hard',
    "echo $'it\\'s'; git reset --hard",
    'git reset --hard>/dev/null',
    'git push -f origin main>/dev/null',
    'git reset --hard 2>&1',
    'g""it reset --hard',
    'g\\it reset --hard',
    "'git' reset --hard",
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
    'git commit -m "fix; git reset --hard"',
    "git commit -m 'a && git clean -fd'",
    'git commit -m "$(cat <<\'EOF\'\nfix: thing\n\ngit reset --hard; git push -f origin main\nEOF\n)"',
    'git log --format="%s | git reset --hard"',
    'git -C',
    'git push -o force origin feature',
    'git push -f origin HEAD',
    'git push -f origin @',
    'echo "git reset --hard"',
    'bash -c "git status"',
    'env FOO=1 git status',
    'timeout 5 git status',
    'cat <<EOF\ngit reset --hard\nEOF',
    "cat <<'EOF'\n$(git reset --hard)\nEOF",
    'bash <<EOF\ngit status\nEOF',
    'git commit -F - <<EOF\nfix: mention git reset --hard\nEOF',
    'echo $((1<<2))\ngit status',
    "echo $'it\\'s; git reset --hard'",
    'git push -f origin feature>/dev/null',
    'git status 2>&1',
    'cat <<EOF >out.txt\ngit reset --hard\nEOF',
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
  it.each(['', 'not json', '{"tool_name":"Bash","tool_input":{"comm', '{"tool_name":"Bash"}', 'null', '[]'])(
    'fails open on malformed raw stdin %j',
    (raw) => {
      expect(runRaw(raw)).toEqual({ code: 0, out: '' });
    },
  );
  it('passes on an empty object payload', () => {
    expect(run({}).out).toBe('');
  });
  it('git -C as the last token terminates', () => {
    expect(run(claude('git -C')).out).toBe('');
    expect(run(claude('git -c')).out).toBe('');
  });
  it('resolves HEAD to the current protected branch', () => {
    git('checkout', '-q', '-b', 'release/2.0');
    expect(denied(run(claude('git push -f origin HEAD')))).toBe(true);
    expect(denied(run(claude('git push --force-with-lease origin HEAD')))).toBe(true);
    expect(denied(run(claude('git push -f origin @')))).toBe(true);
    expect(denied(run(claude('git push origin HEAD:release/2.0 --force-with-lease')))).toBe(true);
    expect(run(claude('git push origin HEAD')).out).toBe('');
    expect(run(claude('git push -f origin HEAD:feature')).out).toBe('');
  });
  it('tracks git -C for the dirty check', () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-other-'));
    try {
      const env = hermetic(home);
      spawnSync('git', ['init', '-q', other], { env });
      fs.writeFileSync(path.join(other, 'b.txt'), 'x');
      spawnSync('git', ['-C', other, 'add', 'b.txt'], { env });
      spawnSync('git', ['-C', other, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'i'], { env });
      fs.writeFileSync(path.join(other, 'b.txt'), 'y');
      expect(run(claude(`git -C ${other} checkout .`)).out).not.toBe('');
      dirty();
      expect(run(claude(`git -C ${other} status`)).out).toBe('');
      fs.writeFileSync(path.join(other, 'b.txt'), 'x');
      expect(run(claude(`git -C ${other} checkout .`)).out).toBe('');
      expect(denied(run(claude('git checkout .')))).toBe(true);
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });
  it('explains the reason and escapes quotes in the deny JSON', () => {
    expect(JSON.parse(run(claude('git reset --hard')).out).permissionDecisionReason).toContain('git reset --hard');
    expect(JSON.parse(run(claude('git clean -fd')).out).permissionDecisionReason).toContain('git clean -f');
    git('checkout', '-q', '-b', 'release/a"b');
    const r = run(claude('git push -f'));
    expect(JSON.parse(r.out).permissionDecisionReason).toContain('release/a"b');
  });
  it('denies a dirty checkout inside a wrapper and a chain', () => {
    dirty();
    expect(denied(run(claude("bash -c 'git checkout .'")))).toBe(true);
    expect(denied(run(claude('echo a; env X=1 git restore .')))).toBe(true);
  });
  it('accepts toolArgs given as an object', () => {
    const p = { toolName: 'bash', toolArgs: { command: 'git reset --hard' }, cwd: repo };
    expect(JSON.parse(run(p).out).permissionDecision).toBe('deny');
  });

  describe('without jq', () => {
    it('has no jq on the restricted PATH', () => {
      expect(fs.existsSync(path.join(nojq, 'jq'))).toBe(false);
    });
    it.each(['git reset --hard', 'git push --force origin main', 'git clean -fd', "bash -c 'git reset --hard'"])(
      'denies a whole-command %s for Claude and Copilot',
      (c) => {
        expect(denied(runNoJq(claude(c)))).toBe(true);
        expect(denied(runNoJq(copilot(c)))).toBe(true);
      },
    );
    it('denies the literal payloads from the review', () => {
      expect(denied(runRaw('{"tool_name":"Bash","tool_input":{"command":"git reset --hard"}}', {}, { ...process.env, PATH: nojq }))).toBe(true);
      expect(denied(runRaw('{"toolName":"bash","toolArgs":"{\\"command\\":\\"git reset --hard\\"}"}', {}, { ...process.env, PATH: nojq }))).toBe(true);
    });
    it.each(['git status', 'git push --force origin feature', 'git commit -m "x; git reset --hard"', 'ls'])('passes %s', (c) => {
      expect(runNoJq(claude(c)).out).toBe('');
      expect(runNoJq(copilot(c)).out).toBe('');
    });
    it('ignores non-Bash tools', () => {
      expect(runNoJq({ tool_name: 'Read', tool_input: { command: 'git reset --hard' }, cwd: repo }).out).toBe('');
      expect(runNoJq({ toolName: 'view', toolArgs: '{"command":"git reset --hard"}', cwd: repo }).out).toBe('');
    });
    it('decodes JSON escapes in the command', () => {
      expect(denied(runNoJq(claude('echo "a\tb"\ngit reset --hard')))).toBe(true);
      expect(denied(runNoJq(claude('echo \\"\n git reset --hard')))).toBe(true);
    });
    it('does not let a cwd inside the command override the real one', () => {
      fs.mkdirSync(path.join(repo, '.agents'));
      fs.writeFileSync(path.join(repo, '.agents', 'guardrails.off'), '');
      const other = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-cwd-'));
      try {
        expect(runNoJq({ tool_name: 'Bash', tool_input: { command: 'git reset --hard' }, cwd: other }).out).not.toBe('');
        const p = { tool_name: 'Bash', tool_input: { command: `echo '"cwd":"${other}"'; git reset --hard` }, cwd: repo };
        expect(runNoJq(p).out).toBe('');
      } finally {
        fs.rmSync(other, { recursive: true, force: true });
      }
    });
    it('denies heredoc and parser cases', () => {
      for (const c of ['bash <<EOF\ngit reset --hard\nEOF', 'cat <<EOF\n$(git reset --hard)\nEOF', 'sh <<< "git reset --hard"', '(( x<<2 ))\ngit reset --hard', "echo $'it\\'s'; git reset --hard", 'git reset --hard>/dev/null', 'g""it reset --hard'])
        expect(denied(runNoJq(claude(c)))).toBe(true);
    });
    it('resolves HEAD to the current protected branch', () => {
      git('checkout', '-q', '-b', 'release/2.0');
      expect(denied(runNoJq(claude('git push -f origin HEAD')))).toBe(true);
      expect(runNoJq(claude('git push origin HEAD')).out).toBe('');
    });
    it('denies a dirty checkout only when dirty', () => {
      expect(runNoJq(claude('git checkout .')).out).toBe('');
      dirty();
      expect(denied(runNoJq(claude('git checkout .')))).toBe(true);
    });
    it('honours both opt-outs', () => {
      expect(runRaw(JSON.stringify(claude('git reset --hard')), { GIT_GUARDRAILS_OFF: '1' }, { ...process.env, PATH: nojq }).out).toBe('');
      fs.mkdirSync(path.join(repo, '.agents'));
      fs.writeFileSync(path.join(repo, '.agents', 'guardrails.off'), '');
      expect(runNoJq(claude('git reset --hard')).out).toBe('');
    });
    it('passes malformed input', () => {
      expect(runRaw('', {}, { ...process.env, PATH: nojq })).toEqual({ code: 0, out: '' });
      expect(runRaw('{"tool_name":"Bash","tool_input":{"comm', {}, { ...process.env, PATH: nojq })).toEqual({ code: 0, out: '' });
    });
  });

  describe('performance and limits', () => {
    const msg = Array.from({ length: 560 }, (_, i) => `line ${i} of a long commit message with some words`).join('\n');
    const timed = (fn: () => { out: string }) => {
      const t = Date.now();
      const r = fn();
      return { r, ms: Date.now() - t };
    };
    const big = [`git commit -m "$(cat <<'EOF'\n${msg}\nEOF\n)"`, `git commit -m '${msg}'`, `git commit -F - <<EOF\n${msg}\nEOF`];
    it.each(big)('scans a ~30 KB commit quickly with jq', (c) => {
      expect(c.length).toBeGreaterThan(25000);
      const { r, ms } = timed(() => run(claude(c)));
      expect(r.out).toBe('');
      expect(ms).toBeLessThan(3000);
    });
    it.each(big)('scans a ~30 KB commit quickly without jq', (c) => {
      const { r, ms } = timed(() => runNoJq(claude(c)));
      expect(r.out).toBe('');
      expect(ms).toBeLessThan(3000);
    });
    it('still denies a destructive command after a long heredoc', () => {
      const c = `git commit -m "$(cat <<'EOF'\n${msg}\nEOF\n)" && git reset --hard`;
      expect(denied(run(claude(c)))).toBe(true);
      expect(denied(runNoJq(claude(c)))).toBe(true);
    });
    it('fails open above 64 KB', () => {
      const c = `git reset --hard # ${'x'.repeat(66000)}`;
      expect(run(claude(c)).out).toBe('');
    });
  });

  describe('hardening', () => {
    it('does not run a core.fsmonitor helper from a hostile repo', () => {
      const evil = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-evil-'));
      const marker = path.join(evil, 'pwned');
      try {
        spawnSync('git', ['init', '-q', evil], { env: hermetic(home) });
        fs.writeFileSync(path.join(evil, 'hook.sh'), `#!/bin/sh\ntouch ${marker}\n`, { mode: 0o755 });
        spawnSync('git', ['-C', evil, 'config', 'core.fsmonitor', path.join(evil, 'hook.sh')], { env: hermetic(home) });
        run(claude(`git -C ${evil} checkout .`));
        expect(fs.existsSync(marker)).toBe(false);
      } finally {
        fs.rmSync(evil, { recursive: true, force: true });
      }
    });
    it('ignores untracked files for the checkout . dirty check', () => {
      untracked();
      expect(run(claude('git checkout .')).out).toBe('');
    });
  });

  describe('opt-out', () => {
    it('GIT_GUARDRAILS_OFF=0 does not disable the hook', () => {
      expect(denied(run(claude('git reset --hard'), { GIT_GUARDRAILS_OFF: '0' }))).toBe(true);
    });
    it('GIT_GUARDRAILS_OFF=1 disables the hook for Copilot payloads and without jq', () => {
      expect(run(copilot('git reset --hard'), { GIT_GUARDRAILS_OFF: '1' }).out).toBe('');
    });
    it('an inline GIT_GUARDRAILS_OFF=1 in the command does not disable the hook', () => {
      expect(denied(run(claude('GIT_GUARDRAILS_OFF=1 git reset --hard')))).toBe(true);
    });
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
