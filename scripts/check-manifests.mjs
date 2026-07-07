#!/usr/bin/env node
/**
 * Verifies that each packages/<domain>/apm.yml `skills:` list matches the
 * skill directories on disk (.apm/skills/<name>/SKILL.md).
 *
 * Usage:
 *   node scripts/check-manifests.mjs         # check, exit 1 on drift
 *   node scripts/check-manifests.mjs --fix   # rewrite skills lists in place
 */
import * as fs from 'fs';
import * as path from 'path';

const fix = process.argv.includes('--fix');
const packagesDir = 'packages';
let drift = false;

for (const domain of fs.readdirSync(packagesDir).sort()) {
  const pkgDir = path.join(packagesDir, domain);
  const apmFile = path.join(pkgDir, 'apm.yml');
  const skillsDir = path.join(pkgDir, '.apm', 'skills');
  if (!fs.existsSync(apmFile) || !fs.existsSync(skillsDir)) continue;

  const onDisk = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(skillsDir, d.name, 'SKILL.md')))
    .map((d) => d.name)
    .sort();

  const content = fs.readFileSync(apmFile, 'utf8');
  const lines = content.split('\n');
  const start = lines.findIndex((l) => /^skills:\s*$/.test(l));
  const listed = [];
  let end = start;
  if (start !== -1) {
    for (end = start + 1; end < lines.length; end++) {
      const m = lines[end].match(/^\s+-\s+(.+)$/);
      if (!m) break;
      listed.push(m[1].trim());
    }
  }
  listed.sort();

  if (JSON.stringify(listed) === JSON.stringify(onDisk)) continue;

  const missing = onDisk.filter((s) => !listed.includes(s));
  const stale = listed.filter((s) => !onDisk.includes(s));
  if (fix) {
    const block = ['skills:', ...onDisk.map((s) => `  - ${s}`)];
    const next =
      start === -1
        ? [...lines.slice(0, lines.length - (lines.at(-1) === '' ? 1 : 0)), ...block, '']
        : [...lines.slice(0, start), ...block, ...lines.slice(end)];
    fs.writeFileSync(apmFile, next.join('\n'));
    console.log(`fixed ${apmFile} (+${missing.length} -${stale.length})`);
  } else {
    drift = true;
    console.error(`${apmFile}: skills list drift`);
    if (missing.length) console.error(`  missing: ${missing.join(', ')}`);
    if (stale.length) console.error(`  stale:   ${stale.join(', ')}`);
  }
}

if (drift) {
  console.error('\nRun: node scripts/check-manifests.mjs --fix');
  process.exit(1);
}
console.log(fix ? 'Manifests synced.' : 'Manifests in sync.');
