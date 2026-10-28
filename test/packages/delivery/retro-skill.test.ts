import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const text = fs.readFileSync(
  path.resolve(__dirname, '../../../packages/delivery/.apm/skills/retro/SKILL.md'),
  'utf8'
);

describe('retro SKILL.md', () => {
  it('reads dromos run metrics as JSON and links the contract', () => {
    expect(text).toContain('dromos run metrics');
    expect(text).toContain('--format json');
    expect(text).toContain('docs/run-metrics.md');
  });

  it('takes escalation lines from phase.finished events', () => {
    expect(text).toMatch(/escalation lines[^\n]*`phase\.finished`/i);
  });

  it('keeps the seven columns and the approval rule', () => {
    expect(text).toContain('exactly these seven columns');
    expect(text).toContain("without the user's approval");
  });

  it('has draft PBIs name the skill file and the rule', () => {
    expect(text).toMatch(/names the skill file[^\n]*the rule to change/);
  });

  it('names no ledger artefact', () => {
    for (const term of ['<state>', 'ledger', 'Get-RunMetrics']) {
      expect(text).not.toContain(term);
    }
  });
});
