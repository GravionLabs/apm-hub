import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { parse } from 'yaml';

const agentPath = path.resolve(
  __dirname,
  '../../../packages/agents/.apm/agents/orchestrator.agent.md'
);
const scriptPath = path.resolve(
  __dirname,
  '../../../packages/github/.apm/skills/github-issue/scripts/Add-LedgerLine.ps1'
);

function loadBashRules(): [string, string][] {
  const text = fs.readFileSync(agentPath, 'utf-8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw new Error(`No frontmatter found in ${agentPath}`);
  const permission = parse(match[1])?.metadata?.opencode?.permission;
  if (!permission?.bash)
    throw new Error(`metadata.opencode.permission.bash missing in ${agentPath}`);
  return Object.entries(permission.bash as Record<string, string>);
}

function loadPermission(): Record<string, unknown> {
  const text = fs.readFileSync(agentPath, 'utf-8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw new Error(`No frontmatter found in ${agentPath}`);
  return parse(match[1]).metadata.opencode.permission;
}

// decide() models the semantics observed in the spike (docs/working-mode.md, "Headless smoke test and spike result"):
// OpenCode splits a command at `;`, `&&`, `||`, `|`, `&` and newlines, drops redirects from every part, matches each part against the
// rules (`*` = any characters including `/`, everything else literal) and lets the LAST matching rule win.
// A command is allowed only when every part is allowed.
function decidePart(rules: [string, string][], part: string): string {
  const command = part.replace(/\s*\d*>>?\s*\S+/g, '').trim();
  let result = 'ask';
  for (const [pattern, action] of rules) {
    const re = new RegExp(
      '^' +
        pattern
          .split('*')
          .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
          .join('.*') +
        '$'
    );
    if (re.test(command)) result = action;
  }
  return result;
}

function decide(rules: [string, string][], command: string): string {
  // Substitutions run a second command whose text is not matched: modelled conservatively as never allowed.
  if (/\$\(|`/.test(command)) return 'ask';
  const parts = command.split(/&&|\|\||;|\||&|\r?\n/);
  return parts.every((p) => decidePart(rules, p) === 'allow') ? 'allow' : 'ask';
}

describe('orchestrator OpenCode permissions', () => {
  const rules = loadBashRules();
  const ledger = (args: string) =>
    `pwsh .claude/skills/github-issue/scripts/Add-LedgerLine.ps1 ${args}`;
  const skillDirs = [
    '.claude/skills',
    '.opencode/skills',
    '.agents/skills',
    '.github/skills',
    '~/.claude/skills',
    '~/.agents/skills',
    '~/.config/opencode/skills',
  ];

  it('keeps edit denied for source files', () => {
    expect(loadPermission().edit).toBe('deny');
  });

  it('keeps the catch-all bash rule at ask and first, so later rules win', () => {
    expect(Object.fromEntries(rules)['*']).toBe('ask');
    expect(rules[0][0]).toBe('*');
  });

  it('allows ledger writes only through the Add-LedgerLine helper', () => {
    expect(decide(rules, ledger('-Issue 222 -Line "Phase plan: complete — n/a"'))).toBe('allow');
    for (const dir of skillDirs) {
      expect(
        decide(rules, `pwsh ${dir}/github-issue/scripts/Add-LedgerLine.ps1 -Issue adhoc`)
      ).toBe('allow');
      expect(
        decide(rules, `pwsh ${dir}/detect-techstack/scripts/Detect-TechStack.ps1 -ProjectRoot .`)
      ).toBe('allow');
    }
  });

  it('allows the status table writer from every skill directory and asks when it is chained', () => {
    for (const dir of skillDirs)
      expect(
        decide(
          rules,
          `pwsh ${dir}/github-issue/scripts/Write-StatusTable.ps1 -Issue 248 -Path /tmp/t.md`
        )
      ).toBe('allow');
    expect(
      decide(
        rules,
        'pwsh .claude/skills/github-issue/scripts/Write-StatusTable.ps1 -Issue 1 -Path x; rm -rf src'
      )
    ).toBe('ask');
    expect(decide(rules, 'pwsh .claude/skills/other/scripts/Write-StatusTable.ps1 -Issue 1')).toBe(
      'ask'
    );
  });

  it('still allows git and gh', () => {
    expect(decide(rules, 'git status --short')).toBe('allow');
    expect(decide(rules, 'gh issue view 222')).toBe('allow');
  });

  it('no longer allows raw shell writes, with or without a redirect outside .agents/', () => {
    for (const cmd of [
      'echo x > src/a.ts',
      'echo x >> src/index.ts',
      'echo x',
      'mkdir -p .agents/222',
      'mkdir -p src/foo',
      'tee -a .agents/222/progress.md',
      'tee -a src/index.ts',
      'cat >> .agents/222/progress.md',
      'rm -rf .agents',
    ]) {
      expect(decide(rules, cmd)).toBe('ask');
    }
  });

  it('asks when the helper is chained with other commands', () => {
    expect(decide(rules, ledger('-Issue 1 -Line x; rm -rf src'))).toBe('ask');
    expect(decide(rules, ledger('-Issue 1 -Line x && rm -rf src'))).toBe('ask');
    expect(decide(rules, ledger('-Issue 1 -Line x | sh'))).toBe('ask');
    expect(decide(rules, ledger('-Issue 1 -Line x & rm -rf src'))).toBe('ask');
    expect(decide(rules, ledger('-Issue 1 -Line x\nrm -rf src'))).toBe('ask');
    expect(decide(rules, ledger('-Issue 1 -Line $(rm -rf src)'))).toBe('ask');
    expect(decide(rules, ledger('-Issue 1 -Line `rm -rf src`'))).toBe('ask');
  });

  it('asks for other pwsh scripts', () => {
    expect(decide(rules, 'pwsh scripts/Other.ps1 -Issue 1')).toBe('ask');
    expect(decide(rules, 'pwsh -Command "rm -rf src"')).toBe('ask');
    expect(decide(rules, 'pwsh -Command x a/scripts/Add-LedgerLine.ps1 y')).toBe('ask');
    expect(
      decide(rules, 'pwsh -NoProfile -Command "rm -rf src" x/scripts/Detect-TechStack.ps1 y')
    ).toBe('ask');
    expect(decide(rules, 'pwsh /tmp/x/scripts/Add-LedgerLine.ps1 1 y')).toBe('ask');
    expect(
      decide(rules, 'pwsh /home/u/.agents/skills/github-issue/scripts/Add-LedgerLine.ps1 -Issue 1')
    ).toBe('ask');
    expect(decide(rules, 'pwsh .claude/skills/other/scripts/Add-LedgerLine.ps1 -Issue 1')).toBe(
      'ask'
    );
  });

  it('has no allow rule that starts with a wildcard or lets pwsh run arbitrary scripts', () => {
    const allowed = rules.filter(([, a]) => a === 'allow').map(([p]) => p);
    expect(allowed.filter((p) => p.startsWith('*') || /^pwsh \*/.test(p))).toEqual([]);
    for (const p of allowed.filter((x) => x.startsWith('pwsh ')))
      expect(p).toMatch(
        /^pwsh \S+\/scripts\/(Add-LedgerLine|Detect-TechStack|Write-StatusTable|Enter-Checkout|Exit-Checkout|Set-ParkedGate|Get-TaskWaves|Sync-ProjectNeeds|Merge-ApprovedPr)\.ps1 \*$/
      );
  });
});

// The pattern cannot restrict arguments, so the helper itself validates the path.
const pwshAvailable = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;
describe.skipIf(!pwshAvailable)('Add-LedgerLine.ps1', () => {
  let cwd: string;
  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-'));
  });
  afterEach(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const run = (...args: string[]) =>
    spawnSync('pwsh', ['-NoProfile', '-File', scriptPath, ...args], {
      cwd,
      encoding: 'utf-8',
      env: { ...process.env, DROMOS_STATE_DIR: path.join(cwd, '.agents') },
    });

  it('creates the directory and appends lines', () => {
    expect(run('-Issue', '222', '-Line', '# header').status).toBe(0);
    expect(run('-Issue', '222', '-Line', 'Phase plan: complete').status).toBe(0);
    const text = fs.readFileSync(path.join(cwd, '.agents/222/progress.md'), 'utf-8');
    expect(text.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z /gm, '')).toBe(
      '# header\nPhase plan: complete\n'
    );
    expect(text).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z # header\n/);
  });

  it('accepts adhoc and creates only the directory without -Line', () => {
    expect(run('-Issue', 'adhoc').status).toBe(0);
    expect(fs.existsSync(path.join(cwd, '.agents/adhoc'))).toBe(true);
    expect(fs.existsSync(path.join(cwd, '.agents/adhoc/progress.md'))).toBe(false);
  });

  it.each(['../x', '5/..', '5 6', '0', '-1', 'x', '1;rm', '/etc', '007', '5\n', '5\u2028'])(
    'rejects issue %s',
    (issue) => {
      const r = run('-Issue', issue, '-Line', 'x');
      expect(r.status).not.toBe(0);
      expect(fs.existsSync(path.join(cwd, '.agents'))).toBe(false);
    }
  );

  it.each(['a\nb', 'a\u2028b', 'a\rb'])('rejects a multi-line value %j', (line) => {
    expect(run('-Issue', '5', '-Line', line).status).not.toBe(0);
  });

  it('fails without prompting when -Issue is missing', () => {
    const r = run('-Line', 'x');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('Invalid -Issue');
  });

  it.skipIf(process.platform === 'win32')('refuses a symlinked .agents directory', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));
    try {
      fs.symlinkSync(outside, path.join(cwd, '.agents'));
      expect(run('-Issue', '5', '-Line', 'x').status).not.toBe(0);
      expect(fs.readdirSync(outside)).toEqual([]);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});
