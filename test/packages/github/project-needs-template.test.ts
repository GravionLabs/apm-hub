import * as fs from 'fs';
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
});
