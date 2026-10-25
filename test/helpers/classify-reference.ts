import * as fs from 'fs';
import * as path from 'path';

const SKILL = path.resolve(__dirname, '../../packages/delivery/.apm/skills/review-fanout');

export const REFERENCE = fs.readFileSync(
  path.join(SKILL, 'references/mechanical-classifier.md'),
  'utf8'
);

// The always-full destination list lives in the reference; parse it so docs and tests cannot drift.
export const ALWAYS_FULL = (
  /Always-full rename destinations[^\n]*\n\n```text\n([\s\S]*?)\n```/.exec(REFERENCE)?.[1] ?? ''
)
  .split('\n')
  .filter(Boolean);
