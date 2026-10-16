import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../..');
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
const LEDGER = '.agents/loop-<nr>/progress.md';
const HEADER = '# orchestrator ledger — loop #<nr> — branch <branch>';
const DONE_LINE = 'Loop: PBI #<nr> done — <pr>';
const STOP_LINE = 'Loop: stopped — <reason>';
const STOP_REASONS = ['nothing selectable', 'headless gate: <question>', 'context warning', 'pbi cap', 'user stop'];
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
  it('stays within 60 lines', () => {
    expect(reference.trimEnd().split('\n').length).toBeLessThanOrEqual(60);
  });

  it('defines the loop ledger: path, header once, done and stop lines, rulings elsewhere', () => {
    const ledger = section(reference, 'Loop ledger');
    expect(ledger).toContain(LEDGER);
    expect(ledger).toContain('-Issue loop-<nr>');
    expect(ledger).toContain(HEADER);
    expect(ledger).toMatch(/only when `\.agents\/loop-<nr>\/progress\.md` does not exist yet/);
    expect(ledger).toMatch(/`Add-LedgerLine` writes no headers/);
    expect(ledger).toContain(DONE_LINE);
    expect(ledger).toContain(STOP_LINE);
    for (const reason of STOP_REASONS) expect(ledger).toContain(`\`${reason}\``);
    expect(ledger).toMatch(/never in the loop ledger/);
  });

  it('creates the per-PBI ledger before dispatching the issue-reader (hook race)', () => {
    const ledger = section(reference, 'Loop ledger');
    expect(ledger).toMatch(/right after announcing `Next PBI: #<nr> <title>` and before dispatching `issue-reader`/);
    expect(ledger).toContain("Add-LedgerLine.ps1 -Issue <pbi> -Line '# orchestrator ledger — issue #<pbi> — branch <branch>'");
    expect(ledger).toMatch(/header-only ledger, which resumes at step 1/);
    // the agent's step 1 creates the directory for the ledger; a pre-created one is a resume, not a conflict
    expect(body).toMatch(/`ledger: resume` → the same-issue ledger rule/);
  });

  it('reselects by PR state, never by the ledger, and names the blocked-chain stop', () => {
    const sel = section(reference, 'Selection and reselection');
    expect(sel).toContain('next-selection.md');
    expect(sel).toMatch(/run by the orchestrator itself with `gh`/);
    expect(sel).toMatch(/never reads the `Loop: … done` lines/);
    expect(sel).toContain('waiting for merge: PR #<n>');
    expect(sel).toContain('merged, closes at release');
    expect(sel).toMatch(/closed without merge is selected again/);
    expect(sel).toMatch(/Never merge a PR/);
    expect(sel).toMatch(/blocked-by chain[^\n]*normal `nothing selectable` stop[^\n]*not an error/);
  });

  it('lists the stop conditions with the client differences and the PBI cap fallback', () => {
    const stops = section(reference, 'Stop conditions');
    expect(stops).toMatch(/1\. \*\*Context warning\*\*/);
    expect(stops).toMatch(/2\. \*\*PBI cap\*\*: 3 PBIs finished/);
    expect(stops).toMatch(/3\. \*\*Nothing selectable\*\*/);
    expect(stops).toMatch(/No candidate/);
    expect(stops).toMatch(/`hooks` package/);
    expect(stops).toMatch(/Copilot CLI \(`postToolUse`\)[^\n]*fires inside a running loop/);
    expect(stops).toMatch(/Claude Code \(`UserPromptSubmit`\) and OpenCode \(`chat\.message`\)[^\n]*only with a user message/);
    expect(stops).toMatch(/fallback for clients where the warning cannot fire mid-loop/);
    expect(stops).toContain('Gate: <question>');
    expect(stops).toContain('Loop: stopped — headless gate: <question>');
    expect(stops).toMatch(/finish the current step first/);
  });

  it('applies --fix-advisories to every PBI and exempts the review summary from the gate', () => {
    expect(reference).toContain('applies to every PBI of the loop');
    expect(section(reference, 'Interactive gates')).toContain('--fix-advisories');
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

describe('loop mode: sibling references', () => {
  it('github-issue skill links the reference within 100 lines', () => {
    expect(skill).toContain('references/loop-mode.md');
    expect(skill.trimEnd().split('\n').length).toBeLessThanOrEqual(100);
  });

  it('gates reference lists loop as a mode word and rejects a loop description', () => {
    const parse = section(gates, 'Description input');
    expect(parse).toMatch(/`plan`, `implement`, `full`, `next` or `loop`/);
    expect(parse).toMatch(/`loop <description>`[^\n]*needs a Feature or Epic number and stop/);
    expect(gates).toMatch(/pauses the loop/);
    expect(gates).toMatch(/not asked in `loop`/);
  });

  it('next-selection keeps one PBI per next run and points to loop-mode', () => {
    expect(selection).toContain('Exactly one PBI per run; `loop` repeats the selection per `loop-mode.md`.');
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
