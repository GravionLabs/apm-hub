import { createGuardFixture } from '../../helpers/git-guardrails-fixture';

// Wall-clock performance and limits cases of the git-guardrails hook. Run by the Vitest project `perf`
// (`pnpm run test:perf`), not by `pnpm test` or `pnpm run test:all`.
describe('git-guardrails hook', () => {
  const fx = createGuardFixture();
  const { claude, runRaw, run, denied, runNoJq } = fx;

  describe('performance and limits', () => {
    const CAP = 24576;
    // Wall-clock bound per hook run; CI runners are 2-3x slower than a developer machine (#247), and a loaded local run (parallel suites) too (#336).
    const BOUND = process.env.CI ? 9000 : 6000;
    const msg = Array.from(
      { length: 440 },
      (_, i) => `line ${i} of a long commit message with some words`
    ).join('\n');
    const timed = (fn: () => { out: string }) => {
      const t = Date.now();
      const r = fn();
      return { r, ms: Date.now() - t };
    };
    const big = [
      `git commit -m "$(cat <<'EOF'\n${msg}\nEOF\n)"`,
      `git commit -m '${msg}'`,
      `git commit -F - <<EOF\n${msg}\nEOF`,
    ];
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
    const fill = (unit: string, head = '') =>
      head + unit.repeat(Math.floor((CAP - 200 - head.length) / unit.length)) + tail;
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
    it.each(shapes)(
      'denies after %s within the time bound, with and without jq',
      (_n, c) => {
        expect(c.length).toBeLessThanOrEqual(CAP);
        for (const fn of [run, runNoJq]) {
          const { r, ms } = timed(() => fn(claude(c)));
          expect(denied(r)).toBe(true);
          expect(ms).toBeLessThan(BOUND);
        }
      },
      3 * BOUND
    );
    // the scanner works on a sliding window (1300 chars, recut after 600) and 64-char slices: put each construct across those offsets
    const OFFSETS = [
      0, 55, 63, 64, 65, 120, 595, 599, 600, 601, 640, 1199, 1200, 1299, 1300, 1301, 1900, 2500,
    ];
    const pad = (k: number) => 'a'.repeat(k);
    const constructs: [string, (k: number) => string, boolean][] = [
      ['a plain command after padding', (k) => `echo ${pad(k)}\ngit reset --hard`, true],
      ['a command substitution', (k) => `echo ${pad(k)} "$(git reset --hard)"`, true],
      ['a backtick substitution', (k) => `echo ${pad(k)} \`git reset --hard\``, true],
      [
        'a heredoc body and a command after it',
        (k) => `cat <<'EOF'\n${pad(k)}\nEOF\ngit reset --hard`,
        true,
      ],
      [
        'an indented <<- heredoc and a command after it',
        (k) => `cat <<-EOF\n\t${pad(k)}\n\tEOF\ngit reset --hard`,
        true,
      ],
      [
        'a long heredoc delimiter',
        (k) => `cat <<${pad(k % 300)}\nx\n${pad(k % 300)}\ngit reset --hard`,
        true,
      ],
      [
        'an unquoted heredoc with a substitution',
        (k) => `cat <<EOF\n${pad(k)} $(git reset --hard)\nEOF`,
        true,
      ],
      ['a bash -c string', (k) => `echo ${pad(k)}; bash -c 'git reset --hard'`, true],
      ['an arithmetic expression', (k) => `echo ${pad(k)} $((1+2))\ngit reset --hard`, true],
      ['a comment', (k) => `# ${pad(k)}\ngit reset --hard`, true],
      ['quoted text only', (k) => `echo '${pad(k)} git reset --hard'`, false],
      ['a quoted heredoc body only', (k) => `cat <<'EOF'\n${pad(k)}\ngit reset --hard\nEOF`, false],
      ['a comment only', (k) => `echo ${pad(k)} # git reset --hard`, false],
    ];
    for (const [name, build, deny] of constructs) {
      it(`${deny ? 'denies' : 'allows'} ${name} at every window offset`, () => {
        for (const k of OFFSETS) {
          const c = build(k);
          const r = run(claude(c));
          expect(r.out === '' ? 'allow' : denied(r) ? 'deny' : 'other', `${name} at ${k}`).toBe(
            deny ? 'deny' : 'allow'
          );
        }
      }, 60000);
    }
    it('denies a destructive command at offsets across the window without jq', () => {
      for (const k of [63, 64, 600, 601, 1300]) {
        expect(denied(runNoJq(claude(`echo ${pad(k)} "$(git reset --hard)"`))), `at ${k}`).toBe(
          true
        );
      }
    }, 60000);

    describe('JSON decoding without jq', () => {
      // payloads written by hand so the escapes reach the hook exactly as a host sends them
      const raw = (command: string) =>
        `{"tool_name":"Bash","tool_input":{"command":${command}},"cwd":"${fx.repo.replace(/\\/g, '\\\\')}"}`;
      const nj = (command: string) => runRaw(raw(command), {}, { ...process.env, PATH: fx.nojq });
      it('decodes escaped quotes, newlines and tabs', () => {
        expect(denied(nj('"echo \\"hi\\"\\ngit reset --hard"'))).toBe(true);
        expect(denied(nj('"echo\\t\\"a b\\" && git reset --hard"'))).toBe(true);
      });
      it('keeps an escaped backslash as one backslash, not an escape', () => {
        expect(nj('"echo \\\\n git reset --hard"').out).toBe(''); // JSON \\n is backslash + n: inside a plain word, no newline: still `echo \n git reset --hard` -> reset runs as an argument of echo
        expect(denied(nj('"echo \\\\\\\\\\ngit reset --hard"'))).toBe(true); // \\\\ then \n: two backslashes, then a real newline
        expect(nj('"echo \\\\\\"x\\"\\ngit reset --hard"').out).toBe(''); // \\ + \" = backslash, quote: the quote opens a string that swallows the newline
      });
      it('decodes \\uXXXX escapes (space, newline, quote, backslash)', () => {
        expect(denied(nj('"echo\\u0020x\\u000agit reset --hard"'))).toBe(true);
        expect(denied(nj('"echo \\u0022a\\u0022; git reset --hard"'))).toBe(true);
        expect(denied(nj('"git\\u0020reset\\u0020--hard"'))).toBe(true);
        expect(nj('"echo \\u005c; true"').out).toBe(''); // no git
      });
      it('handles backslash-heavy payloads and a trailing backslash', () => {
        expect(denied(nj(`"echo ${'\\\\\\\\'.repeat(400)}\\ngit reset --hard"`))).toBe(true);
        expect(denied(nj(`"echo ${'\\\\\\"'.repeat(400)}\\ngit reset --hard"`))).toBe(true);
        expect(nj('"echo git\\\\"').out).toBe('');
      });
      it('reads the same command as jq for a mix of escapes', () => {
        const cmd = `echo "a\\tb" 'c\\\\d'\nx=1 git reset --hard # é`;
        const viaJq = run(claude(cmd));
        const viaScan = runNoJq(claude(cmd));
        expect(denied(viaScan)).toBe(denied(viaJq));
      });
    });
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
});
