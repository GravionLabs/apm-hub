import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const orchestrator = read('packages/agents/.apm/agents/orchestrator.agent.md');
const reference = read('packages/github/.apm/skills/github-issue/references/next-selection.md');
const skill = read('packages/github/.apm/skills/github-issue/SKILL.md');
const workingMode = read('docs/working-mode.md');

const body = orchestrator.split(/^---$/m)[2];
const description = /^description: (.*)$/m.exec(orchestrator)![1];

describe('orchestrator plan and next modes', () => {
  it('lists all four modes in the description', () => {
    expect(description).toContain('plan|implement|full|next');
  });

  it('detects the mode by first word and keeps one PBI per run', () => {
    expect(body).toMatch(/first word/);
    for (const type of ['Epic', 'Feature', 'PBI']) expect(body).toContain(`[${type}]`);
    expect(body).toMatch(/one PBI per run/i);
  });

  it('cites the reference with its owning skill and orders Next before Ledger', () => {
    expect(body).toContain('`github-issue` `references/next-selection.md`');
    const next = body.indexOf('Next: #<nr>');
    const ledger = body.indexOf('Ledger complete.');
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

  it('drops PBIs merged into the integration branch, fetching before the grep', () => {
    expect(reference).toContain('## Merged (closes at release)');
    expect(reference).toContain('gh pr list --state merged');
    expect(reference).toContain('--grep');
    expect(reference).toContain('origin/<integration-branch>');
    const fetchAt = reference.indexOf('git fetch origin <integration-branch>');
    expect(fetchAt).toBeGreaterThanOrEqual(0);
    expect(fetchAt).toBeLessThan(reference.indexOf('--grep'));
    expect(reference).toMatch(/never close them by hand/);
  });

  it('reports merged PBIs separately from waiting for merge in the no-candidate and end lines', () => {
    const pick = reference.split('## Pick')[1].split('## End line')[0];
    const end = reference.split('## End line after a PBI run')[1];
    for (const part of [pick, end]) {
      expect(part).toContain('merged, closes at release');
      expect(part).toContain('waiting for merge: PR #<n>');
    }
    expect(end).toContain('merged, closes at release: #<a>, #<b>');
    expect(end).toMatch(/every open PBI is merged[^\n]*Feature #<feature> is done\./);
  });

  describe('merged commit check (command read from the reference)', () => {
    let dir: string;
    const git = (...a: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: dir, encoding: 'utf-8' });
    const find = (nr: string) => {
      const cmd = /^git log .*--grep .*$/m.exec(reference)![0];
      const words = cmd
        .replace('git ', '')
        .replace('<nr>', nr)
        .replace('origin/<integration-branch>', 'origin/release/1.0')
        .match(/"[^"]*"|\S+/g)!;
      return git(...words.map((w) => w.replace(/^"|"$/g, ''))).trim();
    };

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pbi-merged-'));
      git('init', '-q', '-b', 'release/1.0');
      git('commit', '-q', '--allow-empty', '-m', 'fix: a (#249)\n\nbody\n\nFixes #249\nCo-Authored-By: x <x@x>');
      git('commit', '-q', '--allow-empty', '-m', 'feat: b\n\nCloses #31');
      git('update-ref', 'refs/remotes/origin/release/1.0', 'HEAD');
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('matches Fixes #249 in a multi-line body and Closes #31 at the end', () => {
      expect(find('249')).not.toBe('');
      expect(find('31')).not.toBe('');
    });

    it('does not match #24 against #249 nor an unreferenced PBI', () => {
      expect(find('24')).toBe('');
      expect(find('3')).toBe('');
      expect(find('999')).toBe('');
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
  ])('maps "%s" to %s', (phrase, mode) => {
    const line = workingMode.split('\n').find((l) => l.includes(phrase));
    expect(line).toBeDefined();
    expect(line).toContain(mode);
  });
});
