import * as fs from 'fs';
import * as path from 'path';

const refs = path.resolve(
  __dirname,
  '../../../packages/github/.apm/skills/github-issue/references'
);
const gates = fs.readFileSync(path.join(refs, 'orchestrator-gates.md'), 'utf-8');
const pipeline = fs.readFileSync(path.join(refs, 'pbi-pipeline.md'), 'utf-8');
const heading = '## Follow-up PBIs for deferred findings';
const section = gates.split(heading)[1].split(/^## /m)[0];
const step6 = pipeline.split('\n').find((l) => l.startsWith('6. **Pull request**'))!;
const ruling = '`Ruling: <k> deferred findings — follow-up candidates in PR body`';

// #481: interactive runs ask once about follow-up PBIs; headless and pbi-runner ask nothing
describe('follow-up PBIs for deferred findings', () => {
  it('asks once with three options and none recommended', () => {
    expect(section).toContain('ask once per PBI');
    expect(section).toContain('Create follow-up PBIs for the <k> deferred findings?');
    for (const o of ['`one PBI per finding`', '`one PBI for all`', '`none (Recommended)`'])
      expect(section).toContain(o);
    expect(section).toMatch(/Only with ≥ 1 deferred finding/);
  });

  it('creates PBIs with a Parent Feature line and sub-issue link via publish.md', () => {
    expect(section).toContain('`Parent Feature: #<feature>`');
    expect(section).toMatch(/native sub-issue of the Feature/);
    expect(section).toContain('`issue-planning` `references/publish.md` (no new script)');
    expect(section).toMatch(/No parent Feature .*no question/);
  });

  it('headless asks nothing, writes no Gate line and appends the exact Ruling', () => {
    expect(section).toMatch(/Headless .* no question and no `Gate:` line/);
    expect(section).toContain(ruling);
    expect(section).toMatch(/never created automatically/);
  });

  it('pipeline step 6 settles follow-ups before pr-writer and notes the question is not a gate', () => {
    expect(step6.indexOf('Follow-up PBIs for deferred findings')).toBeLessThan(
      step6.indexOf('dispatch `pr-writer`')
    );
    expect(step6).toContain(ruling);
    expect(pipeline).toMatch(
      /Not a gate: .*interactive runs only, once per PBI .* never a `Gate:` line/
    );
  });
});
