import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { commandFrom } from './markdown-command';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const orchestrator = read('packages/agents/.apm/agents/orchestrator.agent.md');
const reference = read('packages/github/.apm/skills/github-issue/references/next-selection.md');
const skill = read('packages/github/.apm/skills/github-issue/SKILL.md');
const workingMode = read('docs/working-mode.md');

const body = orchestrator.split(/^---$/m)[2];
const description = /^description: (.*)$/m.exec(orchestrator)![1];

describe('orchestrator plan and next modes', () => {
  it('lists all five modes in the description', () => {
    expect(description).toContain('plan|implement|full|next|loop');
  });

  it('detects the mode by first word and keeps one PBI per run', () => {
    expect(body).toMatch(/first word/);
    for (const type of ['Epic', 'Feature', 'PBI']) expect(body).toContain(`[${type}]`);
    expect(body).toMatch(/one PBI per run/i);
  });

  it('cites the reference with its owning skill and orders Next before Ledger', () => {
    expect(body).toContain('`github-issue` `references/next-selection.md`');
    const report = body.slice(body.indexOf('Report at the end'));
    const next = report.indexOf('Next: #<nr>');
    const ledger = report.indexOf('Ledger complete.');
    expect(next).not.toBe(-1);
    expect(ledger).not.toBe(-1);
    expect(next).toBeLessThan(ledger);
  });

  it('limits the end line to PBIs whose parent is a Feature', () => {
    expect(body).toMatch(/parent is a Feature/);
  });
});

