#!/usr/bin/env node
// Claude Code statusLine: user@host:dir, model, ctx:<pct>%, git branch, 5h/7d rate limits. Never fails (exit 0), no network.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { hostname, userInfo } from 'node:os';

const c = (code, s) => `\x1b[${code}m${s}\x1b[00m`;
const pct = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
const str = (v) => (typeof v === 'string' && v ? v : null);
const git = (dir, args) => {
  const r = spawnSync('git', ['-C', dir, '--no-optional-locks', ...args], { encoding: 'utf8', timeout: 1000, windowsHide: true });
  return r.status === 0 ? r.stdout.trim() : '';
};

function render(input) {
  const dir = str(input.workspace?.current_dir) ?? str(input.cwd) ?? process.cwd();
  let user = 'user';
  try { user = userInfo().username; } catch { /* keep default */ }
  const host = hostname().split('.')[0];
  let out = `${c('01;32', `${user}@${host}`)}:${c('01;34', dir)}`;

  const model = str(input.model?.display_name);
  if (model) out += ` ${c('36', model)}`;
  const ctx = pct(input.context_window?.used_percentage);
  if (ctx !== null) out += ` ${c('33', `ctx:${ctx}%`)}`;

  if (existsSync(dir)) {
    const branch = git(dir, ['symbolic-ref', '--short', '-q', 'HEAD']) || git(dir, ['rev-parse', '--short', 'HEAD']);
    if (branch) out += ` ${c('35', `(${branch})`)}`;
  }

  const five = pct(input.rate_limits?.five_hour?.used_percentage);
  const week = pct(input.rate_limits?.seven_day?.used_percentage);
  const rl = [five !== null && `5h:${five}%`, week !== null && `7d:${week}%`].filter(Boolean).join(' ');
  if (rl) out += ` ${c('90', rl)}`;
  return out;
}

try {
  let input = {};
  try {
    const parsed = JSON.parse(readFileSync(0, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) input = parsed;
  } catch { /* garbage or empty stdin: fall back to defaults */ }
  process.stdout.write(render(input));
} catch { /* never break the status line */ }
