import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parse } from 'yaml';

const root = path.resolve(__dirname, '../../..');
const text = fs.readFileSync(
  path.join(root, 'packages/github/.apm/skills/github-project/templates/project-needs.yml'),
  'utf-8'
);
const wf = parse(text);
const own = parse(fs.readFileSync(path.join(root, '.github/workflows/project-needs.yml'), 'utf-8'));

describe('project-needs.yml template (#626)', () => {
  it('is valid YAML with the three placeholders', () => {
    expect(wf.jobs['sync-needs']).toBeDefined();
    for (const p of ['__OWNER__', '__PROJECT_NUMBER__', '__TOKEN__']) expect(text).toContain(p);
  });

  it('has the triggers, concurrency and permissions of the repository workflow', () => {
    expect(wf.on).toEqual(own.on);
    expect(wf.concurrency).toEqual(own.concurrency);
    expect(wf.permissions).toEqual(own.permissions);
  });

  it('passes Owner and Number to the script', () => {
    expect(text).toMatch(/Owner = '__OWNER__'; Number = __PROJECT_NUMBER__/);
  });

  describe('run script behavior (stub Sync-ProjectNeeds.ps1)', () => {
    const run = (wf.jobs['sync-needs'].steps as { run?: string }[]).find((x) => x.run)!.run!;
    const dirs: string[] = [];
    afterEach(() => {
      for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
    });

    // The stub replaces the checked-out script and prints the bound arguments as JSON.
    function runStep(env: Record<string, string>) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'needs-tpl-'));
      dirs.push(dir);
      const scriptDir = path.join(
        dir,
        '.apm-hub/packages/github/.apm/skills/github-project/scripts'
      );
      fs.mkdirSync(scriptDir, { recursive: true });
      fs.writeFileSync(
        path.join(scriptDir, 'Sync-ProjectNeeds.ps1'),
        'param([string]$Owner,[int]$Number,[string]$Repo,[string]$Issue,[switch]$IncludeParents,[switch]$IncludeDependents)\n' +
          '"ARGS " + ([pscustomobject]@{ Owner=$Owner; Number=$Number; Repo=$Repo; Issue=$Issue; Parents=[bool]$IncludeParents; Dependents=[bool]$IncludeDependents } | ConvertTo-Json -Compress)\n'
      );
      const script = run.replace(/__OWNER__/g, 'me').replace(/__PROJECT_NUMBER__/g, '7');
      fs.writeFileSync(path.join(dir, 'step.ps1'), script);
      const r = spawnSync('pwsh', ['-NoProfile', '-File', 'step.ps1'], {
        cwd: dir,
        encoding: 'utf-8',
        env: { ...process.env, GH_TOKEN: 't', GH_REPO: 'o/r', ...env },
      });
      const m = /ARGS (.*)/.exec(r.stdout);
      return { status: r.status, stdout: r.stdout, args: m ? JSON.parse(m[1]) : null };
    }

    it('issues event: syncs the issue with parents and dependents', () => {
      const r = runStep({ EVENT_NAME: 'issues', ISSUE_NUMBER: '42' });
      expect(r.args).toEqual({
        Owner: 'me',
        Number: 7,
        Repo: 'o/r',
        Issue: '42',
        Parents: true,
        Dependents: true,
      });
    });

    it.each([
      ['feat/643-paginate-reads', '643'],
      ['643-paginate', '643'],
      ['user/fix/12-x', '12'],
    ])('pull_request_target: head ref %s syncs issue %s with parents only', (head, issue) => {
      const r = runStep({ EVENT_NAME: 'pull_request_target', HEAD_REF: head });
      expect(r.args).toMatchObject({ Issue: issue, Parents: true, Dependents: false });
    });

    it.each(['main', 'feat/no-number', 'release/next', 'fix12-x'])(
      'pull_request_target: head ref %s has no issue number, skips with a notice',
      (head) => {
        const r = runStep({ EVENT_NAME: 'pull_request_target', HEAD_REF: head });
        expect(r.status).toBe(0);
        expect(r.args).toBeNull();
        expect(r.stdout).toMatch(/::notice::No issue number in head ref/);
      }
    );

    it.each(['schedule', 'workflow_dispatch'])('%s: full sync without an issue', (ev) => {
      const r = runStep({ EVENT_NAME: ev });
      expect(r.args).toMatchObject({ Issue: '', Parents: false, Dependents: false });
    });

    it('an empty token warns and exits 0 without running the script', () => {
      const r = runStep({ EVENT_NAME: 'schedule', GH_TOKEN: '' });
      expect(r.status).toBe(0);
      expect(r.args).toBeNull();
      expect(r.stdout).toMatch(/::warning::/);
    });
  });
});
