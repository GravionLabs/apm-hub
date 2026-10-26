import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(__dirname, '../../../packages/hooks/.apm/hooks/agent-sanitize.sh');
const BASH = spawnSync('sh', ['-c', 'command -v bash'], { encoding: 'utf8' }).stdout.trim();

// apm-hub source format: Copilot tool aliases plus a metadata block with a claude section
const SOURCE = `---
name: explorer
description: Read-only codebase exploration.
tools: ['read', 'search']
user-invocable: false
metadata:
  claude:
    tools: [Read, Grep, Glob]
    model: haiku
  opencode:
    mode: subagent
---

Body with the word metadata: and claude: in it, which must not count.
`;
// what apmw sanitize -p claude produces
const SANITIZED = `---
name: explorer
description: Read-only codebase exploration.
tools: [Read, Grep, Glob]
model: haiku
---

Body.
`;
// a foreign agent: metadata without a claude key never triggers a run (what apmw does with it once it runs is apmw's rule)
const FOREIGN = `---
name: other
description: Someone else's agent.
metadata:
  author: someone
tools: Read, Grep
---

Body.
`;

describe('agent-sanitize hook', () => {
  let dir: string;
  let home: string;
  let proj: string;
  let bin: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-sanitize-'));
    home = path.join(dir, 'home');
    proj = path.join(dir, 'proj');
    bin = path.join(dir, 'bin');
    [home, proj, bin].forEach((d) => fs.mkdirSync(d, { recursive: true }));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const gdir = () => path.join(home, '.claude/agents');
  const pdir = () => path.join(proj, '.claude/agents');
  const write = (d: string, name: string, text: string) => {
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, name), text);
  };

  // fake apmw: logs its arguments and cwd, and (unless APMW_FAIL is set) sanitizes the target directory like the real one
  // by dropping the frontmatter lines from `metadata:` to the closing `---`
  const fakeApmw = () =>
    fs.writeFileSync(
      path.join(bin, 'apmw'),
      `#!/bin/sh
echo "$* cwd=$PWD" >> "$APMW_LOG"
[ -n "\${APMW_FAIL:-}" ] && exit 1
case "$*" in *" -g "*|*" -g") d="$HOME/.claude/agents";; *) d="$PWD/.claude/agents";; esac
for f in "$d"/*.md; do
  [ -f "$f" ] || continue
  awk 'NR==1{fm=1} fm && /^metadata:/{skip=1} fm && skip && /^---/{skip=0; fm=0} !skip{print}' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
done
exit 0
`,
      { mode: 0o755 }
    );
  // one line per apmw call, `<args> cwd=<dir>`; the cwd is canonicalised (macOS /var vs /private/var)
  const apmwCalls = () => {
    const f = path.join(dir, 'apmw.log');
    if (!fs.existsSync(f)) return [];
    return fs
      .readFileSync(f, 'utf8')
      .trim()
      .split('\n')
      .map((l) => l.replace(/ cwd=(.*)$/, (_, p) => ` cwd=${fs.realpathSync(p)}`));
  };
  const real = (p: string) => fs.realpathSync(p);

  const run = (
    env: Record<string, string> = {},
    payload = JSON.stringify({ cwd: proj, source: 'startup' })
  ) => {
    const r = spawnSync(BASH, [SCRIPT], {
      input: payload,
      encoding: 'utf8',
      cwd: dir,
      env: {
        PATH: `${bin}:/usr/bin:/bin:/usr/local/bin`,
        HOME: home,
        APMW_LOG: path.join(dir, 'apmw.log'),
        ...env,
      },
    });
    return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() };
  };
  const context = (out: string) =>
    JSON.parse(out).hookSpecificOutput as { hookEventName: string; additionalContext: string };

  it('is silent when every agent file is sanitized, foreign or absent', () => {
    expect(run()).toEqual({ code: 0, out: '', err: '' });
    write(gdir(), 'explorer.md', SANITIZED);
    write(gdir(), 'other.md', FOREIGN);
    write(pdir(), 'explorer.md', SANITIZED);
    expect(run()).toEqual({ code: 0, out: '', err: '' });
    expect(apmwCalls()).toEqual([]);
  });

  it('sanitizes the home directory with apmw -g and reports the count', () => {
    fakeApmw();
    write(gdir(), 'explorer.md', SOURCE);
    write(gdir(), 'planner.md', SOURCE);
    write(gdir(), 'other.md', FOREIGN);
    const r = run();
    expect(r.code).toBe(0);
    const ctx = context(r.out);
    expect(ctx.hookEventName).toBe('SessionStart');
    expect(ctx.additionalContext).toContain('2 agent file(s)');
    expect(ctx.additionalContext).toContain('needs a restart');
    expect(apmwCalls()).toEqual([`sanitize -g -p claude cwd=${real(dir)}`]);
    expect(fs.readFileSync(path.join(gdir(), 'explorer.md'), 'utf8')).not.toContain('\nmetadata:');
    // second start: clean, nothing runs
    expect(run().out).toBe('');
    expect(apmwCalls()).toHaveLength(1);
  });

  it('sanitizes the project directory of the payload cwd without -g', () => {
    fakeApmw();
    write(pdir(), 'explorer.md', SOURCE);
    const r = run();
    expect(context(r.out).additionalContext).toContain('1 agent file(s)');
    expect(apmwCalls()).toEqual([`sanitize -p claude cwd=${real(proj)}`]);
    expect(fs.readFileSync(path.join(pdir(), 'explorer.md'), 'utf8')).not.toContain('\nmetadata:');
  });

  it('handles both scopes in one run and reads cwd without jq', () => {
    fakeApmw();
    write(gdir(), 'explorer.md', SOURCE);
    write(pdir(), 'explorer.md', SOURCE);
    const r = run({ PATH: `${bin}:/usr/bin:/bin` }, `{ "source": "startup", "cwd": "${proj}" }`);
    expect(context(r.out).additionalContext).toContain('2 agent file(s)');
    expect(apmwCalls()).toHaveLength(2);
  });

  it('reports the install hint and the commands when apmw is missing', () => {
    write(gdir(), 'explorer.md', SOURCE);
    write(pdir(), 'explorer.md', SOURCE);
    const r = run();
    expect(r.code).toBe(0);
    const text = context(r.out).additionalContext;
    expect(text).toContain('2 agent file(s)');
    expect(text).toContain('uv tool install apmw');
    expect(text).toContain('apmw sanitize -g -p claude; apmw sanitize -p claude');
    expect(fs.readFileSync(path.join(gdir(), 'explorer.md'), 'utf8')).toBe(SOURCE);
  });

  it('reports the command to run by hand when apmw fails', () => {
    fakeApmw();
    write(gdir(), 'explorer.md', SOURCE);
    const r = run({ APMW_FAIL: '1' });
    expect(r.code).toBe(0);
    const text = context(r.out).additionalContext;
    expect(text).toContain('failed');
    expect(text).toContain('apmw sanitize -g -p claude');
    expect(text).not.toContain('rewrote them');
  });

  it('does nothing with AGENT_SANITIZE_OFF=1', () => {
    fakeApmw();
    write(gdir(), 'explorer.md', SOURCE);
    expect(run({ AGENT_SANITIZE_OFF: '1' })).toEqual({ code: 0, out: '', err: '' });
    expect(apmwCalls()).toEqual([]);
  });

  it('falls back to the process cwd on an empty or unparseable payload', () => {
    fakeApmw();
    write(path.join(dir, '.claude/agents'), 'explorer.md', SOURCE);
    const r = run({}, '');
    expect(context(r.out).additionalContext).toContain('1 agent file(s)');
    expect(apmwCalls()).toEqual([`sanitize -p claude cwd=${real(dir)}`]);
  });

  it('counts a CRLF source file and ignores a file without frontmatter', () => {
    write(gdir(), 'crlf.md', SOURCE.replace(/\n/g, '\r\n'));
    write(gdir(), 'notes.md', 'metadata:\n  claude:\n');
    const text = context(run().out).additionalContext;
    expect(text).toContain('1 agent file(s)');
  });
});
