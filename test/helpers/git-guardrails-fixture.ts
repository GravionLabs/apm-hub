import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const SCRIPT = path.resolve(__dirname, '../../packages/hooks/.apm/hooks/git-guardrails.sh');

export const hermetic = (
  home: string,
  base: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv => {
  const env = { ...base };
  for (const k of Object.keys(env))
    if (k.startsWith('GIT_') || k === 'XDG_CONFIG_HOME') delete env[k];
  return { ...env, HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
};

// Shared by git-guardrails.test.ts and git-guardrails.perf.test.ts. Call it inside a describe: it registers the
// beforeAll/afterAll/afterEach hooks and returns the helpers. `repo`, `home` and `nojq` are getters because `repo`
// changes with withFreshRepo().
export const createGuardFixture = () => {
  let repo: string; // the repository the current test works on: the shared fixture, or a fresh copy
  let shared: string;
  let fresh: string | undefined;
  let home: string;
  let nojq: string;

  const git = (...args: string[]) =>
    spawnSync('git', args, { cwd: repo, encoding: 'utf8', env: hermetic(home) });

  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-home-'));
  });
  afterAll(() => fs.rmSync(home, { recursive: true, force: true }));

  // One clean committed fixture repo for the whole describe (one `git init` + commit). A test that changes the repository
  // (dirty(), untracked(), branch switches, files in .git, worktrees, new directories) calls withFreshRepo() first: it
  // copies the fixture (no git process) and the afterEach below removes the copy and points `repo` back at the fixture.
  beforeAll(() => {
    shared = repo = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
    git('init', '-q', '-b', 'feature');
    fs.writeFileSync(path.join(repo, 'a.txt'), 'base');
    git('add', 'a.txt');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
  });
  afterAll(() => fs.rmSync(shared, { recursive: true, force: true }));
  const withFreshRepo = () => {
    fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
    fs.cpSync(shared, fresh, { recursive: true });
    repo = fresh;
  };
  afterEach(() => {
    if (fresh) fs.rmSync(fresh, { recursive: true, force: true });
    fresh = undefined;
    repo = shared;
  });

  const claude = (command: string, extra: object = {}) => ({
    tool_name: 'Bash',
    tool_input: { command },
    cwd: repo,
    ...extra,
  });
  const copilot = (command: string) => ({
    toolName: 'bash',
    toolArgs: JSON.stringify({ command }),
    cwd: repo,
  });

  const runRaw = (
    input: string,
    env: Record<string, string> = {},
    base: NodeJS.ProcessEnv = process.env
  ) => {
    const clean = hermetic(home, base);
    delete clean.GIT_GUARDRAILS_OFF;
    const r = spawnSync('bash', [SCRIPT], { input, encoding: 'utf8', env: { ...clean, ...env } });
    return { code: r.status, out: r.stdout.trim() };
  };
  const run = (payload: unknown, env: Record<string, string> = {}) =>
    runRaw(JSON.stringify(payload), env);
  const denied = (r: { out: string }) => JSON.parse(r.out).permissionDecision === 'deny';

  // PATH with only bash, sed, tr, head, cat, git, grep: no jq
  const which = (bin: string) =>
    (process.env.PATH ?? '')
      .split(path.delimiter)
      .map((d) => path.join(d, bin))
      .find((f) => fs.existsSync(f));
  beforeAll(() => {
    nojq = fs.mkdtempSync(path.join(os.tmpdir(), 'nojq-'));
    for (const b of ['bash', 'sed', 'tr', 'head', 'cat', 'git', 'grep'])
      fs.symlinkSync(fs.realpathSync(which(b)!), path.join(nojq, b));
  });
  afterAll(() => fs.rmSync(nojq, { recursive: true, force: true }));
  const runNoJq = (payload: unknown) =>
    runRaw(JSON.stringify(payload), {}, { ...process.env, PATH: nojq });
  const dirty = () => fs.writeFileSync(path.join(repo, 'a.txt'), 'x'); // modifies a tracked file
  const untracked = () => fs.writeFileSync(path.join(repo, 'new.txt'), 'x');

  return {
    get repo() {
      return repo;
    },
    get home() {
      return home;
    },
    get nojq() {
      return nojq;
    },
    git,
    withFreshRepo,
    claude,
    copilot,
    runRaw,
    run,
    denied,
    runNoJq,
    dirty,
    untracked,
    which,
  };
};
