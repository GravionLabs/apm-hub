import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PwshWorker } from '../../helpers/pwsh-worker';

const SCRIPT = path.resolve(
  __dirname,
  '../../../packages/shared/.apm/skills/detect-techstack/scripts/Detect-TechStack.ps1',
);
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

describe.skipIf(!hasPwsh)('Detect-TechStack.ps1 Rust and Tauri', () => {
  let dir: string;
  // one pwsh worker for the describe runs the script in-process per call instead of one pwsh start per case
  let worker: PwshWorker;
  beforeAll(() => {
    worker = new PwshWorker(SCRIPT);
  });
  afterAll(() => worker.close());
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const write = (rel: string, content = '') => {
    const f = path.join(dir, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, content);
  };
  const detect = async () => {
    const r = await worker.run(['-ProjectRoot', dir], { cwd: dir });
    expect(r.status).toBe(0);
    return JSON.parse(r.stdout);
  };

  it('reports a pure Rust project', async () => {
    write('Cargo.toml', '[package]\nname = "x"\n');
    const r = await detect();
    expect(r.languages).toEqual(['rust']);
    expect(r.test).toEqual(['rust-test']);
    expect(r.implementation).toEqual(['rust-implementation']);
    expect(r.packageManager).toEqual(['cargo']);
    expect(r.frameworks).toEqual([]);
  });

  it('reports tools by config file presence in the project root', async () => {
    expect((await detect()).tools).toEqual([]);
    write('Cargo.toml', '[package]\n');
    write('biome.jsonc', '{}');
    write('eslint.config.mjs');
    write('.prettierrc.json');
    write('jest.config.js');
    write('pytest.ini');
    write('vitest.config.ts');
    expect((await detect()).tools).toEqual([
      'vitest',
      'biome',
      'eslint',
      'prettier',
      'jest',
      'pytest',
      'cargo',
    ]);
  });

  it('detects vitest via vite.config test block, devDependencies, and pytest via pyproject', async () => {
    write('vite.config.ts', 'export default { plugins: [] };');
    expect((await detect()).tools).toEqual([]);
    write('vite.config.ts', 'export default { test: { globals: true } };');
    expect((await detect()).tools).toEqual(['vitest']);
    fs.rmSync(path.join(dir, 'vite.config.ts'));
    write('package.json', '{"devDependencies":{"vitest":"^2"}}');
    write('pyproject.toml', '[tool.pytest.ini_options]\n');
    expect((await detect()).tools).toEqual(['vitest', 'pytest']);
  });

  it('reports Tauri next to the TS frontend (Tauri 2, json)', async () => {
    write('package.json', '{"packageManager":"pnpm@9.0.0"}');
    write('tsconfig.json', '{}');
    write('src-tauri/Cargo.toml', '[package]\nname = "app"\n');
    write('src-tauri/tauri.conf.json', '{}');
    const r = await detect();
    expect(r.languages).toEqual(['ts', 'rust']);
    expect(r.test).toEqual(['ts-test', 'rust-test']);
    expect(r.implementation).toEqual(['ts-implementation', 'rust-implementation']);
    expect(r.frameworks).toEqual(['tauri']);
    expect(r.packageManager).toEqual(['pnpm', 'cargo']);
  });

  it.each([
    ['react', { dependencies: { react: '^19' } }, ['react']],
    ['next', { dependencies: { next: '^15', react: '^19' } }, ['react', 'next']],
    ['vue', { devDependencies: { vue: '^3' } }, ['vue']],
    ['svelte', { devDependencies: { svelte: '^5' } }, ['svelte']],
  ])('reports %s from package.json dependencies, skills stay ts', async (_n, deps, expected) => {
    write('package.json', JSON.stringify(deps));
    write('tsconfig.json', '{}');
    const r = await detect();
    expect(r.frameworks).toEqual(expected);
    expect(r.languages).toEqual(['ts']);
    expect(r.test).toEqual(['ts-test']);
    expect(r.implementation).toEqual(['ts-implementation']);
  });

  it('reports react next to angular in a monorepo and js without tsconfig', async () => {
    write('apps/web/package.json', '{"dependencies":{"react":"^19"}}');
    write('apps/ng/angular.json', '{}');
    write('apps/ng/package.json', '{"dependencies":{"@angular/core":"^20"}}');
    expect((await detect()).frameworks).toEqual(['react', 'angular']);
  });

  it('reports react for a js project and ignores unrelated or empty dependencies', async () => {
    write('package.json', '{"dependencies":{"react":"^19"}}');
    const r = await detect();
    expect(r.languages).toEqual(['js']);
    expect(r.frameworks).toEqual(['react']);
    write(
      'package.json',
      '{"dependencies":{"react-dom":"^19","preact":"^10"},"devDependencies":null}',
    );
    expect((await detect()).frameworks).toEqual([]);
  });

  it('detects tauri.conf.json5', async () => {
    write('src-tauri/Cargo.toml', '[package]\n');
    write('src-tauri/tauri.conf.json5', '{}');
    expect((await detect()).frameworks).toEqual(['tauri']);
  });

  it('ignores a tauri.conf.json outside src-tauri', async () => {
    write('Cargo.toml', '[package]\n');
    write('docs/tauri.conf.json', '{}');
    expect((await detect()).frameworks).toEqual([]);
  });

  it('reports a Rust + Python monorepo', async () => {
    write('crates/core/Cargo.toml', '[package]\n');
    write('py/pyproject.toml', '[project]\nname = "p"\n');
    const r = await detect();
    expect(r.languages).toEqual(['py', 'rust']);
    expect(r.test).toEqual(['py-test', 'rust-test']);
    expect(r.packageManager).toEqual(['cargo']);
  });

  it('reports no rust without Cargo.toml', async () => {
    write('package.json', '{}');
    expect((await detect()).languages).not.toContain('rust');
  });

  it('detects tauri when both tauri.conf.json and tauri.conf.json5 exist, once', async () => {
    write('src-tauri/Cargo.toml', '[package]\n');
    write('src-tauri/tauri.conf.json', '{}');
    write('src-tauri/tauri.conf.json5', '{}');
    expect((await detect()).frameworks).toEqual(['tauri']);
  });

  it('detects tauri with src-tauri but no package.json', async () => {
    write('src-tauri/Cargo.toml', '[package]\n');
    write('src-tauri/tauri.conf.json', '{}');
    const r = await detect();
    expect(r.languages).toEqual(['rust']);
    expect(r.frameworks).toEqual(['tauri']);
    expect(r.packageManager).toEqual(['cargo']);
  });

  it.each(['target', 'vendor', 'node_modules'])('ignores a Cargo.toml under %s/', async (d) => {
    write('package.json', '{}');
    write(`${d}/dep/Cargo.toml`, '[package]\n');
    expect((await detect()).languages).not.toContain('rust');
  });
});
