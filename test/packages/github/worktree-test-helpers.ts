import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const SCRIPTS = path.resolve(__dirname, '../../../packages/github/.apm/skills/github-issue/scripts');

const gitEnv = (): NodeJS.ProcessEnv => ({ ...process.env, GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' });
delete process.env.DROMOS_STATE_DIR;

/** Isolated git (no user/system config, no signing, fixed identity); every call must succeed. */
export const git = (cwd: string, ...a: string[]): string => {
  const r = spawnSync('git', ['-c', 'commit.gpgsign=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, encoding: 'utf8', env: gitEnv() });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

export type Fixture = { root: string; repo: string; origin: string; state: string };

/** Temp repository with a bare "origin" (main pushed); `ignore` commits a .gitignore with `.worktrees/`. */
export const makeRepo = (o: { ignore?: boolean } = {}): Fixture => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'wt-')));
  const origin = path.join(root, 'origin.git');
  const repo = path.join(root, 'repo');
  fs.mkdirSync(repo);
  git(root, 'init', '-q', '--bare', '-b', 'main', origin);
  git(repo, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(repo, 'a.txt'), 'a\n');
  if (o.ignore !== false) fs.writeFileSync(path.join(repo, '.gitignore'), '.worktrees/\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'init');
  git(repo, 'remote', 'add', 'origin', origin);
  git(repo, 'push', '-q', '-u', 'origin', 'main');
  return { root, repo, origin, state: path.join(repo, '.git', 'agents') };
};

export const run = (script: string, args: string[], cwd: string, env: Record<string, string> = {}) =>
  spawnSync('pwsh', ['-NoProfile', '-File', path.join(SCRIPTS, script), ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...gitEnv(), ...env },
  });

export const json = (r: { stdout: string }) => JSON.parse(r.stdout.trim());
