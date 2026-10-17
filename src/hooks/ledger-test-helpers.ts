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
