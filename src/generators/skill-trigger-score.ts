import * as fs from 'fs';

export const MIN_TRIGGER_RATE = 80;
export const MAX_FALSE_TRIGGER_RATE = 10;
export const MAX_DROP = 5;

/** One prompt run: which skills the model invoked for it. */
export interface RunRecord {
  skill: string;
  kind: 'positive' | 'negative';
  prompt: string;
  invoked: string[];
}

export interface Rates {
  positives: number;
  negatives: number;
  /** Percent of positive runs where the expected skill was invoked (0-100). */
  triggerRate: number;
  /** Percent of negative runs where the skill was invoked anyway (0-100). */
  falseTriggerRate: number;
}

export interface SkillRates extends Rates {
  skill: string;
}

export interface Summary {
  overall: Rates;
  skills: SkillRates[];
}

export interface ScoreResult {
  summary: Summary;
  records: RunRecord[];
  thresholdFailures: string[];
  regressions: string[];
}

/** Skill names from Skill tool_use blocks in a stream-json transcript (JSON lines). `plugin:skill` becomes `skill`. */
export function extractInvokedSkills(transcript: string): string[] {
  const found: string[] = [];
  for (const line of transcript.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let ev: any;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    if (ev?.type !== 'assistant' || !Array.isArray(ev.message?.content)) continue;
    for (const block of ev.message.content) {
      if (block?.type === 'tool_use' && block.name === 'Skill' && typeof block.input?.skill === 'string') {
        found.push(block.input.skill.split(':').pop() as string);
      }
    }
  }
  return found;
}

const pct = (n: number, d: number): number => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

function rates(records: RunRecord[], hit: (r: RunRecord) => boolean): Rates {
  const pos = records.filter((r) => r.kind === 'positive');
  const neg = records.filter((r) => r.kind === 'negative');
  return {
    positives: pos.length,
    negatives: neg.length,
    triggerRate: pct(pos.filter(hit).length, pos.length),
    falseTriggerRate: pct(neg.filter(hit).length, neg.length),
  };
}

/** Per-skill and overall trigger / false-trigger rates. */
export function summarize(records: RunRecord[]): Summary {
  const hit = (r: RunRecord) => r.invoked.includes(r.skill);
  const names = [...new Set(records.map((r) => r.skill))].sort();
  return {
    overall: rates(records, hit),
    skills: names.map((skill) => ({ skill, ...rates(records.filter((r) => r.skill === skill), hit) })),
  };
}

/** Violations of the absolute thresholds (overall and per skill). */
export function checkThresholds(s: Summary): string[] {
  const out: string[] = [];
  const check = (label: string, r: Rates) => {
    if (r.positives > 0 && r.triggerRate < MIN_TRIGGER_RATE)
      out.push(`${label}: trigger rate ${r.triggerRate}% < ${MIN_TRIGGER_RATE}%`);
    if (r.negatives > 0 && r.falseTriggerRate > MAX_FALSE_TRIGGER_RATE)
      out.push(`${label}: false-trigger rate ${r.falseTriggerRate}% > ${MAX_FALSE_TRIGGER_RATE}%`);
  };
  check('overall', s.overall);
  for (const k of s.skills) check(k.skill, k);
  return out;
}

/** Regressions versus a baseline: trigger rate drops or false-trigger rate rises by more than maxDrop points. */
export function compareToBaseline(current: Summary, baseline: Summary, maxDrop = MAX_DROP): string[] {
  const out: string[] = [];
  const cmp = (label: string, cur: Rates, base: Rates) => {
    if (base.triggerRate - cur.triggerRate > maxDrop)
      out.push(`${label}: trigger rate fell ${base.triggerRate}% -> ${cur.triggerRate}%`);
    if (cur.falseTriggerRate - base.falseTriggerRate > maxDrop)
      out.push(`${label}: false-trigger rate rose ${base.falseTriggerRate}% -> ${cur.falseTriggerRate}%`);
  };
  cmp('overall', current.overall, baseline.overall);
  for (const cur of current.skills) {
    const base = baseline.skills.find((b) => b.skill === cur.skill);
    if (base) cmp(cur.skill, cur, base);
  }
  return out;
}

export function score(records: RunRecord[], baseline?: Summary): ScoreResult {
  const summary = summarize(records);
  return {
    summary,
    records,
    thresholdFailures: checkThresholds(summary),
    regressions: baseline ? compareToBaseline(summary, baseline) : [],
  };
}

/**
 * CLI (used by scripts/Invoke-TriggerEvals.ps1):
 *   extract <transcript.jsonl>                      prints the invoked skills as a JSON array
 *   score <records.json> <out.json> [baseline.json] writes the result, exits 1 on threshold failure or regression
 */
function main(argv: string[]): number {
  const [cmd, a, b, c] = argv;
  if (cmd === 'extract' && a) {
    console.log(JSON.stringify(extractInvokedSkills(fs.readFileSync(a, 'utf8'))));
    return 0;
  }
  if (cmd === 'score' && a && b) {
    const records: RunRecord[] = JSON.parse(fs.readFileSync(a, 'utf8'));
    const baseline: Summary | undefined = c ? JSON.parse(fs.readFileSync(c, 'utf8')).summary : undefined;
    const result = score(records, baseline);
    fs.writeFileSync(b, JSON.stringify(result, null, 2));
    console.log(`trigger ${result.summary.overall.triggerRate}%  false-trigger ${result.summary.overall.falseTriggerRate}%`);
    for (const m of [...result.thresholdFailures, ...result.regressions]) console.log(`FAIL ${m}`);
    return result.thresholdFailures.length + result.regressions.length > 0 ? 1 : 0;
  }
  console.error('usage: extract <transcript> | score <records> <out> [baseline]');
  return 2;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
