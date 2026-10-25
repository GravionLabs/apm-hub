import { spawnSync } from 'child_process';
import { ALWAYS_FULL, REFERENCE } from '../../helpers/classify-reference';

const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

if (!hasPwsh) console.warn('pwsh not found: skipping Classify-Diff.ps1 tests');

it.runIf(!hasPwsh && !!process.env.CI)('pwsh is installed in CI', () => {
  expect(hasPwsh).toBe(true);
});

it('reference documents the always-full destination list', () => {
  expect(ALWAYS_FULL.length).toBeGreaterThan(40);
  expect(ALWAYS_FULL).toEqual(
    expect.arrayContaining([
      'package.json',
      'jest.config.js',
      '.eslintrc.js',
      'src/index.js',
      'vitest.config.ts',
    ])
  );
});

it('reference names the path triggers that the SENSITIVE fixtures exercise', () => {
  const dims = REFERENCE.slice(REFERENCE.indexOf('## Dimensions'));
  for (const w of ['auth', 'jwt', 'tls', 'migration', 'hook', 'Dockerfile', '`.env`', '`public/`'])
    expect(dims).toContain(w);
});

it('reference lists the executable-looking docs triggers', () => {
  const dims = REFERENCE.slice(REFERENCE.indexOf('## Dimensions'));
  for (const w of ['<script', 'import', 'require(', 'child_process', 'process.env', 'fs.write'])
    expect(dims).toContain(w);
});
