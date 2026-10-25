import * as fs from 'fs';
import * as path from 'path';

const pk = path.resolve(__dirname, '../../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');
const docs = fs.readFileSync(path.resolve(__dirname, '../../../docs/orchestrator.md'), 'utf-8');

const pipeline = read('github/.apm/skills/github-issue/references/pbi-pipeline.md');
const reviewLead = read('agents/.apm/agents/review-lead.agent.md');
const fanout = read('delivery/.apm/skills/review-fanout/SKILL.md');
const step5 = pipeline.split('\n').find((l) => l.startsWith('5. '))!;

describe('fix round rules (#459)', () => {
  it('fix-round prompt names the targeted test rule and the files of the findings, no full suite', () => {
    expect(step5).toMatch(/the files of the findings/);
    expect(step5).toMatch(/names the targeted test rule/);
    expect(step5).toMatch(/never the full suite in a fix round/);
  });

  it('re-review range is <last review HEAD>..HEAD with blocking/selected dimensions plus correctness', () => {
    expect(step5).toContain('`<last review HEAD>..HEAD`');
    expect(step5).toMatch(/dimensions that had blocking or selected findings plus `correctness`/);
    expect(step5).toMatch(/Final-Verify runs once \(see above\)/);
  });

  it('advisory-only rounds are capped by --advisory-rounds and never escalate', () => {
    expect(step5).toMatch(
      /Advisory-only rounds[^.]*never escalate and are not counted for escalation, only toward `--advisory-rounds`/
    );
    expect(step5).toMatch(/advisory-only rounds are capped by `--advisory-rounds`/);
  });

  it('review-lead accepts range and dimension list and passes them to review-fanout', () => {
    expect(reviewLead).toContain('`<last review HEAD>..HEAD`');
    expect(reviewLead).toMatch(/optionally a dimension list/);
    expect(reviewLead).toMatch(/the dimension list when given/);
    const body = reviewLead.split(/^---$/m)[2];
    expect(body.trim().split('\n').length).toBeLessThanOrEqual(40);
    expect(fanout).toMatch(/dimension list given by the caller replaces them/);
  });

  it('ledger line carries the test count, older lines stay valid', () => {
    expect(pipeline).toContain(
      '`Fix round <r> (#<task>): <result> — model <name> — tests <n>/<m>`'
    );
    expect(pipeline).toMatch(
      /older lines without these parts, including the tests part, stay valid/
    );
    expect(docs).toContain('Fix round 1 (#201): 2 blocking fixed — model sonnet — tests 18/18');
  });

  it('docs/orchestrator.md describes the fix round rules', () => {
    expect(docs).toMatch(/no full suite in a fix round/);
    expect(docs).toMatch(
      /`<last review HEAD>\.\.HEAD` with the dimensions that had blocking or selected findings plus `correctness`/
    );
  });

  it('docs align with the model policy: tiers, round-2 escalation, Claude-only dispatch', () => {
    const read2 = (f: string) =>
      fs.readFileSync(path.resolve(__dirname, '../../../docs', f), 'utf-8');
    expect(docs).toContain('Fix round 2<br/>fresh implementer, one tier up');
    expect(docs).not.toMatch(/Fix round 3<br\/>fresh implementer/);
    expect(docs).toMatch(/Per-dispatch tiers are Claude-only/);
    for (const f of ['concepts/agent-frontmatter.md', 'working-mode.md']) {
      expect(read2(f)).toMatch(/implementer-strong/);
      expect(read2(f)).toMatch(/model-policy\.md/);
    }
  });
});

describe('fix rounds stay inside the issue scope (#481)', () => {
  const implementer = read('agents/.apm/agents/implementer.agent.md');
  const rule = (n: number) => implementer.split('\n').find((l) => l.startsWith(`${n}. `))!;

  it('step 5 states the issue-wins rule, four deferral triggers and three statuses', () => {
    expect(step5).toMatch(/the issue wins over a conflicting finding/);
    for (const t of [
      'a new module',
      'a new fallback or retry path',
      'new I/O',
      'a new security mechanism',
    ]) {
      expect(step5).toContain(t);
    }
    expect(step5).toContain('`deferred`, not implemented');
    expect(step5).toContain('fixed | declined: <reason> | deferred: out of scope — <need>');
  });

  it('implementer rules 3, 7 and 8 name the statuses for report and reply', () => {
    expect(rule(3)).toMatch(/issue wins over a conflicting finding/);
    expect(rule(3)).toMatch(/new module.*fallback or retry path.*new I\/O.*security mechanism/);
    expect(rule(7)).toContain('`fixed`');
    expect(rule(7)).toContain('`declined: <reason>`');
    expect(rule(7)).toContain('`deferred: out of scope — <need>`');
    expect(rule(8)).toContain('`Findings:`');
    expect(rule(8)).toMatch(/declined or deferred findings by `file:line`/);
    expect(rule(8)).toMatch(/at most 15 lines/);
  });
});

describe('fix round review advisories (#481)', () => {
  const impl = read('agents/.apm/agents/implementer.agent.md');

  it('never defers a blocking security finding', () => {
    expect(impl).toMatch(/except a blocking security finding/);
    expect(pipeline).toMatch(/except a blocking security finding, which is never deferred/);
  });

  it('merges rulings across rounds and passes follow-up numbers to pr-writer', () => {
    expect(pipeline).toMatch(/merge those statuses into `<state>\/<pbi>\/rulings\.json`/);
    expect(pipeline).toMatch(/never overwrite the file/);
    expect(pipeline).toMatch(/follow-up `#<n>` per deferred finding/);
  });

  it('keeps the implementer reply within the cap', () => {
    expect(impl).toMatch(/at most 5 declined or deferred findings/);
  });
});
