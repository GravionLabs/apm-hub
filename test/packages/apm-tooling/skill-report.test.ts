import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PwshWorker } from '../../helpers/pwsh-worker';

const repo = path.resolve(__dirname, '../../..');
const SCRIPT = path.join(
  repo,
  'packages/apm-tooling/.apm/skills/skill-slim/scripts/Get-SkillReport.ps1',
);
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

describe.skipIf(!hasPwsh || process.platform === 'win32')('Get-SkillReport.ps1 (#775)', () => {
  let worker: PwshWorker;
  let dir: string;
  beforeAll(() => {
    worker = new PwshWorker(SCRIPT);
  });
  afterAll(() => worker.close());
  beforeEach(() => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'skill-report-')));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const write = (rel: string, content = 'x\n') => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  };
  const skill = (name: string, body: string) =>
    write(`packages/p/.apm/skills/${name}/SKILL.md`, `---\nname: ${name}\n---\n\n${body}\n`);
  const run = async (...args: string[]) => {
    const r = await worker.run(['-Root', dir, '-Allowlist', path.join(dir, 'allow.txt'), ...args], {
      cwd: dir,
    });
    return { ...r, report: r.stdout.trim() ? JSON.parse(r.stdout) : null };
  };
  const refs = (report: { danglingCandidates: { skill: string; ref: string }[] }) =>
    report.danglingCandidates.map((d) => `${d.skill}: ${d.ref}`);

  it('same-sentence cross-skill reference to a missing file fails with -FailOnDangling', async () => {
    skill('alpha', 'See `beta` `references/missing.md` for the tier.');
    skill('beta', 'Beta.');
    const r = await run('-FailOnDangling');
    expect(r.status).toBe(1);
    expect(refs(r.report)).toEqual(['alpha: beta/references/missing.md']);
    expect(r.stderr).toContain('dangling references: 1');
  });

  it('same-sentence cross-skill reference to an existing file is resolved', async () => {
    skill('alpha', 'See `beta` `references/there.md` for the tier.');
    skill('beta', 'Beta.');
    write('packages/p/.apm/skills/beta/references/there.md');
    const r = await run('-FailOnDangling');
    expect(r.status).toBe(0);
    expect(r.report.danglingCandidates).toEqual([]);
  });

  it('<skill>/references/<file> and ../<skill>/ forms are checked against the other skill', async () => {
    skill(
      'alpha',
      'Read `beta/references/gone.md`, `../beta/references/gone2.md` and `beta/references/ok.md`.',
    );
    skill('beta', 'Beta.');
    write('packages/p/.apm/skills/beta/references/ok.md');
    const r = await run();
    expect(refs(r.report)).toEqual([
      'alpha: beta/references/gone.md',
      'alpha: beta/references/gone2.md',
    ]);
  });

  it('a path of another tool with an unknown prefix is not ours', async () => {
    skill('alpha', 'Uses `vendor/scripts/run.sh` of a vendor.');
    const r = await run('-FailOnDangling');
    expect(r.status).toBe(0);
  });

  it('references/*.md files are scanned too, resolved against their own skill', async () => {
    skill('alpha', 'Alpha.');
    write(
      'packages/p/.apm/skills/alpha/references/r.md',
      'Needs `references/own-missing.md` and `references/r.md`.\n',
    );
    const r = await run('-FailOnDangling');
    expect(r.status).toBe(1);
    expect(refs(r.report)).toEqual(['alpha: references/own-missing.md']);
  });

  it('repo-root paths resolve against -Root', async () => {
    skill('alpha', 'See `docs/there.md`, `docs/gone.md`, `AGENTS.md` and `scripts/tool.mjs`.');
    write('docs/there.md');
    write('scripts/tool.mjs');
    const r = await run();
    expect(refs(r.report).sort()).toEqual(['alpha: AGENTS.md', 'alpha: docs/gone.md']);
  });

  it('a dangling reference without -FailOnDangling still exits 0', async () => {
    skill('alpha', 'See `beta` `references/missing.md`.');
    skill('beta', 'Beta.');
    const r = await run();
    expect(r.status).toBe(0);
    expect(refs(r.report)).toEqual(['alpha: beta/references/missing.md']);
  });

  it('the allowlist removes a known false positive', async () => {
    skill('alpha', 'See `beta` `references/missing.md`.');
    skill('beta', 'Beta.');
    write('allow.txt', '# beta ships it at runtime\nalpha: beta/references/missing.md  # why\n');
    const r = await run('-FailOnDangling');
    expect(r.status).toBe(0);
    expect(r.report.danglingCandidates).toEqual([]);
  });

  it('this repository has no dangling references', async () => {
    const r = await worker.run(['-Root', repo, '-FailOnDangling'], { cwd: repo });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).danglingCandidates).toEqual([]);
  });
});

describe('CI and skill-slim (#775)', () => {
  it('ci.yml passes -FailOnDangling and skill-slim documents the switch', () => {
    const ci = fs.readFileSync(path.join(repo, '.github/workflows/ci.yml'), 'utf-8');
    expect(ci).toMatch(/Get-SkillReport\.ps1 -Root \. -FailOnDangling/);
    const md = fs.readFileSync(
      path.join(repo, 'packages/apm-tooling/.apm/skills/skill-slim/SKILL.md'),
      'utf-8',
    );
    expect(md).toContain('-FailOnDangling');
    expect(md).toContain('skill-report-allowlist.txt');
  });
});
