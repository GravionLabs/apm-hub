import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(__dirname, '../../../packages/hooks/.apm/hooks/git-guardrails.sh');

// macOS ships bash 3.2, where the hook's character scanner is quadratic on long commands (~100 s for 22 KB instead of < 6 s).
// The time-bound tests only make sense on bash >= 4; the functional tests above run everywhere.
const bashMajor = Number(spawnSync('bash', ['-c', 'echo ${BASH_VERSINFO[0]}'], { encoding: 'utf8' }).stdout.trim());
const slowBash = !(bashMajor >= 4);

const hermetic = (home: string, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => {
  const env = { ...base };
  for (const k of Object.keys(env)) if (k.startsWith('GIT_') || k === 'XDG_CONFIG_HOME') delete env[k];
  return { ...env, HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
};

describe('git-guardrails hook', () => {
  let repo: string; // the repository the current test works on: the shared fixture, or a fresh copy
  let shared: string;
  let fresh: string | undefined;
  let home: string;

  const git = (...args: string[]) => spawnSync('git', args, { cwd: repo, encoding: 'utf8', env: hermetic(home) });

  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-home-'));
  });
  afterAll(() => fs.rmSync(home, { recursive: true, force: true }));

  // One clean committed fixture repo for the whole describe (one `git init` + commit). A test that changes the repository
  // (dirty(), untracked(), branch switches, files in .git, worktrees, new directories) calls withFreshRepo() first: it
  // copies the fixture (no git process) and the afterEach below removes the copy and points `repo` back at the fixture.
  beforeAll(() => {
    shared = repo = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
    git('init', '-q', '-b', 'feature');
    fs.writeFileSync(path.join(repo, 'a.txt'), 'base');
    git('add', 'a.txt');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
  });
  afterAll(() => fs.rmSync(shared, { recursive: true, force: true }));
  const withFreshRepo = () => {
    fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
    fs.cpSync(shared, fresh, { recursive: true });
    repo = fresh;
  };
  afterEach(() => {
    if (fresh) fs.rmSync(fresh, { recursive: true, force: true });
    fresh = undefined;
    repo = shared;
  });

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
    'git push origin :release/2.1',
    'git push --delete origin release/next-x',
    'git push --delete origin release/next/x',
    'git push origin :release/next-x',
    'git push --force origin release/next',
    'git push origin +release/next',
    'git push origin +refs/heads/release/next',
    'git push -f --delete origin release/next',
    'git push origin +:release/next',
    'git push --delete origin main release/next',
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
    // pipes into a shell, process substitution read by a shell
    "echo 'git reset --hard' | sh",
    'echo git reset --hard | bash -s',
    "printf 'git reset --hard\\n' | bash",
    "echo 'git reset --hard' | sh -",
    "echo 'git reset --hard' |& sh",
    "echo 'git reset --hard' |\n sh",
    'cat <<EOF | bash\ngit reset --hard\nEOF',
    "cat <<'EOF' | sh\ngit clean -fd\nEOF",
    "source <(echo 'git reset --hard')",
    '. <(echo git reset --hard)',
    'bash <(echo git reset --hard)',
    // wrappers
    'stdbuf -oL git reset --hard',
    'stdbuf -o L git reset --hard',
    'flock /tmp/l git reset --hard',
    'flock -w 5 /tmp/l git reset --hard',
    "flock /tmp/l -c 'git reset --hard'",
    "su -c 'git reset --hard' bob",
    "su bob -c 'git reset --hard'",
    "su - bob -lc 'git clean -fd'",
    "script -qc 'git reset --hard' /dev/null",
    "script --command='git reset --hard'",
    'chronic git reset --hard',
    'unbuffer -p git reset --hard',
    // git -c alias.*
    "git -c alias.x='reset --hard' x",
    "git -c alias.x='!git reset --hard' x",
    "git -c alias.nuke='push -f origin' nuke main",
    "git -c Alias.y='clean -fd' status",
    // options end at --
    'git clean -f -- -n',
    // another repository is never inspected with git: counts as dirty
    'git --git-dir=/tmp/x/.git checkout .',
    'git --work-tree=/tmp restore -- .',
    'GIT_DIR=/tmp/x git restore .',
    'env GIT_WORK_TREE=/tmp git checkout .',
    'git --git-dir=/tmp/x push -f origin HEAD',
  ];
  const allowed = [
    'git push --force origin feature',
    'git push -f origin feat/199-x',
    'git push --force-with-lease origin feature',
    'git push origin main',
    'git push --delete origin feature',
    'git push --delete origin release/next',
    'git push origin :release/next',
    'git push origin :refs/heads/release/next',
    'git push --delete origin refs/heads/release/next',
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
    "cat <<'EOF' > f\ngit reset --hard\nEOF",
    'git log | head',
    "git log --oneline | sh -c 'cat'",
    "echo 'git reset --hard' | cat",
    "echo 'git reset --hard' | bash script.sh",
    "echo 'git reset --hard' || sh",
    "echo 'git push' | sh",
    'cat <<EOF | bash\ngit status\nEOF',
    'source <(echo git status)',
    'stdbuf -oL git status',
    'flock /tmp/l git status',
    "su -c 'git status'",
    'git -c alias.x=status x',
    'git -c alias.co=checkout co feature',
    'git -c core.pager=cat status',
    'git clean -n -- -f',
    'git restore ./',
    'git -C . checkout .',
    'git -C . push -f',
  ];

  // The runs of the two tables are independent of each other and of the repository state (clean fixture): run them once,
  // concurrently, in a beforeAll; every `it` below asserts on the result of its own command.
  const payloads = [
    ['Claude', claude],
    ['Copilot', copilot],
  ] as const;
  const tableRuns = new Map<string, { code: number | null; out: string }>();
  const runAsync = (payload: unknown) =>
    new Promise<{ code: number | null; out: string }>((resolve) => {
      const clean = hermetic(home);
      delete clean.GIT_GUARDRAILS_OFF;
      const child = spawn('bash', [SCRIPT], { env: clean });
      let out = '';
      child.stdout.on('data', (d) => (out += d));
      child.on('close', (code) => resolve({ code, out: out.trim() }));
      child.stdin.end(JSON.stringify(payload));
    });
  beforeAll(async () => {
    const jobs = payloads.flatMap(([n, mk]) => [...blocked, ...allowed].map((c) => [`${n}\0${c}`, mk(c)] as const));
    let next = 0;
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        while (next < jobs.length) {
          const [k, payload] = jobs[next++];
          tableRuns.set(k, await runAsync(payload));
        }
      }),
    );
  }, 60000);

  describe.each(payloads)('%s payload', (n) => {
    it.each(blocked)('denies %s', (c) => {
      const r = tableRuns.get(`${n}\0${c}`)!;
      expect(r.code).toBe(0);
      const j = JSON.parse(r.out);
      expect(j.permissionDecision).toBe('deny');
      expect(j.hookSpecificOutput.permissionDecision).toBe('deny');
      expect(j.hookSpecificOutput.hookEventName).toBe('PreToolUse');
      expect(j.permissionDecisionReason).not.toContain('\n');
    });
    it.each(allowed)('passes %s', (c) => {
      const r = tableRuns.get(`${n}\0${c}`)!;
      expect(r).toEqual({ code: 0, out: '' });
    });
  });

  it('denies a bare force push while on main', () => {
    withFreshRepo();
    git('checkout', '-q', '-b', 'main');
    expect(JSON.parse(run(claude('git push --force')).out).permissionDecision).toBe('deny');
    expect(JSON.parse(run(claude('git push -f origin')).out).permissionDecision).toBe('deny');
  });
  it('passes a bare force push on a feature branch', () => {
    expect(run(claude('git push --force')).out).toBe('');
  });

  it.each([
    'git checkout -- .',
    'git checkout .',
    'git restore .',
    'git restore --worktree .',
    'git checkout ./',
    'git restore -- ./',
    'git restore ..',
    'git checkout -- ./.',
    'git -c alias.co=checkout co -- ./',
  ])(
    'denies %s only with uncommitted changes',
    (c) => {
      withFreshRepo();
      expect(run(claude(c)).out).toBe('');
      dirty();
      expect(JSON.parse(run(claude(c)).out).permissionDecision).toBe('deny');
      expect(JSON.parse(run(copilot(c)).out).permissionDecision).toBe('deny');
    },
  );
  it('allows restore --staged . even when dirty', () => {
    withFreshRepo();
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
    withFreshRepo();
    git('checkout', '-q', '-b', 'release/2.0');
    expect(denied(run(claude('git push -f origin HEAD')))).toBe(true);
    expect(denied(run(claude('git push --force-with-lease origin HEAD')))).toBe(true);
    expect(denied(run(claude('git push -f origin @')))).toBe(true);
    expect(denied(run(claude('git push origin HEAD:release/2.0 --force-with-lease')))).toBe(true);
    expect(run(claude('git push origin HEAD')).out).toBe('');
    expect(run(claude('git push -f origin HEAD:feature')).out).toBe('');
  });
  it('deleting HEAD on the remote is allowed only on release/next', () => {
    withFreshRepo();
    git('checkout', '-q', '-b', 'release/next');
    expect(run(claude('git push --delete origin HEAD')).out).toBe('');
    git('checkout', '-q', '-b', 'release/2.1');
    expect(denied(run(claude('git push --delete origin HEAD')))).toBe(true);
    git('checkout', '-q', 'main');
    expect(denied(run(claude('git push --delete origin HEAD')))).toBe(true);
  });
  describe('git -C targets', () => {
    let other: string;
    const initRepo = (dir: string, branch = 'feature') => {
      const env = hermetic(home);
      spawnSync('git', ['init', '-q', '-b', branch, dir], { env });
      fs.writeFileSync(path.join(dir, 'b.txt'), 'x');
      spawnSync('git', ['-C', dir, 'add', 'b.txt'], { env });
      spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'i'], { env });
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
      fs.mkdirSync(path.join(repo, 'sub'));
      expect(run(claude('git -C . checkout .')).out).toBe('');
      expect(run(claude(`git -C ${repo} checkout .`)).out).toBe('');
      expect(run(claude('git -C sub checkout .')).out).toBe('');
      dirty();
      expect(denied(run(claude('git -C sub checkout .')))).toBe(true);
    });
    it('treats a nested repository inside the session repo as another repository', () => {
      withFreshRepo();
      const nested = path.join(repo, 'nested');
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
    expect(JSON.parse(run(claude('git reset --hard')).out).permissionDecisionReason).toContain('git reset --hard');
    expect(JSON.parse(run(claude('git clean -fd')).out).permissionDecisionReason).toContain('git clean -f');
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
      withFreshRepo();
      fs.mkdirSync(path.join(repo, '.git', 'agents'));
      fs.writeFileSync(path.join(repo, '.git', 'agents', 'guardrails.off'), '');
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
      withFreshRepo();
      git('checkout', '-q', '-b', 'release/2.0');
      expect(denied(runNoJq(claude('git push -f origin HEAD')))).toBe(true);
      expect(runNoJq(claude('git push origin HEAD')).out).toBe('');
    });
    it('denies a dirty checkout only when dirty', () => {
      withFreshRepo();
      expect(runNoJq(claude('git checkout .')).out).toBe('');
      dirty();
      expect(denied(runNoJq(claude('git checkout .')))).toBe(true);
    });
    it('honours both opt-outs', () => {
      withFreshRepo();
      expect(runRaw(JSON.stringify(claude('git reset --hard')), { GIT_GUARDRAILS_OFF: '1' }, { ...process.env, PATH: nojq }).out).toBe('');
      fs.mkdirSync(path.join(repo, '.git', 'agents'));
      fs.writeFileSync(path.join(repo, '.git', 'agents', 'guardrails.off'), '');
      expect(runNoJq(claude('git reset --hard')).out).toBe('');
    });
    it('passes malformed input', () => {
      expect(runRaw('', {}, { ...process.env, PATH: nojq })).toEqual({ code: 0, out: '' });
      expect(runRaw('{"tool_name":"Bash","tool_input":{"comm', {}, { ...process.env, PATH: nojq })).toEqual({ code: 0, out: '' });
    });
  });

  describe.skipIf(slowBash)('performance and limits', () => {
    const CAP = 24576;
    // Wall-clock bound per hook run; CI runners are 2-3x slower than a developer machine (#247), and a loaded local run (parallel suites) too (#336).
    const BOUND = process.env.CI ? 9000 : 6000;
    const msg = Array.from({ length: 440 }, (_, i) => `line ${i} of a long commit message with some words`).join('\n');
    const timed = (fn: () => { out: string }) => {
      const t = Date.now();
      const r = fn();
      return { r, ms: Date.now() - t };
    };
    const big = [`git commit -m "$(cat <<'EOF'\n${msg}\nEOF\n)"`, `git commit -m '${msg}'`, `git commit -F - <<EOF\n${msg}\nEOF`];
    it.each(big)('scans a ~22 KB commit quickly with jq', (c) => {
      expect(c.length).toBeGreaterThan(21000);
      expect(c.length).toBeLessThan(CAP);
      const { r, ms } = timed(() => run(claude(c)));
      expect(r.out).toBe('');
      expect(ms).toBeLessThan(BOUND);
    });
    it.each(big)('scans a ~22 KB commit quickly without jq', (c) => {
      const { r, ms } = timed(() => runNoJq(claude(c)));
      expect(r.out).toBe('');
      expect(ms).toBeLessThan(BOUND);
    });
    it('still denies a destructive command after a long heredoc', () => {
      const c = `git commit -m "$(cat <<'EOF'\n${msg}\nEOF\n)" && git reset --hard`;
      expect(denied(run(claude(c)))).toBe(true);
      expect(denied(runNoJq(claude(c)))).toBe(true);
    });

    // worst-case shapes just below the cap: every one ends in a destructive command that must still be found
    const tail = '\ngit reset --hard';
    const fill = (unit: string, head = '') => head + unit.repeat(Math.floor((CAP - 200 - head.length) / unit.length)) + tail;
    const shapes: [string, string][] = [
      ['many words', fill('a ', 'echo ')],
      ['many single quotes', fill("'a' ", 'echo ')],
      ['many double quotes', fill('"a" ', 'echo ')],
      ['many escaped quotes', fill('\\" ', 'echo ')],
      ['many lines', fill('a\n')],
      ['many comments', fill('#\n')],
      ['many pipes', fill('a | ')],
      ['many separators', fill(';', 'a')],
      ['repeated ((', fill('((x)) ')],
      ['repeated $((', fill('$((1)) ', 'echo ')],
      ['many substitutions', fill('$(git status) ', 'echo ')],
      ['many backticks', fill('`a` ', 'echo ')],
      ['many heredocs', fill('cat <<E\nE\n')],
      ['an 11000-line heredoc', `cat <<EOF\n${'x\n'.repeat(11000)}EOF${tail}`],
      ['an 8000-line <<- heredoc', `cat <<-EOF\n${'\tx\n'.repeat(8000)}\tEOF${tail}`],
      ['many echo | sh', fill("echo 'a' | sh\n")],
    ];
    it.each(shapes)('denies after %s within the time bound, with and without jq', (_n, c) => {
      expect(c.length).toBeLessThanOrEqual(CAP);
      for (const fn of [run, runNoJq]) {
        const { r, ms } = timed(() => fn(claude(c)));
        expect(denied(r)).toBe(true);
        expect(ms).toBeLessThan(BOUND);
      }
    }, 3 * BOUND);
    it('fails open above 24 KB, quickly, also for a 30000-line heredoc', () => {
      expect(run(claude(`git reset --hard # ${'x'.repeat(CAP)}`)).out).toBe('');
      const c = `cat <<EOF\n${'x\n'.repeat(30000)}EOF${tail}`;
      const { r, ms } = timed(() => runNoJq(claude(c)));
      expect(r.out).toBe('');
      expect(ms).toBeLessThan(BOUND);
    });
    it('denies nesting deeper than 24 levels with a reason', () => {
      const deep = (k: number) => `echo ${'$(echo '.repeat(k)}x${')'.repeat(k)}; git status`;
      expect(run(claude(deep(20))).out).toBe('');
      const r = run(claude(deep(30)));
      expect(denied(r)).toBe(true);
      expect(JSON.parse(r.out).permissionDecisionReason).toContain('deeper than 24 levels');
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
    it('does not run a .gitattributes clean filter of a repo given via git -C', () => {
      const evil = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-filter-'));
      const marker = path.join(evil, 'PWNED');
      const env = hermetic(home);
      try {
        spawnSync('git', ['init', '-q', '-b', 'feature', evil], { env });
        fs.writeFileSync(path.join(evil, '.gitattributes'), 'f filter=x\n');
        fs.writeFileSync(path.join(evil, 'f'), 'a\n');
        spawnSync('git', ['-C', evil, 'add', '.'], { env });
        spawnSync('git', ['-C', evil, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'i'], { env });
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
      const bare = () => path.join(repo, 'bare.git');
      const stale = () => fs.utimesSync(path.join(wt, 'f'), new Date('2000-01-01'), new Date('2000-01-01'));
      beforeEach(() => {
        withFreshRepo();
        // a git dir (no .git entry) inside the cwd whose config points at a work tree and defines a clean filter
        wt = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-barewt-'));
        marker = path.join(wt, 'PWNED');
        const env = hermetic(home);
        spawnSync('git', ['init', '-q', '-b', 'main', wt], { env });
        fs.writeFileSync(path.join(wt, '.git', 'info', 'attributes'), 'f filter=x\n');
        fs.writeFileSync(path.join(wt, 'f'), 'a\n');
        spawnSync('git', ['-C', wt, 'add', 'f'], { env });
        spawnSync('git', ['-C', wt, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'i'], { env });
        fs.renameSync(path.join(wt, '.git'), bare());
        spawnSync('git', ['--git-dir', bare(), 'config', 'core.worktree', wt], { env });
        spawnSync('git', ['--git-dir', bare(), 'config', 'filter.x.clean', `touch ${marker}; cat`], { env });
        fs.writeFileSync(path.join(wt, 'f'), 'b\n'); // same size, old mtime: git status hashes it through the filter
        stale();
        // control: a plain git status there does run the filter
        spawnSync('git', ['-C', bare(), 'status', '--porcelain'], { env });
        expect(fs.existsSync(marker)).toBe(true);
        fs.rmSync(marker);
        stale();
        fs.symlinkSync(bare(), path.join(repo, 'link'));
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
          { mode: 0o755 },
        );
        const shimmed = { ...process.env, PATH: `${shim}${path.delimiter}${process.env.PATH}` };
        dirty();
        expect(denied(runRaw(JSON.stringify(claude('git checkout .')), {}, shimmed))).toBe(true);
        expect(denied(runRaw(JSON.stringify(claude(`git -C ${other} checkout . && git -C ${other} push -f`)), {}, shimmed))).toBe(true);
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
      expect(runRaw(JSON.stringify(copilot('git reset --hard')), { GIT_GUARDRAILS_OFF: '1' }, { ...process.env, PATH: nojq }).out).toBe('');
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
      fs.mkdirSync(path.join(repo, '.git', 'agents'));
      fs.writeFileSync(path.join(repo, '.git', 'agents', 'guardrails.off'), '');
      expect(run(claude('git reset --hard')).out).toBe('');
      expect(run(copilot('git reset --hard')).out).toBe('');
    });
    it('ignores the old working-tree .agents/guardrails.off', () => {
      withFreshRepo();
      fs.mkdirSync(path.join(repo, '.agents'));
      fs.writeFileSync(path.join(repo, '.agents', 'guardrails.off'), '');
      expect(denied(run(claude('git reset --hard')))).toBe(true);
    });
    it('names the legacy .agents/guardrails.off in the deny reason and still denies', () => {
      withFreshRepo();
      fs.mkdirSync(path.join(repo, '.agents'));
      fs.writeFileSync(path.join(repo, '.agents', 'guardrails.off'), '');
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
        fs.mkdirSync(path.join(repo, '.git', 'agents'));
        fs.writeFileSync(path.join(repo, '.git', 'agents', 'guardrails.off'), '');
        expect(denied(run(claude('git reset --hard'), { DROMOS_STATE_DIR: st }))).toBe(true);
      } finally {
        fs.rmSync(st, { recursive: true, force: true });
      }
    });
    it('the state dir of the main repository applies from a linked worktree', () => {
      withFreshRepo();
      const wt = path.join(repo, '..', path.basename(repo) + '-wt');
      git('worktree', 'add', '-q', '-b', 'wt-branch', wt);
      try {
        fs.mkdirSync(path.join(repo, '.git', 'agents'));
        fs.writeFileSync(path.join(repo, '.git', 'agents', 'guardrails.off'), '');
        expect(run(claude('git reset --hard', { cwd: wt })).out).toBe('');
      } finally {
        fs.rmSync(wt, { recursive: true, force: true });
      }
    });
    it('guardrails.off in the state dir applies from a subdirectory', () => {
      withFreshRepo();
      fs.mkdirSync(path.join(repo, '.git', 'agents'));
      fs.writeFileSync(path.join(repo, '.git', 'agents', 'guardrails.off'), '');
      fs.mkdirSync(path.join(repo, 'sub'));
      expect(run(claude('git reset --hard', { cwd: path.join(repo, 'sub') })).out).toBe('');
    });
  });
});
