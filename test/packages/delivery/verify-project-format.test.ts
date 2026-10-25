import * as fs from 'fs';
import * as path from 'path';

const skill = fs.readFileSync(
  path.resolve(__dirname, '../../../packages/delivery/.apm/skills/verify-project/SKILL.md'),
  'utf-8'
);
const step4 = skill.split('\n').find((l) => l.startsWith('4. '))!;

describe('verify-project format check (#383)', () => {
  it('runs the Check command read-only through Format-Changed.ps1 against the integration branch', () => {
    expect(step4).toContain('`Check:`');
    expect(step4).toContain('Format-Changed.ps1 -Check -Base <integration branch>');
    expect(step4).toMatch(/never the format command/);
    expect(step4).toMatch(/never writes/);
  });

  it('treats a non-zero check as fail and an unconfigured one as a note', () => {
    expect(step4).toMatch(/non-zero exit is `status: fail`/);
    expect(step4).toMatch(/names the check and the first file/);
    expect(step4).toMatch(/not configured or `skipped:`/);
  });

  it('stays within 100 lines', () => {
    expect(skill.split('\n').length).toBeLessThanOrEqual(100);
  });
});
