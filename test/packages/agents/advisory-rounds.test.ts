import * as fs from 'fs';
import * as path from 'path';

const refs = path.resolve(
  __dirname,
  '../../../packages/github/.apm/skills/github-issue/references'
);
const gates = fs.readFileSync(path.join(refs, 'orchestrator-gates.md'), 'utf-8');
const pipeline = fs.readFileSync(path.join(refs, 'pbi-pipeline.md'), 'utf-8');
const heading = '### Advisory round limit (`--advisory-rounds <n>`)';
if (!gates.includes(heading)) throw new Error(`missing section: ${heading}`);
const section = gates.split(heading)[1].split(/^(?:##|Headless)/m)[0];
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../../../', p), 'utf-8');
const step5 = pipeline.split('\n').find((l) => l.startsWith('5. '))!;

describe('--advisory-rounds (#480)', () => {
  it('has its own subsection after the advisory policy', () => {
    expect(gates.indexOf('### Advisory policy')).toBeLessThan(
      gates.indexOf('### Advisory round limit')
    );
    expect(gates).toContain('`orchestrator --advisory-rounds 2 full 123`');
  });

  it('parses like --fix-advisories: unquoted token, own first message, ^[0-5]$, no = form', () => {
    expect(section).toMatch(/separate unquoted token of the invoker's own first message/);
    expect(section).toMatch(/removed with the flag/);
    expect(section).toContain('`--advisory-rounds=1` is not accepted');
    expect(section).toContain('`^[0-5]$`');
    expect(section).toMatch(/missing or invalid value stops and asks/);
    expect(section).toMatch(/or appends `Gate: <question>` \(headless\)/);
  });

  it('defaults to 1 and 0 sends every advisory to the PR body', () => {
    expect(section).toMatch(/Default `1`; `0` sends every advisory to the PR body/);
  });

  it('counter starts at the first APPROVE and ignores blocking rounds', () => {
    expect(section).toMatch(/starts at 0 at the first `APPROVE`/);
    expect(section).toMatch(/only advisories \(no blocking finding, no `incomplete`\) increments/);
    expect(section).toMatch(/round with a blocking finding does not count/);
    expect(section).toContain('fix-round-3 cap');
  });

  it('limit ruling: no question, no Gate, exact ledger line', () => {
    expect(section).toMatch(/no question, no `Gate:`, no fix round for advisories/);
    expect(section).toContain('`Ruling: advisory round limit <n> reached — <m> to PR body`');
  });

  it('blocking finding after the limit still gets a fix round', () => {
    expect(section).toMatch(/after the limit still gets a fix round \(blocking findings only/);
  });

  it('--fix-advisories applies only below the limit', () => {
    expect(section).toMatch(/applies only while the counter is below `<n>`/);
    expect(section).toMatch(/limit ruling replaces the policy ruling/);
  });

  it('light check: Final-Verify plus correctness-only delta review', () => {
    expect(section).toMatch(/Final-Verify plus a delta re-review/);
    expect(section).toContain('`<last review HEAD>..HEAD`');
    expect(section).toMatch(/in the `correctness` dimension only; no full re-fanout/);
  });

  it('question format: first line, exactly three options, no bulk LOW', () => {
    expect(section).toContain('`Round <r> — advisories <a1> → <a2> → …`');
    expect(section).toContain(
      'options exactly "all to PR body (Recommended)", "MEDIUM and above", "selection"'
    );
    expect(section).toMatch(/no option fixes LOW in bulk/);
    expect(section).toMatch(/not offered again/);
  });

  it('keeps the phrases other tests rely on', () => {
    expect(gates).toContain('alias of `--fix-advisories none`');
    expect(gates).toContain('`--fix-advisories=medium` is not accepted');
  });

  it('pbi-pipeline step 5 and gate list reference the limit and the light check', () => {
    expect(step5).toMatch(/capped by `--advisory-rounds` \(default 1, `orchestrator-gates\.md`\)/);
    expect(step5).toMatch(/light check \(Final-Verify plus a `correctness`-only delta review\)/);
    expect(step5).toMatch(/except after an advisory-only round/);
    expect(pipeline).toMatch(/nor once `--advisory-rounds` is reached/);
  });

  it('counter is recovered from the ledger and the question shows the round cost', () => {
    expect(section).toMatch(/derived from the ledger, never held in memory/);
    expect(section).toContain('`Fix round` lines with result `advisory`');
    expect(section).toMatch(/validated integer 0-5/);
    expect(section).toMatch(/Another round costs:/);
  });

  it('headless exemption names both the policy and the limit', () => {
    const headless = gates.split(/^Headless \(no question tool\)/m)[1].split('\n')[0];
    expect(headless).toMatch(/`--fix-advisories` is set[^.]*`--advisory-rounds` limit is reached/);
  });

  it('flag, range and default agree across agents, skill, loop and docs', () => {
    const files = [
      'packages/agents/.apm/agents/orchestrator.agent.md',
      'packages/agents/.apm/agents/pbi-runner.agent.md',
      'packages/agents/.apm/skills/orchestrator/SKILL.md',
      'packages/github/.apm/skills/github-issue/references/loop-mode.md',
      'docs/orchestrator.md',
      'docs/working-mode.md',
    ];
    for (const f of files) expect(read(f)).toContain('--advisory-rounds');
    for (const f of [files[0], files[2], files[5]])
      expect(read(f)).toContain('--advisory-rounds <0-5>');
    expect(read(files[3])).toMatch(
      /forwards `--fix-advisories`, `--advisory-rounds` and `--no-review-summary` verbatim/
    );
    expect(read(files[0])).toContain('`--advisory-rounds <0-5>` (default 1');
    expect(read(files[5])).toContain('(default `1`)');
  });
});
