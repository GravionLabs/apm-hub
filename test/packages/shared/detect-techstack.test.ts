import * as crypto from 'crypto';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(
  __dirname,
  '../../../packages/shared/.apm/skills/detect-techstack/scripts/Detect-TechStack.ps1',
);
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

describe.skipIf(!hasPwsh)('Detect-TechStack.ps1 Rust and Tauri', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const write = (rel: string, content = '') => {
    const f = path.join(dir, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, content);
  };
  const detect = () => {
    const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-ProjectRoot', dir, '-NoCache'], { encoding: 'utf8', env: { ...process.env, DROMOS_STATE_DIR: path.join(dir, '.agents') } });
    expect(r.status).toBe(0);
    return JSON.parse(r.stdout);
  };

  it('reports a pure Rust project', () => {
    write('Cargo.toml', '[package]\nname = "x"\n');
    const r = detect();
    expect(r.languages).toEqual(['rust']);
    expect(r.test).toEqual(['rust-test']);
    expect(r.implementation).toEqual(['rust-implementation']);
    expect(r.packageManager).toEqual(['cargo']);
    expect(r.frameworks).toEqual([]);
  });

  it('reports Tauri next to the TS frontend (Tauri 2, json)', () => {
    write('package.json', '{"packageManager":"pnpm@9.0.0"}');
    write('tsconfig.json', '{}');
    write('src-tauri/Cargo.toml', '[package]\nname = "app"\n');
    write('src-tauri/tauri.conf.json', '{}');
    const r = detect();
    expect(r.languages).toEqual(['ts', 'rust']);
    expect(r.test).toEqual(['ts-test', 'rust-test']);
    expect(r.implementation).toEqual(['ts-implementation', 'rust-implementation']);
    expect(r.frameworks).toEqual(['tauri']);
    expect(r.packageManager).toEqual(['pnpm', 'cargo']);
  });

  it('detects tauri.conf.json5', () => {
    write('src-tauri/Cargo.toml', '[package]\n');
    write('src-tauri/tauri.conf.json5', '{}');
    expect(detect().frameworks).toEqual(['tauri']);
  });

  it('ignores a tauri.conf.json outside src-tauri', () => {
    write('Cargo.toml', '[package]\n');
    write('docs/tauri.conf.json', '{}');
    expect(detect().frameworks).toEqual([]);
  });

  it('reports a Rust + Python monorepo', () => {
    write('crates/core/Cargo.toml', '[package]\n');
    write('py/pyproject.toml', '[project]\nname = "p"\n');
    const r = detect();
    expect(r.languages).toEqual(['py', 'rust']);
    expect(r.test).toEqual(['py-test', 'rust-test']);
    expect(r.packageManager).toEqual(['cargo']);
  });

  it('reports no rust without Cargo.toml', () => {
    write('package.json', '{}');
    expect(detect().languages).not.toContain('rust');
  });

  it('detects tauri when both tauri.conf.json and tauri.conf.json5 exist, once', () => {
    write('src-tauri/Cargo.toml', '[package]\n');
    write('src-tauri/tauri.conf.json', '{}');
    write('src-tauri/tauri.conf.json5', '{}');
    expect(detect().frameworks).toEqual(['tauri']);
  });

  it('detects tauri with src-tauri but no package.json', () => {
    write('src-tauri/Cargo.toml', '[package]\n');
    write('src-tauri/tauri.conf.json', '{}');
    const r = detect();
    expect(r.languages).toEqual(['rust']);
    expect(r.frameworks).toEqual(['tauri']);
    expect(r.packageManager).toEqual(['cargo']);
  });

  it.each(['target', 'vendor', 'node_modules'])('ignores a Cargo.toml under %s/', (d) => {
    write('package.json', '{}');
    write(`${d}/dep/Cargo.toml`, '[package]\n');
    expect(detect().languages).not.toContain('rust');
  });

  it('recomputes a cache written under the techstack-v2 schema', () => {
    write('Cargo.toml', '[package]\n');
    // the hash the v2 script would have stored for this exact project
    const fileHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'Cargo.toml'))).digest('hex').toUpperCase();
    const v2Hash = crypto.createHash('sha256').update(`techstack-v2\nCargo.toml:${fileHash}`).digest('hex');
    write('.agents/techstack.json', JSON.stringify({ languages: ['stale'], test: ['stale-test'], implementation: ['stale-implementation'], manifest_hash: v2Hash }));
    const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-ProjectRoot', dir], { encoding: 'utf8', env: { ...process.env, DROMOS_STATE_DIR: path.join(dir, '.agents') } });
    expect(JSON.parse(r.stdout).languages).toEqual(['rust']);
  });
});

describe.skipIf(!hasPwsh)('Detect-TechStack.ps1 state directory (#402)', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'detect-state-')));
    fs.writeFileSync(path.join(dir, 'Cargo.toml'), '[package]\n');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  const detect = (env: Record<string, string> = {}, ...args: string[]) => {
    const e: NodeJS.ProcessEnv = { ...process.env, ...env };
    for (const k of Object.keys(e)) if (k.startsWith('GIT_')) delete e[k];
    if (!('DROMOS_STATE_DIR' in env)) delete e.DROMOS_STATE_DIR;
    return spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-ProjectRoot', dir, ...args], { encoding: 'utf8', env: e });
  };

  it('reports state_dir, caches there and leaves .git/info/exclude untouched', () => {
    spawnSync('git', ['-C', dir, 'init', '-q']);
    const exclude = path.join(dir, '.git', 'info', 'exclude');
    const before = fs.readFileSync(exclude, 'utf8');
    const r = detect();
    expect(r.status).toBe(0);
    const stateDir = path.join(dir, '.git', 'agents');
    expect(JSON.parse(r.stdout).state_dir).toBe(stateDir);
    expect(fs.existsSync(path.join(stateDir, 'techstack.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, '.agents'))).toBe(false);
    expect(fs.readFileSync(exclude, 'utf8')).toBe(before);
  });

  it('reports state_dir when the cache is used', () => {
    spawnSync('git', ['-C', dir, 'init', '-q']);
    detect();
    const cached = detect();
    expect(JSON.parse(cached.stdout)).toMatchObject({ languages: ['rust'], state_dir: path.join(dir, '.git', 'agents') });
  });

  it('honours DROMOS_STATE_DIR', () => {
    const state = path.join(dir, 'custom-state');
    const r = detect({ DROMOS_STATE_DIR: state });
    expect(JSON.parse(r.stdout).state_dir).toBe(state);
    expect(fs.existsSync(path.join(state, 'techstack.json'))).toBe(true);
  });

  it('outside a repository still detects, without a cache (state_dir null)', () => {
    const r = detect();
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({ languages: ['rust'], state_dir: null });
  });

  it('does not cache through a symlinked state directory but still reports', () => {
    const real = path.join(dir, 'real');
    fs.mkdirSync(real);
    const link = path.join(dir, 'link');
    fs.symlinkSync(real, link);
    const r = detect({ DROMOS_STATE_DIR: link });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).languages).toEqual(['rust']);
    expect(fs.readdirSync(real)).toEqual([]);
  });
});
