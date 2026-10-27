#!/usr/bin/env node
// Maps changed paths to the test files that cover them (Node >= 22, no dependencies).
//   node scripts/related-tests.mjs <path...>        explicit paths
//   node scripts/related-tests.mjs --staged         staged files (git diff --cached --name-only)
//   node scripts/related-tests.mjs --range a..b     files changed in a revision range
//   --base <ref>      files changed in `git diff --name-only <ref>...HEAD`
//   --project <name>  (unit|scripts|integration|perf) list only that Vitest project's files, incl. queue
//                     integration tests and perf files; without it `*.perf.test.ts` files are never listed
//                     (run `pnpm run test:perf`) and queue integration tests are not mapped.
// Prints one test file per line (sorted, deduplicated), or the single word ALL when the
// change can affect anything (shared helpers, config, lockfile, unknown paths). Exit code 0.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALL_PATHS = new Set(['vitest.config.ts', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json']);

// Caller workflows of GravionLabs/ci; release-workflow.test.ts checks them besides the test/repo tests.
const CALLER_WORKFLOWS = new Set([
  '.github/workflows/release-branch.yml',
  '.github/workflows/issue-events.yml',
  '.github/workflows/project-needs.yml',
]);

/** Recursive list of repo-relative `*.test.ts` files below `dir` (posix separators). */
function listTests(root, dir) {
  const abs = path.join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : listTests(root, rel);
    return e.name.endsWith('.test.ts') ? [rel] : [];
  });
}

// Skill/script areas whose changes can affect the queue integration tests.
const INTEGRATION_AREAS = [
  'packages/delivery/.apm/skills/queue/',
  'packages/github/.apm/skills/github-issue/scripts/',
];

/** Quoted entries of `scriptsTests` in test/helpers/scripts-tests.ts (root first, then this checkout). */
function scriptsList(root) {
  for (const r of [root, REPO_ROOT]) {
    const f = path.join(r, 'test/helpers/scripts-tests.ts');
    if (existsSync(f))
      return new Set(
        [...readFileSync(f, 'utf8').matchAll(/'([^']+\.test\.ts)'/g)].map((x) => x[1])
      );
  }
  return new Set();
}

/** Vitest project a repo-relative test file belongs to (mirrors vitest.config.ts), or null. */
export function projectOf(file, scripts) {
  if (file.endsWith('.perf.test.ts')) return file.startsWith('test/packages/') ? 'perf' : null;
  if (file.endsWith('.integration.test.ts'))
    return file.startsWith('test/integration/queue/') ? 'integration' : null;
  if (scripts.has(file)) return 'scripts';
  return /^(src|test\/repo|test\/packages)\//.test(file) ? 'unit' : null;
}

/**
 * @param {string[]} paths repo-relative changed paths
 * @param {{root?: string, project?: 'unit'|'scripts'|'integration'|'perf'}} [options]
 *   repo root (defaults to this checkout); project limits the result to that Vitest project
 * @returns {string[]} sorted unique test files, or ['ALL']
 */
export function relatedTests(paths, { root = REPO_ROOT, project } = {}) {
  const out = new Set();
  const srcTests = () => listTests(root, 'src');
  const validators = () =>
    listTests(root, 'src/generators').filter((f) => /validator[^/]*\.test\.ts$/.test(f));

  for (const raw of paths) {
    const p = raw.trim().replace(/\\/g, '/').replace(/^\.\//, '');
    if (!p) continue;
    let m;
    if (p.endsWith('.test.ts')) {
      if (existsSync(path.join(root, p))) out.add(p);
    } else if (ALL_PATHS.has(p) || p.startsWith('test/helpers/')) {
      return ['ALL'];
    } else if (p.startsWith('src/')) {
      const own = p.endsWith('.ts') ? p.replace(/\.ts$/, '.test.ts') : null;
      if (own && existsSync(path.join(root, own))) out.add(own);
      else srcTests().forEach((f) => out.add(f));
    } else if ((m = /^packages\/([^/]+)\/(.*)$/.exec(p))) {
      const [, domain, rest] = m;
      validators().forEach((f) => out.add(f));
      if (project && INTEGRATION_AREAS.some((a) => p.startsWith(a))) {
        listTests(root, 'test/integration/queue').forEach((f) => out.add(f));
      }
      const skill = /^\.apm\/skills\/([^/]+)\//.exec(rest);
      const narrow = skill
        ? listTests(root, `test/packages/${domain}`).filter((f) =>
            path.posix.basename(f).startsWith(skill[1])
          )
        : [];
      (narrow.length ? narrow : listTests(root, `test/packages/${domain}`)).forEach((f) =>
        out.add(f)
      );
    } else if (p.startsWith('.github/')) {
      listTests(root, 'test/repo').forEach((f) => out.add(f));
      if (CALLER_WORKFLOWS.has(p)) out.add('test/packages/github/release-workflow.test.ts');
    } else {
      return ['ALL'];
    }
  }
  if (project) {
    const scripts = scriptsList(root);
    return [...out].filter((f) => projectOf(f, scripts) === project).sort();
  }
  return [...out].filter((f) => !f.endsWith('.perf.test.ts')).sort();
}

/** Resolves CLI arguments (paths, --staged, --range a..b, --base ref; --project is skipped) to changed paths. */
export function pathsFromArgs(args, cwd = REPO_ROOT) {
  const git = (...a) =>
    execFileSync('git', a, { cwd, encoding: 'utf8' }).split('\n').filter(Boolean);
  const paths = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--') continue;
    if (args[i] === '--staged') paths.push(...git('diff', '--cached', '--name-only'));
    else if (args[i] === '--range') paths.push(...git('diff', '--name-only', args[++i] ?? ''));
    else if (args[i] === '--base')
      paths.push(...git('diff', '--name-only', `${args[++i] ?? ''}...HEAD`));
    else if (args[i] === '--project') i++;
    else paths.push(args[i]);
  }
  return paths;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const pi = argv.indexOf('--project');
  const lines = relatedTests(pathsFromArgs(argv), { project: pi >= 0 ? argv[pi + 1] : undefined });
  if (lines.length) console.log(lines.join('\n'));
}
