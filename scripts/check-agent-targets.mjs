#!/usr/bin/env node
/**
 * Verifies that .github/agents/*.agent.md and .opencode/agents/*.md are an
 * exact, up-to-date compilation of packages/<domain>/.apm/agents/*.agent.md
 * (see src/generators/agent-target-generator.ts). Requires `pnpm run build`
 * to have run first (reads from dist/).
 *
 * Usage:
 *   node scripts/check-agent-targets.mjs         # check, exit 1 on drift
 *   node scripts/check-agent-targets.mjs --fix   # regenerate in place
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const generatorPath = path.join(repoRoot, 'dist', 'generators', 'agent-target-generator.js');

if (!fs.existsSync(generatorPath)) {
  console.error(`error: ${generatorPath} not found — run "pnpm run build" first.`);
  process.exit(1);
}

const { generateAgentTargets } = await import(generatorPath);

const fix = process.argv.includes('--fix');

if (fix) {
  generateAgentTargets(path.join(repoRoot, 'packages'), repoRoot, path.join(repoRoot, 'config', 'agent-strip-fields.json'));
  console.log('Agent target files regenerated.');
  process.exit(0);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-targets-check-'));
try {
  generateAgentTargets(
    path.join(repoRoot, 'packages'),
    tmpDir,
    path.join(repoRoot, 'config', 'agent-strip-fields.json')
  );

  const dirs = [
    { rel: '.github/agents', label: '.github/agents' },
    { rel: '.opencode/agents', label: '.opencode/agents' },
    { rel: '.claude/agents', label: '.claude/agents' },
  ];

  let drift = false;
  const stale = [];
  const outOfDate = [];

  for (const { rel, label } of dirs) {
    const generatedDir = path.join(tmpDir, rel);
    const committedDir = path.join(repoRoot, rel);

    const generatedFiles = fs.existsSync(generatedDir)
      ? fs.readdirSync(generatedDir).filter((f) => fs.statSync(path.join(generatedDir, f)).isFile())
      : [];
    const committedFiles = fs.existsSync(committedDir)
      ? fs.readdirSync(committedDir).filter((f) => fs.statSync(path.join(committedDir, f)).isFile())
      : [];

    for (const f of generatedFiles) {
      const generated = fs.readFileSync(path.join(generatedDir, f), 'utf8');
      const committedPath = path.join(committedDir, f);
      if (!fs.existsSync(committedPath) || fs.readFileSync(committedPath, 'utf8') !== generated) {
        outOfDate.push(`${label}/${f}`);
      }
    }

    for (const f of committedFiles) {
      if (!generatedFiles.includes(f)) {
        stale.push(`${label}/${f}`);
      }
    }
  }

  if (outOfDate.length || stale.length) {
    drift = true;
    console.error('Agent target files are out of sync with packages/*/.apm/agents/ sources.');
    if (outOfDate.length) console.error(`  out of date: ${outOfDate.join(', ')}`);
    if (stale.length) console.error(`  stale (no matching source): ${stale.join(', ')}`);
    console.error('\nRun: node scripts/check-agent-targets.mjs --fix');
  } else {
    console.log('Agent target files in sync.');
  }

  process.exit(drift ? 1 : 0);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
