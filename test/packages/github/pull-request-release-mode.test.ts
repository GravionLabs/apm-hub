import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../..', p), 'utf-8');
const prDir = 'packages/github/.apm/skills/github-pull-request';
const prSkill = read(`${prDir}/SKILL.md`);
const releaseRef = fs.existsSync(
  path.resolve(__dirname, '../../..', `${prDir}/references/release-mode.md`)
)
  ? read(`${prDir}/references/release-mode.md`)
  : '';
const prAll = `${prSkill}\n${releaseRef}`;
const releaseSkill = read('packages/github/.apm/skills/github-release/SKILL.md');
const step8 = releaseSkill.slice(releaseSkill.indexOf('\n8. '), releaseSkill.indexOf('\n9. '));

// #668: github-release finish needs a PR path for release heads without an issue number
describe('github-pull-request release mode', () => {
  it('defines release mode by head regex and default-branch base, no issue_number needed', () => {
    expect(prAll).toContain('^release/(next|[0-9]+\\.[0-9]+)$');
    expect(prAll).toMatch(/defaultBranchRef/);
    expect(prAll).toMatch(
      /release mode[^\n]*no `issue_number`|no `issue_number`[^\n]*release mode/i
    );
  });

  it('closes only the Feature, and only when feature_number is passed', () => {
    expect(prAll).toMatch(/`Closes #<feature_number>` only when `feature_number` is passed/);
    expect(prAll).toMatch(/no footer/);
    expect(prAll).toMatch(/footer `none`/);
  });

  it('still stops for a non-release head without a number', () => {
    expect(prSkill).toMatch(/stop when neither exists/);
    expect(prAll).toMatch(/Every other head without a number still stops/);
  });

  it('keeps auto_merge false, non-empty PR, pushed branch and CHANGELOG.md untouched', () => {
    expect(prAll).toMatch(/release mode[^\n]*`auto_merge` (is )?forced false/i);
    expect(prSkill).toMatch(/Never create an empty PR/);
    expect(prSkill).toMatch(/Branch must be pushed/);
    expect(prAll).toMatch(/Release mode never modifies `CHANGELOG\.md`/);
  });

  it('github-release step 8 passes release-mode inputs and forbids gh pr create', () => {
    expect(step8).toMatch(/`title: release: <branch>`/);
    expect(step8).toMatch(/merged_prs/);
    expect(step8).toMatch(/`feature_number: <nr>`[^\n]*(only|if)/);
    expect(step8).toMatch(/`auto_merge: false`/);
    expect(step8).toMatch(/never[^\n]*`gh pr create`/i);
  });
});
