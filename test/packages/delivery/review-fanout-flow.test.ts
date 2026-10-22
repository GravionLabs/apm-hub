import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../../..');
const fanout = fs.readFileSync(path.join(root, 'packages/delivery/.apm/skills/review-fanout/SKILL.md'), 'utf-8');
const lead = fs.readFileSync(path.join(root, 'packages/agents/.apm/agents/review-lead.agent.md'), 'utf-8');
const filterRef = fs.readFileSync(path.join(root, 'packages/delivery/.apm/skills/review-fanout/references/package-filter.md'), 'utf-8');
const pipeline = fs.readFileSync(path.join(root, 'packages/github/.apm/skills/github-issue/references/pbi-pipeline.md'), 'utf-8');

// The exclude list lives in the reference; parse it so docs and tests cannot drift.
const EXCLUDED = (/Excluded patterns[^\n]*\n\n```text\n([\s\S]*?)\n```/.exec(filterRef)?.[1] ?? '').split('\n').filter(Boolean);

describe('review-fanout: no active waiting (#451)', () => {
  it('SKILL.md dispatches in one message and forbids sleep and polling', () => {
    expect(fanout).toMatch(/No active waiting/);
    expect(fanout).toMatch(/ONE message, then wait for their replies/);
    expect(fanout).toMatch(/Never run `sleep` or `Start-Sleep`, never poll/);
    for (const c of ['`Agent` returns', '`task()` awaits', '`runSubagent` returns']) expect(fanout).toContain(c);
  });

  it('review-lead carries the same rule', () => {
    expect(lead).toMatch(/No active waiting/);
    expect(lead).toMatch(/ONE message, then wait for their replies/);
    expect(lead).toMatch(/Never run `sleep` or `Start-Sleep`, never poll/);
  });
});

describe('review-fanout: smaller package (#453)', () => {
  it('reference lists lockfiles, goldens, minified assets, build output and generated docs', () => {
    expect(EXCLUDED).toEqual(expect.arrayContaining([
      'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'Cargo.lock', 'poetry.lock', 'uv.lock', 'packages.lock.json',
      '__snapshots__/', '*.snap', '*.golden*', 'goldens/', '*.min.js', 'dist/', 'coverage/', 'docs/*-list.md',
    ]));
    expect(new Set(EXCLUDED).size).toBe(EXCLUDED.length);
    for (const p of EXCLUDED) expect(p).toMatch(/^[^\s:]+$/);
  });

  it('SKILL.md step 1 filters via pathspecs, points to the reference and names binary files', () => {
    expect(fanout).toMatch(/Filter out generated files, lockfiles, goldens\/snapshots, minified\/bundled assets/);
    expect(fanout).toContain("':!<pattern>'");
    expect(fanout).toContain('references/package-filter.md');
    expect(fanout).toMatch(/binary files/);
    expect(filterRef).toMatch(/Binary files/);
  });

  it('re-review package is the fix diff plus the earlier findings with status', () => {
    expect(fanout).toMatch(/Re-review\*\* after a fix round \(the caller passes the previous round's `review.json`\)/);
    expect(fanout).toMatch(/only the fix diff `<last review HEAD>\.\.HEAD` plus the earlier findings/);
    expect(fanout).toContain('fixed|open|advisory');
    expect(fanout).toMatch(/never the full diff again/);
  });

  it('review-lead and the PBI pipeline pass the previous review.json', () => {
    expect(lead).toMatch(/previous round's `review\.json` path to `review-fanout`/);
    expect(lead).toMatch(/only the fix diff plus the earlier findings with status fixed, open or advisory, never the full diff/);
    expect(lead).toMatch(/filters generated files, lockfiles and goldens/);
    expect(pipeline).toMatch(/previous round's `review\.json` path/);
  });
});

describe('review-fanout: early verify (#452)', () => {
  it('SKILL.md starts verify per arriving dimension and keeps the verdict behind all results', () => {
    expect(fanout).toMatch(/Early verify/);
    expect(fanout).toMatch(/as soon as its result contains a CRITICAL or HIGH finding, while other dimensions still run/);
    expect(fanout).toMatch(/one verify batch \(a single message\) per arriving dimension/);
    expect(fanout).toMatch(/verdict waits for all dimensions and all verify results/);
  });

  it('dedupe stays after all dimensions and keeps early refutations', () => {
    expect(fanout).toMatch(/runs after all dimensions reported/);
    expect(fanout).toMatch(/refuted in early verify stays refuted/);
  });

  it('keeps the fail-closed rules', () => {
    expect(fanout).toMatch(/`unverifiable` \(stays blocking\)/);
    expect(fanout).toMatch(/Fail closed: a failed dimension/);
  });

  it('review-lead follows the same flow', () => {
    expect(lead).toMatch(/Early verify/);
    expect(lead).toMatch(/CRITICAL or HIGH finding, dispatch its verify batch at once while other dimensions still run/);
    expect(lead).toMatch(/wait for all dimensions and all verify results, a finding refuted early stays refuted/);
  });
});
