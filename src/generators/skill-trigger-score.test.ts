import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  extractInvokedSkills,
  summarize,
  checkThresholds,
  compareToBaseline,
  score,
  RunRecord,
} from './skill-trigger-score';

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const line = (o: unknown) => JSON.stringify(o);
const transcript = [
  line({ type: 'system', subtype: 'init', skills: ['review-fanout'] }),
  line({ type: 'assistant', message: { content: [{ type: 'text', text: 'Let me load a skill.' }] } }),
  line({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'review-fanout' } }] },
  }),
  line({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'ls' } }] } }),
  'not json at all',
  line({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'delivery:verify-project' } }] },
  }),
  line({ type: 'result', result: 'done' }),
].join('\n');

const rec = (skill: string, kind: RunRecord['kind'], invoked: string[]): RunRecord => ({
  skill,
  kind,
  prompt: `${skill}-${kind}`,
  invoked,
});

describe('extractInvokedSkills', () => {
  it('returns Skill tool_use names in order, strips plugin prefix, ignores other tools and noise', () => {
    expect(extractInvokedSkills(transcript)).toEqual(['review-fanout', 'verify-project']);
  });

  it('returns an empty list for an empty transcript or one without skill calls', () => {
    expect(extractInvokedSkills('')).toEqual([]);
    expect(extractInvokedSkills(line({ type: 'result' }))).toEqual([]);
  });

  it('works on a transcript read from disk', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trigger-score-'));
    tmpDirs.push(dir);
    const f = path.join(dir, 't.jsonl');
    fs.writeFileSync(f, transcript);
    expect(extractInvokedSkills(fs.readFileSync(f, 'utf8'))).toHaveLength(2);
  });
});

describe('summarize', () => {
  const records = [
    rec('a', 'positive', ['a']),
    rec('a', 'positive', []),
    rec('a', 'negative', []),
    rec('a', 'negative', ['a']),
    rec('b', 'positive', ['b']),
    rec('b', 'negative', ['other']),
  ];

  it('computes per-skill trigger and false-trigger rates', () => {
    const s = summarize(records);
    expect(s.skills.find((k) => k.skill === 'a')).toMatchObject({ triggerRate: 50, falseTriggerRate: 50 });
    expect(s.skills.find((k) => k.skill === 'b')).toMatchObject({ triggerRate: 100, falseTriggerRate: 0 });
  });

  it('computes overall rates', () => {
    expect(summarize(records).overall).toEqual({
      positives: 3,
      negatives: 3,
      triggerRate: 66.7,
      falseTriggerRate: 33.3,
    });
  });

  it('handles no records', () => {
    expect(summarize([]).overall).toMatchObject({ triggerRate: 0, falseTriggerRate: 0 });
  });
});

describe('checkThresholds', () => {
  it('passes at exactly 80% / 10%', () => {
    const rs = [
      ...Array.from({ length: 5 }, (_, i) => rec('a', 'positive', i < 4 ? ['a'] : [])),
      ...Array.from({ length: 10 }, (_, i) => rec('a', 'negative', i < 1 ? ['a'] : [])),
    ];
    expect(checkThresholds(summarize(rs))).toEqual([]);
  });

  it('reports low trigger and high false-trigger rates', () => {
    const msgs = checkThresholds(summarize([rec('a', 'positive', []), rec('a', 'negative', ['a'])]));
    expect(msgs).toContain('a: trigger rate 0% < 80%');
    expect(msgs).toContain('a: false-trigger rate 100% > 10%');
  });
});

describe('compareToBaseline', () => {
  const base = summarize([rec('a', 'positive', ['a']), rec('a', 'negative', [])]);

  it('reports no regression for identical results', () => {
    expect(compareToBaseline(base, base)).toEqual([]);
  });

  it('flags a drop greater than 5 points but not exactly 5', () => {
    const mk = (hits: number) =>
      summarize([...Array.from({ length: 20 }, (_, i) => rec('a', 'positive', i < hits ? ['a'] : []))]);
    expect(compareToBaseline(mk(19), mk(20))).toEqual([]); // 95 vs 100 = 5 points
    expect(compareToBaseline(mk(18), mk(20))).toEqual([
      'overall: trigger rate fell 100% -> 90%',
      'a: trigger rate fell 100% -> 90%',
    ]);
  });

  it('flags a false-trigger rise and ignores skills absent from the baseline', () => {
    const cur = summarize([rec('a', 'positive', ['a']), rec('a', 'negative', ['a']), rec('new', 'positive', [])]);
    const msgs = compareToBaseline(cur, base);
    expect(msgs).toContain('a: false-trigger rate rose 0% -> 100%');
    expect(msgs.some((m) => m.startsWith('new:'))).toBe(false);
  });
});

describe('score', () => {
  it('combines thresholds and baseline regressions', () => {
    const base = summarize([rec('a', 'positive', ['a'])]);
    const r = score([rec('a', 'positive', [])], base);
    expect(r.thresholdFailures.length).toBeGreaterThan(0);
    expect(r.regressions).toContain('a: trigger rate fell 100% -> 0%');
  });

  it('has no regressions without a baseline', () => {
    expect(score([rec('a', 'positive', ['a'])]).regressions).toEqual([]);
  });
});
