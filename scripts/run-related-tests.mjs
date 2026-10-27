#!/usr/bin/env node
// `pnpm run test:related -- [--project <name>] [--coverage] <paths | --staged | --range a..b | --base ref>`:
// runs only the tests selected by related-tests.mjs. ALL runs the whole project (default: unit + scripts).
import { spawnSync } from 'node:child_process';
import { pathsFromArgs, relatedTests } from './related-tests.mjs';

const argv = process.argv.slice(2);
const pi = argv.indexOf('--project');
const project = pi >= 0 ? argv[pi + 1] : undefined;
const coverage = argv.includes('--coverage');
const pathArgs = argv.filter((a) => a !== '--coverage');

const tests = relatedTests(pathsFromArgs(pathArgs), { project });
if (tests.length === 0) {
  console.log('No related tests.');
  process.exit(0);
}
const projects = project ? ['--project', project] : ['--project', 'unit', '--project', 'scripts'];
const vitestArgs = tests[0] === 'ALL' ? projects : project ? [...projects, ...tests] : tests;
const extra = ['--passWithNoTests', ...(coverage ? ['--coverage'] : [])];
const r = spawnSync('pnpm', ['exec', 'vitest', 'run', ...extra, ...vitestArgs], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 1);
