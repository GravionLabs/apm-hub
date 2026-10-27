import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const refs = 'packages/github/.apm/skills/github-issue/references/';
const loop = read(refs + 'loop-mode.md');
const next = read(refs + 'next-selection.md');

describe('loop merges approved PBIs (#582)', () => {
  it('loop-mode.md names the script, both ledger lines, the ask-once question and the ledger record', () => {
    expect(loop).toContain('Merge-ApprovedPr.ps1');
    expect(loop).toContain('Loop: PBI #<nr> merged — <sha>');
    expect(loop).toContain('Loop: PBI #<nr> merge skipped — <reason>');
    expect(loop).toContain('merge approved PRs automatically? yes/no');
    expect(loop).toContain('Merge: auto|off');
    expect(loop).toContain('-NoMerge');
  });

  it('decides per run: headless and --merge merge, --no-merge does not, a resumed loop does not ask again', () => {
    expect(loop).toMatch(/headless → merge; `--merge` → merge; `--no-merge` → no merge/);
    expect(loop).toMatch(/resumed loop reads `Merge:`[^\n]*does not ask again/);
  });

  it('runs the merge step before the reselection in inline and runner mode', () => {
    expect(loop).toMatch(
      /`DONE` → `Loop: PBI #<nr> done — <pr>`, then the primary runs the merge step/
    );
    expect(loop).toMatch(/runs the merge step \(not for a parked PBI\), runs the stop checks/);
  });

  it('no reference keeps the old never-merge sentence', () => {
    for (const text of [loop, next])
      expect(text).not.toContain('Never merge a PR to make the next PBI selectable');
    expect(loop).toContain('Never merge outside `Merge-ApprovedPr.ps1`');
  });
});
