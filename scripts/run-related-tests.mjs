#!/usr/bin/env node
// `pnpm run test:related -- <paths | --staged | --range a..b>`: runs only the tests selected by related-tests.mjs.
import { spawnSync } from 'node:child_process';
import { pathsFromArgs, relatedTests } from './related-tests.mjs';

const tests = relatedTests(pathsFromArgs(process.argv.slice(2)));
if (tests.length === 0) {
  console.log('No related tests.');
  process.exit(0);
}
const vitestArgs = tests[0] === 'ALL' ? ['--project', 'unit', '--project', 'scripts'] : tests;
const r = spawnSync('pnpm', ['exec', 'vitest', 'run', ...vitestArgs], { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
