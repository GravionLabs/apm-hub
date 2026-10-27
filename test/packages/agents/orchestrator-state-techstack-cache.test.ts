import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { PwshWorker } from '../../helpers/pwsh-worker';
import { T, hasPwsh, script } from './orchestrator-state.helpers';

describe.skipIf(!hasPwsh)('Detect-TechStack.ps1 cache', () => {
  let dir: string;
  // One pwsh worker for the whole describe runs the script in-process for every call (instead of one pwsh start per call).
  let worker: PwshWorker;
  beforeAll(() => {
    worker = new PwshWorker(script);
  });
  afterAll(() => worker.close());
  const run = async (...extra: string[]) => {
    const r = await worker.run(['-ProjectRoot', dir, ...extra], { cwd: dir });
    if (r.status !== 0) throw new Error(`Detect-TechStack exited ${r.status}: ${r.stderr}`);
    return JSON.parse(r.stdout) as { languages: string[]; tools: string[]; manifest_hash: string };
  };
  const cacheFile = () => path.join(dir, '.git/agents/techstack.json');
  const excludeFile = () => path.join(dir, '.git/info/exclude');
  const poison = (extra: object = {}) => {
    const cur = JSON.parse(fs.readFileSync(cacheFile(), 'utf-8'));
    fs.writeFileSync(cacheFile(), JSON.stringify({ ...cur, languages: ['cached'], ...extra }));
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'techstack-'));
    execFileSync('git', ['init', '-q'], { cwd: dir });
    fs.writeFileSync(path.join(dir, 'package.json'), '{}');
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it(
    'writes the cache under the git dir, leaves the exclude file alone and reuses it while manifests are unchanged',
    { timeout: T },
    async () => {
      const first = await run();
      expect(first.languages).toEqual(['ts']);
      expect(first.manifest_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.parse(fs.readFileSync(cacheFile(), 'utf-8')).manifest_hash).toBe(
        first.manifest_hash
      );
      expect(fs.readFileSync(excludeFile(), 'utf-8')).not.toContain('.agents');
      poison();
      expect((await run()).languages).toEqual(['cached']);
    }
  );

  it('recomputes with -NoCache and when a manifest is edited', { timeout: T }, async () => {
    const first = await run();
    poison();
    expect((await run('-NoCache')).languages).toEqual(['ts']);
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x"}');
    poison();
    const edited = await run();
    expect(edited.manifest_hash).not.toBe(first.manifest_hash);
    expect(edited.languages).toEqual(['ts']);
  });

  it('recomputes when a manifest is added, nested or removed', { timeout: T }, async () => {
    const first = await run();
    fs.writeFileSync(path.join(dir, 'pyproject.toml'), '[project]');
    poison();
    const added = await run();
    expect(added.manifest_hash).not.toBe(first.manifest_hash);
    expect(added.languages).toContain('py');

    fs.mkdirSync(path.join(dir, 'svc/api'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'svc/api/App.csproj'), '<Project/>');
    poison();
    const nested = await run();
    expect(nested.manifest_hash).not.toBe(added.manifest_hash);
    expect(nested.languages).toContain('dotnet');

    fs.rmSync(path.join(dir, 'pyproject.toml'));
    poison();
    const removed = await run();
    expect(removed.manifest_hash).not.toBe(nested.manifest_hash);
    expect(removed.languages).not.toContain('py');
  });

  it('recomputes when a tool config file appears', { timeout: T }, async () => {
    const first = await run();
    expect(first.tools).toEqual([]);
    fs.writeFileSync(path.join(dir, 'biome.json'), '{}');
    poison();
    const added = await run();
    expect(added.tools).toEqual(['biome']);
    expect(added.manifest_hash).not.toBe(first.manifest_hash);
    expect(JSON.parse(fs.readFileSync(cacheFile(), 'utf-8')).tools).toEqual(['biome']);
  });

  it('ignores a cache with the wrong shape or hash', { timeout: T }, async () => {
    const first = await run();
    const cur = JSON.parse(fs.readFileSync(cacheFile(), 'utf-8'));
    const { languages, ...noLanguages } = cur;
    void languages;
    fs.writeFileSync(cacheFile(), JSON.stringify({ ...noLanguages, test: ['x'] }));
    expect((await run()).languages).toEqual(['ts']);
    poison({ manifest_hash: 'deadbeef' });
    expect((await run()).languages).toEqual(['ts']);
    const { test: t, ...noTest } = JSON.parse(fs.readFileSync(cacheFile(), 'utf-8'));
    void t;
    fs.writeFileSync(cacheFile(), JSON.stringify({ ...noTest, languages: ['cached'] }));
    expect((await run()).languages).toEqual(['ts']);
    expect((await run()).manifest_hash).toBe(first.manifest_hash);
  });

  it(
    'invalidates a cache holding the hash computed without the schema version prefix',
    { timeout: T },
    async () => {
      const first = await run();
      const entries = ['package.json', 'tsconfig.json'].map(
        (f) =>
          `${f}:${createHash('sha256')
            .update(fs.readFileSync(path.join(dir, f)))
            .digest('hex')
            .toUpperCase()}`
      );
      const legacy = createHash('sha256').update(entries.sort().join('\n')).digest('hex');
      expect(legacy).not.toBe(first.manifest_hash);
      poison({ manifest_hash: legacy });
      const r = await run();
      expect(r.languages).toEqual(['ts']);
      expect(r.manifest_hash).toBe(first.manifest_hash);
    }
  );

  it.each([
    ['uppercase entry', { languages: ['TS'] }],
    ['entry with a path', { implementation: ['../evil'] }],
    ['entry with a space', { test: ['ts-test rm'] }],
    ['non-string entry', { languages: [1] }],
    ['scalar instead of array', { test: 'ts-test' }],
    ['bad packageManager', { packageManager: ['pnpm; x'] }],
    ['bad tools', { tools: ['Vitest; x'] }],
  ])(
    'recomputes and rewrites a cache with an invalid value (%s)',
    { timeout: T },
    async (_n, bad) => {
      const first = await run();
      poison(bad);
      expect((await run()).languages).toEqual(['ts']);
      const rewritten = JSON.parse(fs.readFileSync(cacheFile(), 'utf-8'));
      expect(rewritten.languages).toEqual(['ts']);
      expect(rewritten.manifest_hash).toBe(first.manifest_hash);
    }
  );

  it.skipIf(process.platform === 'win32')(
    'does not read or write through a symlinked state directory',
    { timeout: T },
    async () => {
      const target = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-target-'));
      try {
        fs.symlinkSync(target, path.join(dir, '.git/agents'));
        expect((await run()).languages).toEqual(['ts']);
        expect(fs.readdirSync(target)).toEqual([]);
        fs.writeFileSync(
          path.join(target, 'techstack.json'),
          JSON.stringify({
            languages: ['cached'],
            test: [],
            implementation: [],
            manifest_hash: 'x',
          })
        );
        expect((await run()).languages).toEqual(['ts']);
        expect(fs.readdirSync(target)).toEqual(['techstack.json']);
      } finally {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  );

  it(
    'recovers from a corrupt cache and reports an empty stack as arrays',
    { timeout: T },
    async () => {
      fs.rmSync(path.join(dir, 'package.json'));
      fs.rmSync(path.join(dir, 'tsconfig.json'));
      fs.mkdirSync(path.join(dir, '.git/agents'));
      fs.writeFileSync(cacheFile(), 'not json');
      const r = await run();
      expect(r.languages).toEqual([]);
      expect(JSON.parse(fs.readFileSync(cacheFile(), 'utf-8')).languages).toEqual([]);
    }
  );

  // runs in the shared worker: the script ends with `exit 1`, which the worker reports like `pwsh -File` (status 1)
  it('fails for a missing project root', { timeout: T }, async () => {
    const res = await worker.run(['-ProjectRoot', path.join(dir, 'nope')], { cwd: dir });
    expect(res.status).toBe(1);
  });
});
