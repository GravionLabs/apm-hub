import * as fs from 'fs';
import * as path from 'path';

const pk = path.resolve(__dirname, '../../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');

const skill = read('github/.apm/skills/github-issue/SKILL.md');
const standalone = read('github/.apm/skills/github-issue/references/standalone-issue.md');

describe('two-stage verify rule (#447)', () => {
  it('SKILL.md: per commit build only when compiled sources changed plus targeted tests, one full run per PBI', () => {
    expect(skill).not.toContain('build + full test suite');
    expect(skill).toMatch(/build only when the stack compiles and compiled sources changed/);
    expect(skill).toMatch(/targeted tests/);
    expect(skill).toMatch(/never the full suite/);
    expect(skill).toMatch(/ONE full run \(Final-Verify\)/);
    expect(skill).toMatch(/again after the last fix round/);
    expect(skill).toMatch(/Never commit or move on with a red run/);
  });

  it('standalone-issue step 9 states the same two-stage rule', () => {
    const step = standalone.split('\n').find((l) => l.startsWith('9. '))!;
    expect(step).toMatch(/build only when the stack compiles and compiled sources changed/);
    expect(step).toMatch(/targeted tests/);
    expect(step).toMatch(/never the full suite/);
    expect(step).toMatch(/ONE full build \+ test suite run \(Final-Verify\)/);
    expect(step).toMatch(/after the last fix round/);
    expect(step).toMatch(/never commit red/);
  });
});
