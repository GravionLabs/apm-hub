import * as fs from 'fs';
import * as path from 'path';

const publish = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../packages/delivery/.apm/skills/issue-planning/references/publish.md'
  ),
  'utf-8'
);

describe('publish keeps Task bodies as task-<nr>.md (#548)', () => {
  it('names the cache path', () => {
    expect(publish).toContain('<state>/<pbi>/task-<nr>.md');
  });

  it('starts the file with the issue title as heading', () => {
    expect(publish).toContain('first line `# [Task] <title>`');
  });

  it('re-run rule: skip created items, overwrite a missing file, never append', () => {
    expect(publish).toMatch(/already non-null is skipped/);
    expect(publish).toMatch(/Overwrite, never append/);
    expect(publish).toContain('gh issue view <nr> --json title,body');
  });

  it('writes the cache from the published issue, not from plan.json', () => {
    expect(publish).toMatch(/never write it from the `plan\.json` `body`/);
  });

  it('leaves feature and pbi levels on a temporary body file', () => {
    expect(publish).toMatch(/Levels `feature` and `pbi` use a temporary body file/);
  });
});
