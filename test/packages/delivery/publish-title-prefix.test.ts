import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const skill = path.resolve(__dirname, '../../../packages/delivery/.apm/skills/issue-planning');
const read = (f: string) => readFileSync(path.join(skill, f), 'utf8');

describe('issue-planning level prefix', () => {
  const publish = read('references/publish.md');

  it('publish names the prefix per level', () => {
    expect(publish).toContain('`feature` → `[Feature] `');
    expect(publish).toContain('`pbi` → `[PBI] `');
    expect(publish).toContain('`task` → `[Task] `');
  });

  it('publish prefixes a bug item under a Feature as PBI', () => {
    expect(publish).toMatch(/also for an item with label `bug` under a Feature/);
  });

  it('publish never doubles an existing prefix', () => {
    expect(publish).toContain('^\\[(Epic|Feature|PBI|Task|Bug)\\] ');
    expect(publish).toContain('is not prefixed again');
  });

  it('plan-schema says titles are summaries without prefix', () => {
    const row = read('references/plan-schema.md')
      .split('\n')
      .find((l) => l.startsWith('| `items[].title`'));
    expect(row).toContain('Summary without level prefix');
  });

  it('SKILL.md no longer prescribes a "Feature: " title', () => {
    const s = read('SKILL.md');
    expect(s).not.toMatch(/Titles are conventional[^\n]*`Feature: `/);
    expect(s).not.toContain('Features (`Feature: …`)');
  });
});
