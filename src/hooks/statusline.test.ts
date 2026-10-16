import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { hasPwsh, posix } from './queue.helpers';

const DIR = path.resolve(__dirname, '../../packages/hooks/.apm/skills/context-statusline/scripts');
const STATUS = path.join(DIR, 'statusline.mjs');
const SUB = path.join(DIR, 'subagent-statusline.mjs');
const INSTALLER = path.join(DIR, 'Install-Statusline.ps1');
// eslint-disable-next-line no-control-regex
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
const run = (script: string, stdin: string, cwd?: string) =>
  spawnSync('node', [script], { input: stdin, encoding: 'utf8', cwd });

describe('statusline.mjs', () => {
  let tmp: string;
  beforeEach(() => (tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-'))));
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('renders dir, model, context and rate limits', () => {
    const r = run(STATUS, JSON.stringify({
      workspace: { current_dir: tmp },
      model: { display_name: 'Opus 4' },
      context_window: { used_percentage: 41.6 },
      rate_limits: { five_hour: { used_percentage: 12.2 }, seven_day: { used_percentage: 30 } },
    }));
    expect(r.status).toBe(0);
    const out = strip(r.stdout);
    expect(out).toContain(`:${tmp} Opus 4 ctx:42%`);
    expect(out).toContain('5h:12% 7d:30%');
    expect(out).toMatch(/^[^@\s]+@[^:\s]+:/);
    expect(out).not.toContain('(');
  });

  it('is null-safe', () => {
    const r = run(STATUS, JSON.stringify({
      workspace: { current_dir: tmp }, model: null, context_window: { used_percentage: null },
      rate_limits: { five_hour: null, seven_day: { used_percentage: null } },
    }));
    expect(r.status).toBe(0);
    expect(strip(r.stdout)).toMatch(new RegExp(`:${tmp.replace(/[\\/]/g, '.')}$`));
  });

  it('prefers current_context_used_percentage (Copilot CLI payload, no rate limits)', () => {
    const r = run(STATUS, JSON.stringify({
      cwd: tmp, session_id: 's1', model: { id: 'gpt-5', display_name: 'GPT-5' }, workspace: { current_dir: tmp },
      context_window: { used_percentage: 30, current_context_used_percentage: 12.4 }, cost: { total_premium_requests: 3 },
    }));
    const out = strip(r.stdout);
    expect(out).toContain('GPT-5 ctx:12%');
    expect(out).not.toContain('5h:');
    expect(strip(run(STATUS, JSON.stringify({ workspace: { current_dir: tmp }, context_window: { used_percentage: 30, current_context_used_percentage: null } })).stdout)).toContain('ctx:30%');
  });

  it('shows only the 7d limit when 5h is missing', () => {
    const out = strip(run(STATUS, JSON.stringify({ workspace: { current_dir: tmp }, rate_limits: { seven_day: { used_percentage: 7 } } })).stdout);
    expect(out).toMatch(/ 7d:7%$/);
    expect(out).not.toContain('5h:');
  });

  it('falls back to cwd, then to the process directory, on missing fields', () => {
    expect(strip(run(STATUS, JSON.stringify({ cwd: tmp })).stdout)).toContain(`:${tmp}`);
    expect(strip(run(STATUS, '{}', tmp).stdout)).toContain(`:${fs.realpathSync(tmp)}`);
  });

  it.each(['', 'garbage', '[1,2]', 'null', '"x"'])('exits 0 with defaults on stdin %j', (stdin) => {
    const r = run(STATUS, stdin, tmp);
    expect(r.status).toBe(0);
    expect(strip(r.stdout)).toContain('@');
  });

  it.skipIf(spawnSync('git', ['--version']).status !== 0)('shows the git branch', () => {
    const git = (...a: string[]) => spawnSync('git', ['-C', tmp, ...a], { encoding: 'utf8' });
    git('init', '-q', '-b', 'topic/x');
    const out = strip(run(STATUS, JSON.stringify({ workspace: { current_dir: tmp } })).stdout);
    expect(out).toContain('(topic/x)');
  });
});

describe('subagent-statusline.mjs', () => {
  const rows = (stdout: string) => stdout.trim().split('\n').map((l) => JSON.parse(l));
  const task = (o: Record<string, unknown>) => ({ id: 't1', agentType: 'explorer', label: 'scan', ...o });

  it('prints one JSON line per task with agent, model, percent, tokens and label', () => {
    const r = run(SUB, JSON.stringify({ columns: 80, tasks: [
      task({ model: 'claude-haiku-4-5-20251001', tokenCount: 36000, contextWindowSize: 200000 }),
      task({ id: 't2', agentType: 'planner', model: 'opus', tokenCount: 100000, contextWindowSize: 200000, label: 'plan it' }),
    ] }));
    expect(r.status).toBe(0);
    const [a, b] = rows(r.stdout);
    expect(a.id).toBe('t1');
    expect(strip(a.content)).toBe('explorer haiku-4-5 ctx:18% (36k) · scan');
    expect(strip(b.content)).toBe('planner opus ctx:50% (100k) · plan it');
  });

  it.each([[10000, '32'], [99999, '32'], [100000, '33'], [159999, '33'], [160000, '31'], [250000, '31']])(
    'colours %i tokens of 200000 with code %s', (tokens, code) => {
      const [row] = rows(run(SUB, JSON.stringify({ tasks: [task({ tokenCount: tokens, contextWindowSize: 200000 })] })).stdout);
      expect(row.content).toContain(`\x1b[${code}mctx:`);
    });

  it('shows only the token count when contextWindowSize is missing or zero', () => {
    for (const size of [undefined, 0, null]) {
      const [row] = rows(run(SUB, JSON.stringify({ tasks: [task({ tokenCount: 12400, contextWindowSize: size })] })).stdout);
      expect(strip(row.content)).toBe('explorer 12k · scan');
    }
  });

  it('uses defaults for missing fields (name, description, no tokens)', () => {
    const [row] = rows(run(SUB, JSON.stringify({ tasks: [{ id: 7, name: 'bob', description: 'desc' }] })).stdout);
    expect(row.id).toBe(7);
    expect(strip(row.content)).toBe('bob 0k · desc');
    const [bare] = rows(run(SUB, JSON.stringify({ tasks: [{ id: 'x' }] })).stdout);
    expect(strip(bare.content)).toBe('agent 0k · ');
  });

  it('skips malformed tasks', () => {
    const r = run(SUB, JSON.stringify({ tasks: [null, 5, 'x', {}, task({})] }));
    expect(rows(r.stdout)).toHaveLength(1);
  });

  it.each(['', 'garbage', '[]', 'null', '{}', '{"tasks":"x"}', '{"tasks":[]}'])('prints nothing and exits 0 on stdin %j', (stdin) => {
    const r = run(SUB, stdin);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });
});

describe.skipIf(!hasPwsh || !posix)('Install-Statusline.ps1', () => {
  let tmp: string;
  let home: string;
  let settings: string;
  let dest: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'slinst-'));
    home = path.join(tmp, 'home');
    settings = path.join(home, '.claude', 'settings.json');
    dest = path.join(home, '.claude', 'apm-hub', 'statusline');
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const install = (...args: string[]) => {
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home };
    delete env.USERPROFILE;
    return spawnSync('pwsh', ['-NoProfile', '-File', INSTALLER, ...args], { encoding: 'utf8', cwd: tmp, env });
  };
  const read = () => JSON.parse(fs.readFileSync(settings, 'utf8'));
  const backups = () => fs.readdirSync(path.dirname(settings)).filter((f) => f.startsWith('settings.json.bak-'));
  const ours = (f: string) => ({ type: 'command', command: `node ~/.claude/apm-hub/statusline/${f}` });

  it('installs into a fresh HOME without settings.json', () => {
    fs.rmSync(path.dirname(settings), { recursive: true });
    const r = install();
    expect(r.status).toBe(0);
    expect(read()).toEqual({ statusLine: ours('statusline.mjs'), subagentStatusLine: ours('subagent-statusline.mjs') });
    for (const f of ['statusline.mjs', 'subagent-statusline.mjs']) {
      expect(fs.readFileSync(path.join(dest, f), 'utf8')).toBe(fs.readFileSync(path.join(DIR, f), 'utf8'));
    }
    expect(fs.readFileSync(settings, 'utf8')).toContain('\n  "statusLine": {');
  });

  it('keeps other keys and their order, and writes a backup', () => {
    const orig = '{\n  "model": "opus",\n  "env": { "A": "ü" },\n  "hooks": { "Stop": [] }\n}\n';
    fs.writeFileSync(settings, orig);
    expect(install().status).toBe(0);
    const s = read();
    expect(Object.keys(s)).toEqual(['model', 'env', 'hooks', 'statusLine', 'subagentStatusLine']);
    expect(s.env).toEqual({ A: 'ü' });
    expect(backups()).toHaveLength(1);
    expect(fs.readFileSync(path.join(path.dirname(settings), backups()[0]), 'utf8')).toBe(orig);
  });

  it('is idempotent: second run changes nothing and writes no backup', () => {
    install();
    const before = fs.readFileSync(settings, 'utf8');
    const r = install();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Up to date');
    expect(fs.readFileSync(settings, 'utf8')).toBe(before);
    expect(backups()).toHaveLength(0);
  });

  it('refreshes a stale copied script', () => {
    install();
    fs.writeFileSync(path.join(dest, 'statusline.mjs'), 'old');
    expect(install().status).toBe(0);
    expect(fs.readFileSync(path.join(dest, 'statusline.mjs'), 'utf8')).toBe(fs.readFileSync(STATUS, 'utf8'));
  });

  it('refuses a foreign statusLine without -Force and leaves everything untouched', () => {
    const orig = JSON.stringify({ statusLine: { type: 'command', command: 'bash ~/mine.sh' }, x: 1 }, null, 2);
    fs.writeFileSync(settings, orig);
    const r = install();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('-Force');
    expect(fs.readFileSync(settings, 'utf8')).toBe(orig);
    expect(fs.existsSync(dest)).toBe(false);
  });

  it('replaces a foreign statusLine with -Force', () => {
    fs.writeFileSync(settings, JSON.stringify({ statusLine: { type: 'command', command: 'bash ~/mine.sh' }, x: 1 }));
    expect(install('-Force').status).toBe(0);
    expect(read()).toEqual({ statusLine: ours('statusline.mjs'), x: 1, subagentStatusLine: ours('subagent-statusline.mjs') });
  });

  it('fails on invalid JSON without touching the file', () => {
    fs.writeFileSync(settings, '{ nope');
    const r = install();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('not valid JSON');
    expect(fs.readFileSync(settings, 'utf8')).toBe('{ nope');
  });

  it('-WhatIf changes nothing', () => {
    fs.writeFileSync(settings, '{"a":1}');
    expect(install('-WhatIf').status).toBe(0);
    expect(fs.readFileSync(settings, 'utf8')).toBe('{"a":1}');
    expect(fs.existsSync(dest)).toBe(false);
    expect(backups()).toHaveLength(0);
  });

  it('-Uninstall removes only our entries and files', () => {
    fs.writeFileSync(settings, JSON.stringify({ keep: true }));
    install();
    expect(install('-Uninstall').status).toBe(0);
    expect(read()).toEqual({ keep: true });
    expect(fs.existsSync(dest)).toBe(false);
  });

  it('-Uninstall leaves a foreign statusLine alone', () => {
    const foreign = { type: 'command', command: 'bash ~/mine.sh' };
    fs.writeFileSync(settings, JSON.stringify({ statusLine: foreign }));
    expect(install('-Uninstall').status).toBe(0);
    expect(read()).toEqual({ statusLine: foreign });
  });

  it('-Uninstall without settings.json is a no-op', () => {
    expect(install('-Uninstall').status).toBe(0);
    expect(fs.existsSync(settings)).toBe(false);
  });
});

