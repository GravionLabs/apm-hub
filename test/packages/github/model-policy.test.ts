import * as fs from 'fs';
import * as path from 'path';
import { MODEL_BY_TIER, TIERS } from '../../../src/generators/agent-model-validator';

const policyPath = path.resolve(
  __dirname,
  '../../../packages/github/.apm/skills/github-issue/references/model-policy.md'
);

const section = (doc: string, heading: string): string => {
  const start = doc.indexOf(`## ${heading}`);
  if (start < 0) return '';
  const next = doc.indexOf('\n## ', start + 1);
  return doc.slice(start, next < 0 ? undefined : next);
};

/** Rows of the first markdown table in `text` as cell arrays, header and separator dropped. */
const tableRows = (text: string): string[][] =>
  text
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .slice(2)
    .map((l) =>
      l
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())
    );

describe('model-policy reference', () => {
  const doc = fs.existsSync(policyPath) ? fs.readFileSync(policyPath, 'utf8') : '';

  it('exists next to pbi-pipeline.md', () => {
    expect(fs.existsSync(policyPath)).toBe(true);
    expect(fs.existsSync(path.join(path.dirname(policyPath), 'pbi-pipeline.md'))).toBe(true);
  });

  it('never mentions inherit', () => {
    expect(doc).not.toMatch(/inherit/i);
  });

  it('assigns every tier at least one attribute row', () => {
    const tiers = tableRows(section(doc, 'Tier by attribute')).map((r) => r[1]);
    for (const tier of ['fast', 'standard', 'strong'])
      expect(tiers.some((t) => t.startsWith(`\`${tier}\``))).toBe(true);
  });

  it.each([
    ['planner', 'strong'],
    ['issue-reader', 'fast'],
    ['Final-Verify', 'fast'],
    ['prose only', 'standard'],
    ['size: L', 'strong'],
  ])('maps %s to %s', (attribute, tier) => {
    const row = tableRows(section(doc, 'Tier by attribute')).find((r) => r[0].includes(attribute));
    expect(row, attribute).toBeDefined();
    expect(row![1].startsWith(`\`${tier}\``)).toBe(true);
  });

  it('has a tier-to-model row per tier that matches MODEL_BY_TIER', () => {
    const rows = tableRows(section(doc, 'Tier to model per client'));
    expect(rows.map((r) => r[0])).toEqual(TIERS.map((t) => `\`${t}\``));
    for (const [i, tier] of TIERS.entries()) {
      expect(rows[i][1], tier).toBe(`\`${MODEL_BY_TIER.claude[tier]}\``);
      expect(rows[i][2], tier).toBe(`\`${MODEL_BY_TIER.opencode[tier]}\``);
    }
  });

  it('lists the Copilot CLI ids per tier', () => {
    const rows = tableRows(section(doc, 'Tier to model per client'));
    expect(rows.map((r) => r[3])).toEqual([
      '`claude-haiku-5.5`',
      '`claude-sonnet-5.5`',
      '`claude-opus-5.5`',
    ]);
  });

  it('escalates at fix round 2 and gates after round 3', () => {
    const esc = section(doc, 'Escalation in the fix loop');
    expect(esc).toMatch(
      /Round 2: the second `CHANGES_REQUESTED` with a blocking finding[^\n]*fresh implementer one tier up/
    );
    expect(esc).toMatch(/Round 3:[^\n]*resume the escalated implementer once/);
    expect(esc).toMatch(/after round 3 → gate to the user/);
  });

  it('never escalates for advisory-only rounds or DONE_WITH_CONCERNS', () => {
    const esc = section(doc, 'Escalation in the fix loop');
    expect(esc).toMatch(/Never escalate for an advisory-only round[^\n]*`DONE_WITH_CONCERNS`/);
  });
});
