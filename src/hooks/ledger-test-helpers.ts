import * as os from 'os';

/** Env without inherited GIT_* (e.g. GIT_DIR when run from a git hook) and without user/system git config. */
export const gitCleanEnv = (base: NodeJS.ProcessEnv, extra: Record<string, string> = {}): NodeJS.ProcessEnv => {
  const env = { ...base };
  for (const k of Object.keys(env)) if (k.startsWith('GIT_')) delete env[k];
  return { ...env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_SYSTEM: os.devNull, ...extra };
};

/** Branch names that bind to issue 7 (shared by the shell hook and the OpenCode plugin tests). */
export const BRANCHES_BOUND = [
  'feat/7-x',
  'feat/scope/7-x',
  'Feat/7-x',
  'fix/7',
  'feat/a/b/7-x',
  'hotfix/7-x',
  'CHORE/7',
];

/** Branch names that carry no issue number: the newest-ledger fallback applies. */
export const BRANCHES_UNBOUND = ['main', 'release/next', 'release/2', 'renovate/3-major', 'fix/7x-y', 'fix/x7-y', 'fix/7/slug', 'feat/x'];

/** Contents of .agents/current that break the strict `<pbi> loop-<nr>` format: the marker is ignored (branch rule applies). */
export const MARKERS_MALFORMED = [
  '',
  '\n',
  '9',
  '9\n',
  '09 loop-5\n',
  '9x loop-5\n',
  '../7 loop-5\n',
  '9 loop-05\n',
  '9 loop-x\n',
  '9 loop-5/../loop-6\n',
  '9 ../loop-5\n',
  ' 9 loop-5\n',
  '9  loop-5\n',
  '9 loop-5 \n',
  '9 loop-5\r\n',
  '9 loop-5\n\n',
  '9 loop-5\n7 loop-5\n',
  '9 loop-5\0',
  'loop-5 9\n',
  '12345678901 loop-5\n',
  '9 loop-5 012\n',
  '9 loop-5 x\n',
  '9 loop-5 12 \n',
  '9 loop-5  12\n',
  '9 loop-5 12 13\n',
  '9 loop-5 0\n',
  '9 loop-5 12345678901\n',
];

/** Loop ledger contents for which a marker is stale (the loop stopped) or still live (running or resumed). The live ones
 * record PBI 7 (the branch `fix/7-x` of the scenario) as done, which the foreign-branch guard requires. */
export const LOOP_LEDGERS_STALE = [
  '# loop\nLoop: PBI #7 started\nLoop: PBI #7 done — https://x/pr/7\nLoop: PBI #9 started\nLoop: stopped — user stop\n',
  '# loop\nLoop: PBI #7 done — https://x/pr/7\nLoop: PBI #9 started\nLoop: PBI #9 done — https://x/pr/9\nLoop: stopped — nothing selectable\n',
  '# loop\r\nLoop: PBI #7 done\r\nLoop: PBI #9 started\r\nLoop: stopped — user stop\r\n',
  '# loop\r\nLoop: PBI #7 done\r\nLoop: PBI #9 started\r\nLoop: stopped\r\n',
];
export const LOOP_LEDGERS_LIVE = [
  '# loop\nLoop: PBI #7 started\nLoop: PBI #7 done — https://x/pr/7\nLoop: PBI #9 started\n',
  '# loop\nLoop: PBI #7 started\nLoop: PBI #7 done — https://x/pr/7\nLoop: stopped — pbi cap\nLoop: PBI #9 started\n',
  '# loop\nLoop: PBI #7 done — https://x/pr/7\nLoop: PBI #9 started\nSome note mentioning Loop: stopped later\n',
  '# loop\nLoop: PBI #7 done\n',
  '# loop\r\nLoop: PBI #7 done — https://x/pr/7\r\nLoop: PBI #9 started\r\n',
  '# loop\r\nLoop: PBI #7 done\r\nLoop: PBI #9 started\r\n',
];

/** Loop ledgers that do not record the branch issue 7 as done: on `fix/7-x` the marker for PBI 9 is ignored. */
export const LOOP_LEDGERS_FOREIGN_BRANCH = [
  '# loop\nLoop: PBI #9 started\n',
  '# loop\nLoop: PBI #7 started\nLoop: PBI #9 started\n',
  '# loop\nLoop: PBI #70 done — https://x/pr/70\nLoop: PBI #9 started\n',
  '# loop\nLoop: PBI #17 done — https://x/pr/17\nLoop: PBI #9 started\n',
  '# loop\nNote: Loop: PBI #7 done\nLoop: PBI #9 started\n',
  '# loop\nLoop: PBI #7 donezo\nLoop: PBI #9 started\n',
  '# loop\nLoop: PBI #7 done-ish\nLoop: PBI #9 started\n',
];
