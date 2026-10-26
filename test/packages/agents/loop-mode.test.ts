import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const orchestrator = read('packages/agents/.apm/agents/orchestrator.agent.md');
const reference = read('packages/github/.apm/skills/github-issue/references/loop-mode.md');
const gates = read('packages/github/.apm/skills/github-issue/references/orchestrator-gates.md');
const selection = read('packages/github/.apm/skills/github-issue/references/next-selection.md');
const skill = read('packages/github/.apm/skills/github-issue/SKILL.md');
const docs = read('docs/orchestrator.md');
const workingMode = read('docs/working-mode.md');

const body = orchestrator.split(/^---$/m)[2];
const description = /^description: (.*)$/m.exec(orchestrator)![1];
/** The loop sentence(s) of the mode rule: from `loop <feature|epic>` to the end of that paragraph. */
const loopRule = body.slice(body.indexOf('`loop <feature|epic>`')).split('\n')[0];
const report = body.slice(body.indexOf('Report at the end'));
/** `## <heading>` section of the reference, up to the next `## `. */
const section = (text: string, heading: string) => text.split(`## ${heading}`)[1].split(/^## /m)[0];

// the vocabulary shared by agent, reference and docs: one place to change it
const LEDGER = '<state>/loop-<nr>/progress.md';
const HEADER = '# orchestrator ledger — loop #<nr> — branch <branch>';
const DONE_LINE = 'Loop: PBI #<nr> done — <pr>';
const STOP_LINE = 'Loop: stopped — <reason>';
const STOP_REASONS = [
  'nothing selectable',
  'headless gate: <question>',
  'context warning',
  'pbi cap',
  'user stop',
];
const RUNNER_REASONS = ['runner blocked', 'runner failed'];
const RESUME_LINE = 'orchestrator loop <feature> after /clear';

describe('orchestrator agent: loop mode', () => {
  it('lists loop as the fifth mode in the description', () => {
    expect(description).toContain('plan|implement|full|next|loop');
    expect(description).toMatch(/loop runs the PBIs of a Feature or Epic/);
  });

  it('exempts loop from one PBI per run and rejects a loop description', () => {
    expect(body).toMatch(/one PBI per run \(except `loop`\)/i);
    expect(body).toMatch(/`next` takes none, nor does `loop`/);
  });

  it('keeps only the pointer and the contract in the loop rule', () => {
    expect(loopRule).toContain('`github-issue` `references/loop-mode.md`');
    expect(loopRule).toMatch(/repeats `next`/);
    expect(loopRule).toContain(DONE_LINE);
    expect(loopRule).toContain(LEDGER);
    expect(loopRule.length).toBeLessThan(500);
  });

  it('names the stop conditions and the gate pause inside the loop rule', () => {
    expect(loopRule).toMatch(/nothing is selectable/);
    expect(loopRule).toMatch(/headless gate/);
    expect(loopRule).toMatch(/`hooks` context warning/);
    expect(loopRule).toMatch(/after 3 finished PBIs \(the cap\)/);
    expect(loopRule).toMatch(/interactive gates pause it/);
  });

  it('ends a loop run with one Next line, loop variant when a PBI is still selectable', () => {
    expect(report).toMatch(/full, implement, next or loop run/);
    expect(report).toMatch(/last PBI handled/);
    expect(report).toMatch(/add one end line `Next: #<nr>/);
    expect(report).toContain('says `orchestrator loop <feature>` instead');
    expect(report.indexOf('Next: #<nr>')).toBeLessThan(report.indexOf('Ledger complete.'));
  });
});

describe('loop-mode reference', () => {
  it('stays within 70 lines', () => {
    expect(reference.trimEnd().split('\n').length).toBeLessThanOrEqual(70);
  });

  it('defines the loop ledger: path, header once, done and stop lines, rulings elsewhere', () => {
    const ledger = section(reference, 'Loop ledger');
    expect(ledger).toContain(LEDGER);
    expect(ledger).toContain('-Issue loop-<nr>');
    expect(ledger).toContain(HEADER);
    expect(ledger).toMatch(/only when `<state>\/loop-<nr>\/progress\.md` does not exist yet/);
    expect(ledger).toMatch(/`Add-LedgerLine` writes no headers/);
    expect(ledger).toContain(DONE_LINE);
    expect(ledger).toContain(STOP_LINE);
    for (const reason of STOP_REASONS) expect(ledger).toContain(`\`${reason}\``);
    expect(ledger).toMatch(/never in the loop ledger/);
  });

  it('creates the per-PBI ledger before dispatching the issue-reader (hook race)', () => {
    const ledger = section(reference, 'Loop ledger');
    expect(ledger).toMatch(
      /right after announcing `Next PBI: #<nr> <title>` and before dispatching `issue-reader`/
    );
    expect(ledger).toContain(
      "Add-LedgerLine.ps1 -Issue <pbi> -Line '# orchestrator ledger — issue #<pbi> — branch <branch>'"
    );
    expect(ledger).toMatch(/header-only ledger, which resumes at step 1/);
    // the agent's step 1 creates the directory for the ledger; a pre-created one is a resume, not a conflict
    expect(read('packages/github/.apm/skills/github-issue/references/pbi-pipeline.md')).toMatch(
      /`ledger: resume` → the same-issue ledger rule/
    );
  });

  it('binds the loop to the new PBI before issue-reader and unbinds at every stop (#375)', () => {
    const ledger = section(reference, 'Loop ledger');
    expect(ledger).toContain('Add-LedgerLine.ps1 -Issue <pbi> -Bind loop-<nr>');
    expect(ledger).toContain('`Loop: PBI #<pbi> started`');
    expect(ledger).toContain('`<state>/current.d/<key>` (`<key>` = the lease key of that checkout');
    expect(ledger).toContain(
      'content `<pbi> loop-<nr>`, plus the issue number of the branch it ran on'
    );
    expect(ledger).toContain('one marker per checkout');
    expect(ledger).toMatch(/last `Loop: ` line is not a `Loop: stopped` line/);
    expect(ledger).not.toMatch(/prefer the marker over the branch number/);
    expect(ledger).toMatch(/a `Loop: PBI #<nr> done` line; any other issue branch wins/);
    expect(ledger).toMatch(/`-Bind` fails without the PBI ledger/);
    expect(ledger).not.toContain('apm-hub/issues/375');
    expect(section(reference, 'Stop conditions')).toMatch(
      /then the `Loop: stopped` line, then `Add-LedgerLine\.ps1 -Unbind`/
    );
    expect(section(reference, 'Runner mode (Claude Code)')).toMatch(
      /header and bind it[\s\S]*followed by `Add-LedgerLine\.ps1 -Unbind`/
    );
  });

  it('reselects by PR state, never by the ledger, and names the blocked-chain stop', () => {
    const sel = section(reference, 'Selection and reselection');
    expect(sel).toContain('next-selection.md');
    expect(sel).toMatch(/run by the orchestrator itself with `gh`/);
    expect(sel).toMatch(/never reads the `Loop: … done` lines/);
    expect(sel).toContain('waiting for merge: PR #<n>');
    expect(sel).toContain('merged, closes at release');
    expect(sel).toMatch(/closed without merge is selected again/);
    expect(sel).toMatch(/open, unmerged blocker/);
    expect(sel).toContain('blocker #<n> merged, closes at release');
    expect(sel).toMatch(/first PBI of the chain is merged, the next one is selectable/);
    expect(sel).toMatch(/Never merge a PR/);
    expect(sel).toMatch(/blocked-by chain[^\n]*normal `nothing selectable` stop[^\n]*not an error/);
  });

  it('lists the stop conditions with the client differences and the PBI cap fallback', () => {
    const stops = section(reference, 'Stop conditions');
    expect(stops).toMatch(/1\. \*\*Context warning\*\*/);
    expect(stops).toMatch(
      /2\. \*\*PBI cap\*\*: 3 PBIs finished in this loop run \(10 in runner mode\)/
    );
    expect(stops).toMatch(/3\. \*\*Nothing selectable\*\*/);
    expect(stops).toMatch(/No candidate/);
    expect(stops).toMatch(/`hooks` package/);
    expect(stops).toMatch(/Copilot CLI \(`postToolUse`\)[^\n]*fires inside a running loop/);
    expect(stops).toMatch(
      /Claude Code \(`UserPromptSubmit`\) and OpenCode \(`chat\.message`\)[^\n]*only with a user message/
    );
    expect(stops).toMatch(/fallback for clients where the warning cannot fire mid-loop/);
    expect(stops).toContain('Gate: <question>');
    expect(stops).toContain('Loop: stopped — headless gate: <question>');
    expect(stops).toMatch(/finish the current step first/);
  });

  it('applies --fix-advisories to every PBI and exempts the review summary from the gate', () => {
    expect(reference).toContain('applies to every PBI of the loop');
    expect(section(reference, 'Interactive gates')).toContain('--fix-advisories');
    expect(reference).toContain('else the headless default `medium`');
  });

  it('runner mode answers a review-summary GATE with medium only without a question tool', () => {
    const gate = reference.split('3. `GATE` reply:')[1].split('\n')[0];
    expect(gate).toContain('With a question tool a review-summary `GATE` is asked like any other');
    expect(gate).toMatch(
      /Only when the primary has no question tool, a review-summary `GATE`[^.]*`medium`/
    );
    expect(gate).not.toContain('ruling q1');
    // consistent with the pipeline gate list: default medium is headless only
    expect(read('packages/github/.apm/skills/github-issue/references/pbi-pipeline.md')).toContain(
      'headless without the flag: the default `medium`'
    );
  });

  it('pauses on interactive gates and skips the clear-before-implement question', () => {
    const sec = section(reference, 'Interactive gates');
    expect(sec).toMatch(/continue the loop after the answer/);
    expect(sec).toMatch(/Clear before implement/);
  });

  it('resumes from the selection, not the ledger, and trusts disk after compaction', () => {
    const sec = section(reference, 'Resume and compaction');
    expect(sec).toMatch(/Resuming loop #<nr>/);
    expect(sec).toMatch(/do not rewrite the header/);
    expect(sec).toMatch(/not by the ledger/);
    expect(sec).toMatch(/cap counts only PBIs finished in the current run/);
    expect(sec).toMatch(/trust the loop ledger/);
  });

  it('ends with exactly one Next line and the fixed last line', () => {
    const end = section(reference, 'End report');
    expect(end).toMatch(/exactly one `Next:` line/);
    expect(end).toContain(STOP_LINE);
    expect(end).toContain(`Next: #<nr> <title> — ${RESUME_LINE}`);
    expect(end).toMatch(/nothing selectable → the variants of `next-selection\.md`/);
    expect(end).toContain('Ledger complete. Start the next issue in a new session');
  });
});

describe('loop-mode reference: runner mode', () => {
  const runner = section(reference, 'Runner mode (Claude Code)');
  const ledger = section(reference, 'Loop ledger');

  it('is used only on Claude Code with Agent and SendMessage, other clients keep the inline loop', () => {
    expect(runner).toMatch(/Claude Code and the session has the `Agent` and `SendMessage` tools/);
    expect(runner).toMatch(/every other client keeps the inline loop/);
    expect(runner).toContain('ToolSearch');
  });

  it('dispatches pbi-runner and forwards the flags verbatim', () => {
    expect(runner).toContain('subagent_type: pbi-runner');
    expect(runner).toContain('{pbi, loop: <nr>, flags, context}');
    expect(runner).toMatch(
      /forwards `--fix-advisories`, `--advisory-rounds` and `--no-review-summary` verbatim/
    );
    expect(runner).toMatch(/create the PBI ledger header/);
  });

  it('relays a GATE: AskUserQuestion, then SendMessage to the runner, until a final status', () => {
    expect(runner.indexOf('`GATE`')).toBeGreaterThan(-1);
    expect(runner.indexOf('`AskUserQuestion`')).toBeLessThan(
      runner.indexOf('`SendMessage` the answer')
    );
    expect(runner).toMatch(/runner's agent id/);
    expect(runner).toMatch(/until a final status/);
    expect(runner).toMatch(/primary makes no `Ruling:` itself/);
  });

  it('stops headless at a gate and records the runner reasons', () => {
    expect(runner).toContain('Loop: stopped — headless gate: <question>');
    expect(runner).toContain('`DONE` → `Loop: PBI #<nr> done — <pr>`');
    expect(runner).toContain('`Loop: stopped — runner blocked`');
    expect(runner).toContain('`Loop: stopped — runner failed`');
    for (const reason of RUNNER_REASONS) expect(ledger).toContain(`\`${reason}\``);
  });

  it('pins the runner to sonnet and detects a missing question tool by trying AskUserQuestion', () => {
    expect(runner).toContain('`subagent_type: pbi-runner`, `model: sonnet`');
    expect(runner).toMatch(/trying `AskUserQuestion` on the first `GATE`/);
    expect(runner).toMatch(/The runner is not resumed/);
    expect(runner).toMatch(/`Gate:` without a later `Ruling:` as stopped/);
  });

  it('caps at 10 PBIs in runner mode and 3 inline, the context warning still stops', () => {
    expect(runner).toMatch(/10 finished PBIs in runner mode \(3 inline\)/);
    expect(runner).toMatch(/context warning still stops/);
    expect(section(reference, 'Stop conditions')).toContain('3 PBIs finished in this loop run');
  });

  it('is announced in one sentence of the agent and keeps the inline rule text', () => {
    expect(loopRule).toMatch(/runner mode: `pbi-runner` per PBI, gates relayed \(`loop-mode.md`\)/);
    expect(loopRule).toMatch(/after 3 finished PBIs \(the cap\)/);
    expect(section(reference, 'Interactive gates')).toMatch(/continue the loop after the answer/);
  });

  it('is documented with the reasons and caps', () => {
    const loopDocs = section(docs, 'Looping with `loop`');
    expect(loopDocs).toMatch(/Runner mode \(Claude Code/);
    expect(loopDocs).toContain('`pbi-runner`');
    expect(loopDocs).toContain('`AskUserQuestion`');
    expect(loopDocs).toContain('`SendMessage`');
    for (const reason of RUNNER_REASONS) expect(loopDocs).toContain(`\`${reason}\``);
    expect(loopDocs).toMatch(/10 PBIs in runner mode and 3 inline/);
    expect(workingMode).toMatch(/10 on Claude Code/);
  });
});

describe('loop mode: sibling references', () => {
  it('github-issue skill links the reference within 100 lines', () => {
    expect(skill).toContain('references/loop-mode.md');
    expect(skill.trimEnd().split('\n').length).toBeLessThanOrEqual(100);
  });

  it('gates reference lists loop as a mode word and rejects a loop description', () => {
    const parse = section(gates, 'Description input');
    expect(parse).toMatch(/`plan`, `implement`, `full`, `next`, `loop` or `status`/);
    expect(parse).toMatch(/`loop <description>`[^\n]*needs a Feature or Epic number and stop/);
    expect(parse).toMatch(/`status <description>`[^\n]*needs a Feature or Epic number and stop/);
    expect(gates).toMatch(/pauses the loop/);
    expect(gates).toMatch(/not asked in `loop`/);
  });

  it('next-selection keeps one PBI per next run and points to loop-mode', () => {
    expect(selection).toContain(
      'Exactly one PBI per run; `loop` repeats the selection per `loop-mode.md`.'
    );
    expect(selection).toMatch(/first remaining candidate in sub-issue order/);
  });
});

describe('loop mode: docs agree with agent and reference', () => {
  it('use the same ledger path, line formats and stop reasons', () => {
    for (const text of [docs, workingMode]) expect(text).toContain(LEDGER);
    expect(docs).toContain(HEADER);
    expect(docs).toContain(DONE_LINE);
    expect(docs).toContain(STOP_LINE);
    for (const reason of STOP_REASONS) expect(docs).toContain(`\`${reason}\``);
  });

  it('state the PBI cap, the client differences and the resume-by-PR rule', () => {
    const loopDocs = section(docs, 'Looping with `loop`');
    expect(loopDocs).toMatch(/3 PBIs/);
    expect(loopDocs).toMatch(/Copilot CLI/);
    expect(loopDocs).toMatch(/Claude Code[^\n]*OpenCode/);
    expect(loopDocs).toMatch(/not by the ledger|never reads the `Loop: … done` lines/);
    expect(loopDocs).toMatch(/closed without merge/);
    expect(loopDocs).toMatch(/before dispatching `issue-reader`|before the `issue-reader`/);
    expect(docs).toContain(RESUME_LINE);
    expect(workingMode).toMatch(/3 PBIs/);
  });
});
