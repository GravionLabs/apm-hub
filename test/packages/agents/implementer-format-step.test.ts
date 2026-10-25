import * as fs from 'fs';
import * as path from 'path';

const pk = path.resolve(__dirname, '../../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');

describe('format step of the implementer (#383)', () => {
  const body = read('agents/.apm/agents/implementer.agent.md');
  const rule = body.split('\n').find((l) => l.startsWith('4. '))!;

  it('orders tests, then format, then commit', () => {
    const tests = rule.indexOf('Never commit a red suite');
    const format = rule.indexOf('Format-Changed.ps1');
    expect(tests).toBeGreaterThan(-1);
    expect(format).toBeGreaterThan(tests);
    const commit = body.split('\n').find((l) => l.startsWith('5. '))!;
    expect(body.indexOf(rule)).toBeLessThan(body.indexOf(commit));
  });

  it('names the script, the Format section and forbids formatting the whole tree', () => {
    expect(rule).toContain('scripts/Format-Changed.ps1');
    expect(rule).toContain('## Format');
    expect(rule).toMatch(/never on `\.` or a directory/);
    expect(rule).toMatch(/re-run the targeted tests only if the formatter changed files/);
    expect(rule).toContain('`skipped:`');
  });

  it('keeps the agent body within 40 lines', () => {
    const text = body.split(/^---$/m)[2].trim();
    expect(text.split('\n').length).toBeLessThanOrEqual(40);
  });
});
