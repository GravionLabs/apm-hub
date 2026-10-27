import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  hasPwsh,
  posix,
  runBatchParallel,
  type BatchCase,
  type BatchResult,
} from '../../helpers/queue.helpers';

// -DryRun -Feature|-Epic lists the open PBIs with Needs and marks the ones the queue skips (#642).
// A fake gh on PATH answers GET calls and logs every call; cases run batched, one beforeAll.

type Def = { args: string[]; noGh?: boolean; ghFails?: boolean };

const FAKE_GH = (log: string, fail: boolean) => `#!/bin/sh
echo "$*" >> "${log}"
${fail ? 'echo boom >&2; exit 1' : ''}
case "$*" in
  *"--method GET"*) ;;
  *) echo "write call: $*" >> "${log}.write"; exit 9 ;;
esac
case "$*" in
  *issues/20/sub_issues*) echo '[{"number":10,"state":"open","title":"[Feature] F","type":{"name":"Feature"}}]' ;;
  *issues/10/sub_issues*) echo '[{"number":11,"state":"open","title":"[PBI] plan me","type":{"name":"PBI"}},{"number":12,"state":"open","title":"[PBI] decide\\u001b[31m me","type":{"name":"PBI"}},{"number":13,"state":"open","title":"[PBI] blocked","type":{"name":"PBI"}},{"number":14,"state":"open","title":"[PBI] ready","type":{"name":"PBI"}},{"number":15,"state":"open","title":"[PBI] merged","type":{"name":"PBI"}},{"number":16,"state":"closed","title":"[PBI] closed","type":{"name":"PBI"}},{"number":17,"state":"open","title":"[Task] a task","type":{"name":"Task"}}]' ;;
  *issues/30/sub_issues*) echo '[]' ;;
  *issues/50/sub_issues*) echo '[{"number":14,"state":"open","title":"[PBI] ready","type":{"name":"PBI"}}]' ;;
  *issues/40/sub_issues*) echo '[{"number":40,"state":"open","title":"[Feature] self","type":{"name":"Feature"}},{"number":41,"state":"open","title":"[Feature] f","type":{"name":"Feature"}}]' ;;
  *issues/41/sub_issues*) echo '[{"number":42,"state":"open","title":"[Feature] g","type":{"name":"Feature"}}]' ;;
  *issues/42/sub_issues*) echo '[{"number":43,"state":"open","title":"[Feature] too deep","type":{"name":"Feature"}}]' ;;
  *issues/43/sub_issues*) echo '[{"number":14,"state":"open","title":"[PBI] deep","type":{"name":"PBI"}}]' ;;
  *issues/1[1-9]/sub_issues*) echo '[]' ;;
  *issues/13/dependencies/blocked_by*) echo '[{"number":99,"state":"open"}]' ;;
  *dependencies/blocked_by*) echo '[]' ;;
  *pulls*) echo '[]' ;;
  *issues/11) echo '{"state":"open","title":"[PBI] plan me","labels":[],"type":{"name":"PBI"}}' ;;
  *issues/12) echo '{"state":"open","title":"[PBI] d","labels":[{"name":"needs-decision"},{"name":"planned"}],"type":{"name":"PBI"}}' ;;
  *issues/13) echo '{"state":"open","title":"[PBI] b","labels":[{"name":"planned"}],"type":{"name":"PBI"}}' ;;
  *issues/14) echo '{"state":"open","title":"[PBI] r","labels":[{"name":"planned"}],"type":{"name":"PBI"}}' ;;
  *issues/15) echo '{"state":"open","title":"[PBI] m","labels":[{"name":"merged"}],"type":{"name":"PBI"}}' ;;
  *) echo '[]' ;;
esac
`;