describe.skipIf(!hasPwsh || !posix)('Install-Statusline.ps1 -Client copilot', () => {
  let tmp: string;
  let home: string;
  let chome: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'slcop-'));
    home = path.join(tmp, 'home');
    chome = path.join(tmp, 'chome');
    fs.mkdirSync(home);
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const install = (env2: Record<string, string>, ...args: string[]) => {
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, ...env2 };
    delete env.USERPROFILE;
    if (!('COPILOT_HOME' in env2)) delete env.COPILOT_HOME;
    return spawnSync('pwsh', ['-NoProfile', '-File', INSTALLER, '-Client', 'copilot', ...args], { encoding: 'utf8', cwd: tmp, env });
  };
  const sp = (base: string) => path.join(base, 'settings.json');
  const read = (base: string) => JSON.parse(fs.readFileSync(sp(base), 'utf8'));
  const entry = (base: string) => ({ type: 'command', command: `node ${base}/apm-hub/statusline/statusline.mjs`, padding: 1 });

  it('installs under ~/.copilot with the feature flag and no subagent entry', () => {
    const r = install({});
    expect(r.status).toBe(0);
    const base = path.join(home, '.copilot');
    expect(read(base)).toEqual({ statusLine: entry('~/.copilot'), feature_flags: { enabled: ['STATUS_LINE'] } });
    expect(fs.readFileSync(path.join(base, 'apm-hub/statusline/statusline.mjs'), 'utf8')).toBe(fs.readFileSync(STATUS, 'utf8'));
    expect(fs.existsSync(path.join(base, 'apm-hub/statusline/subagent-statusline.mjs'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.claude'))).toBe(false);
  });

  it('uses COPILOT_HOME with an absolute command path', () => {
    expect(install({ COPILOT_HOME: chome }).status).toBe(0);
    expect(read(chome).statusLine).toEqual(entry(chome));
    expect(fs.existsSync(path.join(home, '.copilot'))).toBe(false);
  });

  it('keeps existing flags and keys, adds the flag once, is idempotent', () => {
    fs.mkdirSync(chome);
    fs.writeFileSync(sp(chome), JSON.stringify({ model: 'x', feature_flags: { enabled: ['OTHER'], disabled: ['D'] } }));
    expect(install({ COPILOT_HOME: chome }).status).toBe(0);
    const once = fs.readFileSync(sp(chome), 'utf8');
    expect(read(chome)).toEqual({ model: 'x', feature_flags: { enabled: ['OTHER', 'STATUS_LINE'], disabled: ['D'] }, statusLine: entry(chome) });
    const r = install({ COPILOT_HOME: chome });
    expect(r.stdout).toContain('Up to date');
    expect(fs.readFileSync(sp(chome), 'utf8')).toBe(once);
    expect(fs.readdirSync(chome).filter((f) => f.includes('.bak-'))).toHaveLength(1);
  });

  it('does not duplicate an already enabled flag', () => {
    fs.mkdirSync(chome);
    fs.writeFileSync(sp(chome), JSON.stringify({ feature_flags: { enabled: ['STATUS_LINE'] } }));
    install({ COPILOT_HOME: chome });
    expect(read(chome).feature_flags.enabled).toEqual(['STATUS_LINE']);
  });

  it('refuses a foreign statusLine without -Force, replaces it with -Force', () => {
    fs.mkdirSync(chome);
    const orig = JSON.stringify({ statusLine: { type: 'command', command: 'mine' } });
    fs.writeFileSync(sp(chome), orig);
    const r = install({ COPILOT_HOME: chome });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('-Force');
    expect(fs.readFileSync(sp(chome), 'utf8')).toBe(orig);
    expect(install({ COPILOT_HOME: chome }, '-Force').status).toBe(0);
    expect(read(chome).statusLine).toEqual(entry(chome));
  });

  it('-WhatIf changes nothing', () => {
    expect(install({ COPILOT_HOME: chome }, '-WhatIf').status).toBe(0);
    expect(fs.existsSync(chome)).toBe(false);
  });

  it('-Uninstall removes entry and script, leaves the flag and other keys', () => {
    fs.mkdirSync(chome);
    fs.writeFileSync(sp(chome), JSON.stringify({ keep: 1 }));
    install({ COPILOT_HOME: chome });
    expect(install({ COPILOT_HOME: chome }, '-Uninstall').status).toBe(0);
    expect(read(chome)).toEqual({ keep: 1, feature_flags: { enabled: ['STATUS_LINE'] } });
    expect(fs.existsSync(path.join(chome, 'apm-hub/statusline'))).toBe(false);
  });

  it('-Client all installs both', () => {
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, COPILOT_HOME: chome };
    delete env.USERPROFILE;
    const r = spawnSync('pwsh', ['-NoProfile', '-File', INSTALLER, '-Client', 'all'], { encoding: 'utf8', cwd: tmp, env });
    expect(r.status).toBe(0);
    expect(Object.keys(read(path.join(home, '.claude')))).toEqual(['statusLine', 'subagentStatusLine']);
    expect(read(chome).statusLine).toEqual(entry(chome));
  });
});
