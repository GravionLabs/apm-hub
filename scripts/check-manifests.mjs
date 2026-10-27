#!/usr/bin/env node
/**
 * Verifies that each packages/<domain>/apm.yml `x-skills:` and `x-agents:` list
 * matches the artifacts on disk (.apm/skills/<name>/SKILL.md, .apm/agents/<name>.agent.md).
 *
 * Usage:
 *   node scripts/check-manifests.mjs         # check, exit 1 on drift
 *   node scripts/check-manifests.mjs --fix   # rewrite the lists in place
 */
import * as fs from 'fs';
import * as path from 'path';

const fix = process.argv.includes('--fix');
const packagesDir = 'packages';
let drift = false;

/** The artifact kinds a package manifest lists, with how to find them on disk. */
const KINDS = [
  {
    key: 'x-skills',
    dir: ['.apm', 'skills'],
    onDisk: (dir) =>
      fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'SKILL.md')))
        .map((d) => d.name),
  },
  {
    key: 'x-agents',
    dir: ['.apm', 'agents'],
    onDisk: (dir) =>
      fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isFile() && d.name.endsWith('.agent.md'))
        .map((d) => d.name.slice(0, -'.agent.md'.length)),
  },
];

/** Returns the `<key>:` list block of a manifest: its line range and the listed names. */
function readList(lines, key) {
  const start = lines.findIndex((l) => new RegExp(`^${key}:\\s*$`).test(l));
  const listed = [];
  let end = start;
  if (start !== -1) {
    for (end = start + 1; end < lines.length; end++) {
      const m = lines[end].match(/^\s+-\s+(.+)$/);
      if (!m) break;
      listed.push(m[1].trim());
    }
  }
  return { start, end, listed: listed.sort() };
}

for (const domain of fs.readdirSync(packagesDir).sort()) {
  const pkgDir = path.join(packagesDir, domain);
  const apmFile = path.join(pkgDir, 'apm.yml');
  if (!fs.existsSync(apmFile)) continue;

  for (const kind of KINDS) {
    const artifactDir = path.join(pkgDir, ...kind.dir);
    if (!fs.existsSync(artifactDir)) continue;
    const onDisk = kind.onDisk(artifactDir).sort();

    const lines = fs.readFileSync(apmFile, 'utf8').split('\n');
    const { start, end, listed } = readList(lines, kind.key);
    if (JSON.stringify(listed) === JSON.stringify(onDisk)) continue;

    const missing = onDisk.filter((s) => !listed.includes(s));
    const stale = listed.filter((s) => !onDisk.includes(s));
    if (fix) {
      const block = [`${kind.key}:`, ...onDisk.map((s) => `  - ${s}`)];
      const next =
        start === -1
          ? [...lines.slice(0, lines.length - (lines.at(-1) === '' ? 1 : 0)), ...block, '']
          : [...lines.slice(0, start), ...block, ...lines.slice(end)];
      fs.writeFileSync(apmFile, next.join('\n'));
      console.log(`fixed ${apmFile} ${kind.key} (+${missing.length} -${stale.length})`);
    } else {
      drift = true;
      console.error(`${apmFile}: ${kind.key} list drift`);
      if (missing.length) console.error(`  missing: ${missing.join(', ')}`);
      if (stale.length) console.error(`  stale:   ${stale.join(', ')}`);
    }
  }
}

if (drift) {
  console.error('\nRun: node scripts/check-manifests.mjs --fix');
  process.exit(1);
}
console.log(fix ? 'Manifests synced.' : 'Manifests in sync.');
