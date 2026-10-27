import { spawn } from 'child_process';
import { SCRIPT, createGuardFixture, hermetic } from '../../helpers/git-guardrails-fixture';

describe('git-guardrails hook', () => {
  const fx = createGuardFixture();
  const { git, withFreshRepo, claude, copilot, runRaw, run, denied, dirty } = fx;

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
    'zsh -c "bash -c \'git reset --hard\'"',
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
      const clean = hermetic(fx.home);
      delete clean.GIT_GUARDRAILS_OFF;
      const child = spawn('bash', [SCRIPT], { env: clean });
      let out = '';
      child.stdout.on('data', (d) => (out += d));
      child.on('close', (code) => resolve({ code, out: out.trim() }));
      child.stdin.end(JSON.stringify(payload));
    });
  beforeAll(async () => {
    const jobs = payloads.flatMap(([n, mk]) =>
      [...blocked, ...allowed].map((c) => [`${n}\0${c}`, mk(c)] as const)
    );
    let next = 0;
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        while (next < jobs.length) {
          const [k, payload] = jobs[next++];
          tableRuns.set(k, await runAsync(payload));
        }
      })
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
  ])('denies %s only with uncommitted changes', (c) => {
    withFreshRepo();
    expect(run(claude(c)).out).toBe('');
    dirty();
    expect(JSON.parse(run(claude(c)).out).permissionDecision).toBe('deny');
    expect(JSON.parse(run(copilot(c)).out).permissionDecision).toBe('deny');
  });
  it('allows restore --staged . even when dirty', () => {
    withFreshRepo();
    dirty();
    expect(run(claude('git restore --staged .')).out).toBe('');
  });
  it('treats a directory change before checkout . as possibly dirty', () => {
    expect(JSON.parse(run(claude('cd other && git checkout -- .')).out).permissionDecision).toBe(
      'deny'
    );
  });

  it('ignores other tools', () => {
    expect(
      run({ tool_name: 'Read', tool_input: { command: 'git reset --hard' }, cwd: fx.repo }).out
    ).toBe('');
    expect(
      run({ toolName: 'view', toolArgs: '{"command":"git reset --hard"}', cwd: fx.repo }).out
    ).toBe('');
  });
  it.each([
    '',
    'not json',
    '{"tool_name":"Bash","tool_input":{"comm',
    '{"tool_name":"Bash"}',
    'null',
    '[]',
  ])('fails open on malformed raw stdin %j', (raw) => {
    expect(runRaw(raw)).toEqual({ code: 0, out: '' });
  });
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
});
