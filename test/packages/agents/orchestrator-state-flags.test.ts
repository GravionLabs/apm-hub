import * as fs from 'fs';
import * as path from 'path';
import { orchestrator, pk, read } from './orchestrator-state.helpers';

describe('orchestrator flags: overview and review summary', () => {
  const gates = read('github/.apm/skills/github-issue/references/orchestrator-gates.md');
  const prompt = read('delivery/.apm/prompts/orch.prompt.md');
  const working = fs.readFileSync(
    path.resolve(__dirname, '../../../docs/working-mode.md'),
    'utf-8'
  );

  it.each([
    ['agent', orchestrator],
    ['working-mode', working],
    ['gates reference', gates],
  ])('%s documents both flags', (_n, md) => {
    expect(md).toContain('--no-overview');
    expect(md).toContain('--no-review-summary');
  });

  it.each([
    ['working-mode', working],
    [
      'orchestrator doc',
      fs.readFileSync(path.resolve(__dirname, '../../../docs/orchestrator.md'), 'utf-8'),
    ],
    ['launcher skill', read('agents/.apm/skills/orchestrator/SKILL.md')],
  ])('%s documents --fix-advisories', (_n, md) => {
    expect(md).toContain('--fix-advisories');
  });

  it('working-mode lists the policies and the headless Gate removal', () => {
    expect(working).toMatch(/--fix-advisories none\\\|medium\\\|all/);
    expect(working).toMatch(
      /--fix-advisories` set, without it \(headless default `medium`\) or the `--advisory-rounds` limit reached, the review summary writes no `Gate:`/
    );
    expect(working).toContain('documented there once #227 lands');
  });

  it('orch prompt is a one-line deprecation pointing to the agent', () => {
    const [, frontmatter, ...rest] = prompt.split(/^---$/m);
    expect(frontmatter).toMatch(/^description: "Deprecated, use the orchestrator agent/m);
    expect(prompt).toContain('--agent orchestrator');
    expect(rest.join('---').trim().split('\n')).toHaveLength(1);
  });

  it('agent states the defaults and delegates to the reference', () => {
    expect(orchestrator).toContain('neither an issue number nor a description');
    expect(orchestrator).toContain('orchestrator-gates.md');
  });

  it('overview runs only without issue number and description', () => {
    expect(gates).toContain('only when the first message has no issue number and no description');
    expect(gates).not.toContain('a sentence without');
    expect(working).toContain('neither an issue number nor a description');
  });

  it('--no-review-summary: only blocking findings trigger fix rounds', () => {
    expect(gates).toMatch(/With `--no-review-summary` only blocking findings trigger fix rounds/);
    expect(gates).toContain('`incomplete: true` stays blocking');
    expect(gates).toContain('followed by a re-review');
  });

  it('--fix-advisories policy table, ledger line, alias and validation', () => {
    expect(gates).toContain('--fix-advisories none|medium|all[:dim,dim]');
    expect(gates).toContain('| `none` | no advisory | all advisories |');
    expect(gates).toContain('| `medium` | MEDIUM and above (CRITICAL, HIGH, MEDIUM) | LOW |');
    expect(gates).toContain('| `all` | every advisory | none |');
    expect(gates).toContain('Advisory policy: <policy> — fixing <n>, PR body <m>');
    expect(gates).toContain('Ruling: advisory policy <policy> — <n> fixed, <m> to PR body');
    expect(gates).toContain('alias of `--fix-advisories none`');
    expect(gates).toContain('^(none|medium|all)(:[a-z][a-z-]*(,[a-z][a-z-]*)*)?$');
    expect(gates).toContain('`--fix-advisories=medium` is not accepted');
    expect(gates).toMatch(/Unknown policy or dimension[^\n]*never guess/);
    expect(gates).toMatch(/Blocking findings and `incomplete: true` always go to the fix round/);
    expect(gates).toContain('never from a description, issue body or ledger content');
  });

  it('explicit policy wins over --no-review-summary, which then only hides the summary', () => {
    expect(gates).toContain(
      'the explicit policy wins and `--no-review-summary` only hides the summary display'
    );
    expect(orchestrator).toContain('it wins over `--no-review-summary`');
  });

  it('headless without --fix-advisories applies medium, explicit flag wins, interactive asks', () => {
    expect(gates).toContain('Headless default: no question tool and no `--fix-advisories`');
    expect(gates).toContain('Advisory policy: medium (default, headless)');
    expect(gates).toContain(
      'Ruling: advisory policy medium (headless default) — <n> fixed, <m> to PR body'
    );
    expect(gates).toContain('An explicit `--fix-advisories` (incl. `none`) always wins');
    expect(gates).toContain('(and no `--no-review-summary`)');
    expect(gates).toContain('an unknown value still gates');
    expect(gates).toContain('per application (the advisories of that review), not cumulative');
    expect(gates).toContain('ask which advisory findings to fix (interactive)');
    expect(gates).toContain('Without the flag in an interactive run the behaviour is unchanged');
    expect(gates).toContain('else the headless default `medium`) or the `--advisory-rounds` limit');
    expect(orchestrator).toContain('(headless default `medium`)');
  });

  it('policy is re-applied per re-review and leftovers never gate', () => {
    expect(gates).toContain('re-applied to the advisories of each re-review');
    expect(gates).toContain('never trigger a `Gate:`');
  });

  it.each([
    ['working-mode', working],
    [
      'orchestrator doc',
      fs.readFileSync(path.resolve(__dirname, '../../../docs/orchestrator.md'), 'utf-8'),
    ],
  ])('%s documents --advisory-rounds', (_n, md) => {
    expect(md).toContain('--advisory-rounds');
  });

  it('agent applies the policy in step 5 and exempts it from the headless gate', () => {
    expect(orchestrator).toContain('with `--fix-advisories` apply that policy without asking');
    expect(orchestrator).toMatch(
      /Exempt: the review summary \(headless default `medium` without `--fix-advisories`\) or the `--advisory-rounds` limit/
    );
    expect(orchestrator).toContain('never from a description, issue body or ledger');
  });

  it('headless Gate rule in overview and review-summary sections', () => {
    const [, overview, summary] = gates.split(/^## /m);
    expect(overview).toContain('Headless:');
    expect(overview).toContain('Gate: Which issue?');
    expect(summary).toContain('Headless');
    expect(summary).toContain('Gate: <question>');
  });

  it('headless overview uses a ledger path without an issue directory', () => {
    expect(gates).toContain('`<state>/overview.md`');
    expect(gates).not.toContain('info/exclude');
  });

  it('reference reuses the merged-task rule and lists findings by severity', () => {
    expect(gates).toContain('"Task merged"');
    expect(gates).toContain('task-issues.md');
    expect(gates).toContain('severity file:line issue');
    expect(gates).toContain('blocking first');
    expect(gates).toContain('MEDIUM');
  });

  it('gates point PBIs and Features at the one merged definition in next-selection.md', () => {
    const selection = read('github/.apm/skills/github-issue/references/next-selection.md');
    expect(gates).toContain('next-selection.md');
    expect(gates).toContain('Merged (closes at release)');
    expect(selection.match(/^## Merged \(closes at release\)$/gm)).toHaveLength(1);
    expect(gates).not.toContain('git log');
    expect(gates).not.toContain('gh pr list');
    expect(gates).toMatch(/Task[^.]*"Task merged"[^.]*`task-issues\.md`/);
    expect(gates).toMatch(/PBI or Feature `Merged \(closes at release\)`/);
  });

  it('docs mention the merged drop in the end line and the next mode', () => {
    const docs = (f: string) => fs.readFileSync(path.join(pk, '../docs', f), 'utf-8');
    expect(docs('orchestrator.md')).toContain('merged, closes at release');
    expect(docs('working-mode.md')).toContain('merged, closes at release');
  });

  it('github-issue links the gates reference', () => {
    expect(read('github/.apm/skills/github-issue/SKILL.md')).toContain(
      'references/orchestrator-gates.md'
    );
  });
});
