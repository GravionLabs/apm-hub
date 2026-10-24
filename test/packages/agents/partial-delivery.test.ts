import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../..', p), 'utf-8');
const prSkill = read('packages/github/.apm/skills/github-pull-request/SKILL.md');
const prWriter = read('packages/agents/.apm/agents/pr-writer.agent.md');
const pipeline = read('packages/github/.apm/skills/github-issue/references/pbi-pipeline.md');
const selection = read('packages/github/.apm/skills/github-issue/references/next-selection.md');

// #363: a PR that leaves Tasks or criteria open must not close the PBI at release
describe('partial PBI delivery', () => {
  it('github-pull-request takes not_delivered and switches the footer to Refs', () => {
    expect(prSkill).toMatch(/`not_delivered` \(default: empty\)/);
    expect(prSkill).toMatch(
      /`not_delivered` non-empty: add `## Not delivered`[^\n]*`Refs #<issue_number>` instead of `Closes`/
    );
    expect(prSkill).toMatch(/Never write `Closes` for an issue with an undelivered/);
  });

  it('pr-writer passes the list on and reports refs instead of closes', () => {
    expect(prWriter).toMatch(/`not_delivered` and `auto_merge: false`/);
    expect(prWriter).toMatch(/"refs": <issue>` instead of `"closes"`/);
  });

  it('the pipeline hands open Tasks to pr-writer and tracks deferred criteria as Tasks', () => {
    const step6 = pipeline.split('\n').find((l) => /^6\.\s/.test(l));
    expect(step6).toMatch(
      /not-delivered list \(every open Task sub-issue without a `Refs #<task>` commit/
    );
    expect(step6).toMatch(/`Refs #<pbi>` and `## Not delivered`/);
    expect(pipeline).toMatch(/defers here or at a later gate gets a `\[Task\]` sub-issue/);
  });

  it('next-selection keeps a partly delivered PBI selectable', () => {
    expect(selection).toMatch(
      /a PBI with an open `task` child that is not merged[^\n]*is not merged even with a merged PR/
    );
  });
});