describe('next-selection reference', () => {
  it('expands sub-issues recursively for an Epic, paginated, in order', () => {
    expect(reference).toContain('sub_issues');
    expect(reference).toMatch(/Epic/);
    expect(reference).toMatch(/recursive/);
    expect(reference).toMatch(/Features too/);
    expect(reference).toContain('--paginate');
    expect(reference).toMatch(/first remaining candidate in sub-issue order/);
  });

  it('filters open blockers by state, needs-decision and in-flight PRs', () => {
    expect(reference).toContain('dependencies/blocked_by');
    expect(reference).toContain('select(.state=="open")');
    expect(reference).toContain('needs-decision');
    expect(reference).toContain('gh pr list --state open');
    expect(reference).toMatch(/waiting for merge/);
  });

  it('covers announcement, empty result and end-line variants', () => {
    expect(reference).toContain('Next PBI: #<nr> <title>');
    expect(reference).toMatch(/No candidate/);
    expect(reference).toContain('orchestrator next <feature> after /clear');
    expect(reference).toMatch(/is done/);
  });

  const merged = reference.split(/^## Merged \(closes at release\)$/m)[1].split(/^## /m)[0];

  it('drops PBIs merged into the integration branch, fetching before the grep', () => {
    expect(reference).toMatch(/^## Merged \(closes at release\)$/m);
    expect(merged.indexOf('git fetch origin <integration-branch>')).toBeGreaterThanOrEqual(0);
    expect(merged.indexOf('git fetch origin <integration-branch>')).toBeLessThan(merged.indexOf('--grep'));
    expect(merged).toContain('origin/<integration-branch>');
    expect(merged).toMatch(/never close them by hand/);
    expect(merged).toMatch(/merged first/);
  });

  it('checks merged PRs by number and lets the jq keyword filter decide', () => {
    const cmd = commandFrom(merged, 'gh pr list', '--state merged');
    expect(cmd).toContain('--state merged');
    expect(cmd).toContain('--base <integration-branch>');
    expect(cmd).toContain('--search "$candidate"');
    expect(cmd).toContain('closes|fixes|resolves');
    expect(cmd).not.toContain('--search "Closes');
  });

  it('defines the Feature rule: at least one PBI and every open PBI merged', () => {
    expect(merged).toMatch(/Feature counts as merged when it has at least one open PBI and every open PBI is merged/);
    const candidates = reference.split(/^## Candidates$/m)[1].split(/^## /m)[0];
    expect(candidates).toMatch(/merged Feature/);
    expect(candidates).not.toMatch(/or that has none/);
  });

  it('reports merged PBIs separately from waiting for merge in the no-candidate and end lines', () => {
    const pick = reference.split('## Pick')[1].split('## End line')[0];
    const end = reference.split('## End line after a PBI run')[1];
    for (const part of [pick, end]) {
      expect(part).toContain('merged, closes at release');
      expect(part).toContain('waiting for merge: PR #<n>');
    }
    expect(end).toContain('merged, closes at release: #<a>, #<b>');
    expect(end).toMatch(/Every open PBI merged: `Feature #<feature> is done — merged, closes at release/);
  });

  describe('merged commit check (command read from the reference)', () => {
    let dir: string;
    const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
    const git = (...a: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...a], {
        cwd: dir,
        env,
        encoding: 'utf-8',
      });
    const find = (nr: string) => {
      const cmd = commandFrom(merged, 'git log', '--grep');
      expect(cmd).toContain('origin/<integration-branch>');
      const words = cmd
        .replace('git ', '')
        .replace('$candidate', nr)
        .replace('origin/<integration-branch>', 'origin/release/1.0')
        .match(/"[^"]*"|\S+/g);
      expect(words).not.toBeNull();
      return git(...words!.map((w) => w.replace(/^"|"$/g, ''))).trim();
    };

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbi-merged-'));
      git('init', '-q');
      git('checkout', '-q', '-b', 'release/1.0');
      git('commit', '-q', '--allow-empty', '-m', 'fix: a (#249)\n\nbody\n\nFixes #249\nCo-Authored-By: x <x@x>');
      git('commit', '-q', '--allow-empty', '-m', 'feat: b\n\nCloses #31');
      git('commit', '-q', '--allow-empty', '-m', 'feat: c\n\nRESOLVES #50');
      git('commit', '-q', '--allow-empty', '-m', 'feat: d\n\nFixed: #51.');
      git('commit', '-q', '--allow-empty', '-m', 'feat: e\n\nRefs #60');
      git('update-ref', 'refs/remotes/origin/release/1.0', 'HEAD');
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('matches Fixes in a multi-line body, Closes at the end, any case, Fixed: and trailing punctuation', () => {
      for (const nr of ['249', '31', '50', '51']) expect(find(nr)).not.toBe('');
    });

    it('does not match #24 against #249, a bare Refs or an unreferenced PBI', () => {
      for (const nr of ['24', '3', '60', '999']) expect(find(nr)).toBe('');
    });
  });

  it('is linked from the github-issue skill', () => {
    expect(skill).toContain('references/next-selection.md');
  });
});

describe('working-mode natural requests', () => {
  it.each([
    ['implementiere das nächste Feature', 'next <feature>'],
    ['plan all open features under #81', 'plan 81'],
    ['arbeite Feature #81 ab', 'loop <feature>'],
  ])('maps "%s" to %s', (phrase, mode) => {
    const line = workingMode.split('\n').find((l) => l.includes(phrase));
    expect(line).toBeDefined();
    expect(line).toContain(mode);
  });
});

describe('loop mode documentation', () => {
  it.each([
    ['docs/working-mode.md', workingMode],
    ['docs/orchestrator.md', read('docs/orchestrator.md')],
  ])('%s mode table has a loop row that repeats next', (_file, text) => {
    const row = text.split('\n').find((l) => /^\| `loop <[^`]*>` \|/.test(l));
    expect(row).toBeDefined();
    expect(row).toMatch(/[Rr]epeats? `next`/);
  });

  it('next still selects exactly one PBI per run', () => {
    const nextRule = body.slice(body.indexOf('`next <feature|epic>`'), body.indexOf('`loop <feature|epic>`'));
    expect(nextRule).toMatch(/Exactly one PBI per run \(except `loop`\)/);
    expect(reference).toMatch(/^The first remaining candidate in sub-issue order is the PBI\./m);
  });
});
