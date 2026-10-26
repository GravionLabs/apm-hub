#!/usr/bin/env node
// Maps changed paths to the test files that cover them (Node >= 22, no dependencies).
//   node scripts/related-tests.mjs <path...>        explicit paths
//   node scripts/related-tests.mjs --staged         staged files (git diff --cached --name-only)
//   node scripts/related-tests.mjs --range a..b     files changed in a revision range
// `*.perf.test.ts` files (Vitest project `perf`, wall-clock bounds) are never listed; run `pnpm run test:perf`.
// Prints one test file per line (sorted, deduplicated), or the single word ALL when the
// change can affect anything (shared helpers, config, lockfile, unknown paths). Exit code 0.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
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

/**
 * @param {string[]} paths repo-relative changed paths
 * @param {{root?: string}} [options] repo root (defaults to this checkout)
 * @returns {string[]} sorted unique test files, or ['ALL']
 */
export function relatedTests(paths, { root = REPO_ROOT } = {}) {
  const out = new Set();
  const srcTests = () => listTests(root, 'src');
  const validators = () => listTests(root, 'src/generators').filter((f) => /validator[^/]*\.test\.ts$/.test(f));

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
      const skill = /^\.apm\/skills\/([^/]+)\//.exec(rest);
      const narrow = skill
        ? listTests(root, `test/packages/${domain}`).filter((f) => path.posix.basename(f).startsWith(skill[1]))
        : [];
      (narrow.length ? narrow : listTests(root, `test/packages/${domain}`)).forEach((f) => out.add(f));
    } else if (p.startsWith('.github/')) {
      listTests(root, 'test/repo').forEach((f) => out.add(f));
      if (CALLER_WORKFLOWS.has(p)) out.add('test/packages/github/release-workflow.test.ts');
    } else {
      return ['ALL'];
    }
  }
  return [...out].filter((f) => !f.endsWith('.perf.test.ts')).sort();
}

/** Resolves CLI arguments (paths, --staged, --range a..b) to changed paths. */
export function pathsFromArgs(args, cwd = REPO_ROOT) {
  const git = (...a) =>
    execFileSync('git', a, { cwd, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  const paths = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--') continue;
    if (args[i] === '--staged') paths.push(...git('diff', '--cached', '--name-only'));
    else if (args[i] === '--range') paths.push(...git('diff', '--name-only', args[++i] ?? ''));
    else paths.push(args[i]);
  }
  return paths;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lines = relatedTests(pathsFromArgs(process.argv.slice(2)));
  if (lines.length) console.log(lines.join('\n'));
}
