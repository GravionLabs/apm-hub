import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

describe('task file handover to the implementer (#548)', () => {
  const pipeline = read('packages/github/.apm/skills/github-issue/references/pbi-pipeline.md');
  const waves = read('packages/github/.apm/skills/github-issue/references/task-waves.md');
  const implementer = read('packages/agents/.apm/agents/implementer.agent.md');
  const step4 = pipeline.split('\n').find((l) => l.startsWith('4. '))!;

  it('step 4 passes the task file path, not the inline body', () => {
    expect(step4).toContain('<state>/<pbi>/task-<nr>.md');
    expect(step4).not.toContain('goal, files, done-when');
  });

  it('step 4 states the single-task rule and the missing-file redirect', () => {
    expect(step4).toContain('task-p1.md');
    expect(pipeline).toContain('gh issue view <nr> --json title,body');
    expect(pipeline).toContain('> <state>/<pbi>/task-<nr>.md');
    expect(step4).not.toContain('gh issue view');
  });

  it('step 4 names both caches', () => {
    expect(step4).toMatch(/`plan\.json` and `task-<nr>\.md` cache/);
  });

  it('task-waves passes the task file path to every wave implementer', () => {
    const item = waves.split('\n').find((l) => l.startsWith('4. '))!;
    expect(item).toContain('<state>/<pbi>/task-<nr>.md');
    expect(waves).not.toContain('goal, files, done-when');
  });

  it('implementer rule 1 names the task file and falls back to gh only when it is missing', () => {
    const rule = implementer.split('\n').find((l) => l.startsWith('1. '))!;
    expect(rule).toContain('<state>/<issue>/task-<n>.md');
    expect(rule).toContain('gh issue view <nr>');
    expect(rule.indexOf('context file')).toBeLessThan(rule.indexOf('task file'));
  });
});
