#!/usr/bin/env node
// `pnpm run test:related -- [--project <name>] [--coverage] <paths | --staged | --range a..b | --base ref>`:
// runs only the tests selected by related-tests.mjs. ALL runs the whole project (default: unit + scripts).
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { pathsFromArgs, relatedTests } from './related-tests.mjs';

/** Arguments after `vitest run` for a non-empty selection. */
export function buildVitestArgs(tests, { project, coverage = false } = {}) {
  const projects = project ? ['--project', project] : ['--project', 'unit', '--project', 'scripts'];
  const selection = tests[0] === 'ALL' ? projects : project ? [...projects, ...tests] : tests;
  return ['--passWithNoTests', ...(coverage ? ['--coverage'] : []), ...selection];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const pi = argv.indexOf('--project');
  const project = pi >= 0 ? argv[pi + 1] : undefined;
  const coverage = argv.includes('--coverage');
  let tests;
  try {
    tests = relatedTests(pathsFromArgs(argv.filter((a) => a !== '--coverage')), { project });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  if (tests.length === 0) {
    console.log('No related tests.');
    process.exit(0);
  }
  const r = spawnSync(
    'pnpm',
    ['exec', 'vitest', 'run', ...buildVitestArgs(tests, { project, coverage })],
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    }
  );
  process.exit(r.status ?? 1);
}
