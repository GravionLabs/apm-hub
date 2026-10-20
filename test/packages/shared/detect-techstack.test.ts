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
    const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-ProjectRoot', dir, '-NoCache'], { encoding: 'utf8' });
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
    const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-ProjectRoot', dir], { encoding: 'utf8' });
    expect(JSON.parse(r.stdout).languages).toEqual(['rust']);
  });
});
