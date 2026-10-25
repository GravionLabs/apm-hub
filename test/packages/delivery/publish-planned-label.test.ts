import * as fs from 'fs';
import * as path from 'path';

const refs = path.resolve(
  __dirname,
  '../../../packages/delivery/.apm/skills/issue-planning/references'
);
const publish = fs.readFileSync(path.join(refs, 'publish.md'), 'utf-8');
const schema = fs.readFileSync(path.join(refs, 'plan-schema.md'), 'utf-8');

describe('publish sets label planned on the PBI (#596)', () => {
  it('creates the label idempotently with colour and description', () => {
    expect(publish).toContain('gh label create planned --force --color 0E8A16');
    expect(publish).toContain(
      '--description "Task breakdown published or single-task plan approved"'
    );
  });

  it('adds the label to the PBI', () => {
    expect(publish).toContain('gh issue edit <pbi> --add-label planned');
  });

  it('documents both triggers', () => {
    expect(publish).toMatch(/Tasks were published/);
    expect(publish).toMatch(/single task: right after the user approved/);
  });

  it('plan-schema names the label exception', () => {
    expect(schema).toContain('publish is a no-op except the label `planned`');
  });
});
