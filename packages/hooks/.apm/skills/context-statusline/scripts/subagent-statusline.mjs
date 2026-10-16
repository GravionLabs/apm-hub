#!/usr/bin/env node
// Claude Code subagentStatusLine: one {"id","content"} JSON line per subagent task.
// Row: <agentType> <model> ctx:<pct>% (<k>k) · <label>; <50% green, <80% yellow, else red.
// Tokens only when contextWindowSize is missing. Invalid input: no output, exit 0.
import { readFileSync } from 'node:fs';

const E = '\x1b';
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v) => (typeof v === 'string' ? v : '');

function row(t) {
  if (!t || typeof t !== 'object' || t.id === undefined || t.id === null) return null;
  const agent = str(t.agentType) || str(t.name) || 'agent';
  const model = str(t.model).replace(/^claude-/, '').replace(/-\d{8}$/, '');
  const tokens = num(t.tokenCount);
  const size = num(t.contextWindowSize);
  const label = str(t.label) || str(t.description);
  const k = Math.floor((tokens + 500) / 1000);
  let ctx;
  if (size > 0) {
    const pct = Math.floor((tokens * 100) / size);
    const color = pct < 50 ? 32 : pct < 80 ? 33 : 31;
    ctx = ` ${E}[${color}mctx:${pct}% (${k}k)${E}[0m`;
  } else {
    ctx = ` ${k}k`;
  }
  const m = model ? ` ${E}[90m${model}${E}[0m` : '';
  return { id: t.id, content: `${E}[36m${agent}${E}[0m${m}${ctx} · ${label}` };
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const tasks = Array.isArray(input?.tasks) ? input.tasks : [];
  const lines = tasks.map(row).filter(Boolean).map((r) => JSON.stringify(r));
  if (lines.length) process.stdout.write(lines.join('\n') + '\n');
} catch { /* invalid input: no output */ }