describe.skipIf(!hasPwsh || !posix)(
  'Invoke-OrchestratorQueue.ps1 -DryRun Needs list (#642)',
  () => {
    let root: string;
    const defs = new Map<string, Def>();
    const dirs: Record<string, string> = {};
    const R: Record<string, BatchResult> = {};
    const reg = (key: string, def: Def) => defs.set(key, def);
    const lines = (key: string) => R[key].stdout.split('\n').map((l) => l.trimEnd());
    const readLog = (key: string, suffix = '') => {
      const f = path.join(dirs[key], 'gh.log' + suffix);
      return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    };

    reg('feature', { args: ['-DryRun', '-Feature', '10'] });
    reg('allplanned', { args: ['-DryRun', '-Feature', '50'] });
    reg('epic', { args: ['-DryRun', '-Epic', '20'] });
    reg('empty', { args: ['-DryRun', '-Feature', '30'] });
    reg('cycle', { args: ['-DryRun', '-Epic', '40'] });
    reg('nogh', { args: ['-DryRun', '-Feature', '10'], noGh: true });
    reg('ghfail', { args: ['-DryRun', '-Feature', '10'], ghFails: true });

    beforeAll(async () => {
      root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'queue-dryneeds-')));
      const cases: BatchCase[] = [...defs.entries()].map(([key, def], i) => {
        const dir = path.join(root, `c${i}`);
        const bin = path.join(dir, 'bin');
        fs.mkdirSync(bin, { recursive: true });
        dirs[key] = dir;
        if (!def.noGh) {
          fs.writeFileSync(path.join(bin, 'gh'), FAKE_GH(path.join(dir, 'gh.log'), !!def.ghFails), {
            mode: 0o755,
          });
        }
        return {
          key,
          args: def.args,
          cwd: dir,
          path: def.noGh ? bin : `${bin}${path.delimiter}${process.env.PATH}`,
          env: {},
        };
      });
      const results = await runBatchParallel(cases);
      cases.forEach((c, i) => (R[c.key] = results[i]));
    });
    afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

    it('lists each open PBI with its Needs and (skip) exactly on Planning, Decision, Blocked', () => {
      expect(R.feature.status, R.feature.stdout + R.feature.stderr).toBe(0);
      const out = lines('feature');
      expect(out).toContain('#11 Planning [PBI] plan me (skip)');
      expect(out.some((l) => /^#12 Decision \[PBI\] decide.*me \(skip\)$/.test(l))).toBe(true);
      expect(out).toContain('#13 Blocked [PBI] blocked (skip)');
      expect(out).toContain('#14 Ready [PBI] ready');
      expect(out).toContain('#15 Release review [PBI] merged');
      expect(out.some((l) => l.startsWith('#16') || l.startsWith('#17'))).toBe(false);
      expect(out[0]).toMatch(/^\[dry-run\] Feature #10: /);
    });

    it('ends the list with the unplanned PBIs, or none (#580)', () => {
      expect(lines('feature')).toContain('[dry-run] Unplanned: #11');
      expect(R.allplanned.status, R.allplanned.stdout + R.allplanned.stderr).toBe(0);
      expect(lines('allplanned')).toContain('[dry-run] Unplanned: none');
      expect(lines('allplanned')).not.toContain('[dry-run] Unplanned: #14');
    });

    it('a failing gh prints no Unplanned line (#580)', () => {
      expect(R.ghfail.stdout).not.toContain('Unplanned');
    });

    it('strips control characters from titles', () => {
      expect(R.feature.stdout).not.toContain('\u001b');
    });

    it('never makes a write call to gh', () => {
      expect(readLog('feature')).toContain('--method GET');
      expect(readLog('feature', '.write')).toBe('');
    });

    it('-Epic descends through its Features to the PBIs', () => {
      expect(R.epic.status, R.epic.stdout + R.epic.stderr).toBe(0);
      expect(lines('epic')[0]).toMatch(/^\[dry-run\] Epic #20: /);
      expect(lines('epic')).toContain('#14 Ready [PBI] ready');
    });

    it('a Feature without open PBIs says so instead of reporting Needs as unavailable', () => {
      expect(R.empty.status, R.empty.stdout + R.empty.stderr).toBe(0);
      expect(R.empty.stdout).toContain('[dry-run] No open PBIs found.');
      expect(R.empty.stdout).not.toContain('unavailable');
    });

    it('a cycle terminates and Features deeper than two levels are not walked', () => {
      expect(R.cycle.status, R.cycle.stdout + R.cycle.stderr).toBe(0);
      expect(R.cycle.stdout).toContain('[dry-run] No open PBIs found.');
      expect(R.cycle.stdout).not.toContain('#14');
    });

    it('without gh prints the dry-run line and the unavailable line, exit 0', () => {
      expect(R.nogh.status, R.nogh.stdout + R.nogh.stderr).toBe(0);
      expect(lines('nogh')[0]).toMatch(/^\[dry-run\] Feature #10: /);
      expect(R.nogh.stdout).toContain("[dry-run] Needs unavailable: 'gh' not found on PATH");
    });

    it('a failing gh gives the unavailable line and exit 0', () => {
      expect(R.ghfail.status, R.ghfail.stdout + R.ghfail.stderr).toBe(0);
      expect(R.ghfail.stdout).toContain('[dry-run] Needs unavailable:');
      expect(R.ghfail.stdout).not.toMatch(/^#1\d /m);
    });
  }
);
