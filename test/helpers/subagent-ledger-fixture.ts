import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { gitCleanEnv } from '../packages/hooks/ledger-test-helpers';

export const SCRIPT = path.resolve(__dirname, '../../packages/hooks/.apm/hooks/subagent-ledger.sh');

/**
 * Registers the per-case temp dir hooks and returns the fixture of one test file. State is kept in the closure, so
 * every file (and every call) has its own `dir`, `ledger` and state dir. Most cases use the DROMOS_STATE_DIR override
 * pointing at <dir>/.agents; the `git common dir` describe block clears it (DROMOS_STATE_DIR: '') to exercise the
 * real resolver.
 */
export function useLedgerFixture() {
  let dir = '';
  let ledger = '';
  let fixtureState = '';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-'));
    fixtureState = path.join(dir, '.agents');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const cleanEnv = (extra: Record<string, string> = {}): NodeJS.ProcessEnv =>
    gitCleanEnv(process.env, { DROMOS_STATE_DIR: fixtureState, ...extra });

  const withLedger = () => {
    fs.mkdirSync(path.join(dir, '.agents', '7'), { recursive: true });
    ledger = path.join(dir, '.agents', '7', 'progress.md');
    fs.writeFileSync(ledger, '# ledger\n');
  };

  const run = (payload: unknown) =>
    spawnSync('bash', [SCRIPT], {
      input: typeof payload === 'string' ? payload : JSON.stringify(payload),
      encoding: 'utf8',
      env: cleanEnv({ AGENTS_LEDGER: '' }),
    });

  return {
    get dir() {
      return dir;
    },
    get ledger() {
      return ledger;
    },
    cleanEnv,
    withLedger,
    run,
  };
}
