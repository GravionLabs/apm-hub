import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const skillDir = path.resolve(__dirname, '../../../packages/delivery/.apm/skills/orchestrator');
const text = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');

describe('orchestrator SKILL.md', () => {
  it('is user-invoked only', () => {
    expect(text).toContain('disable-model-invocation: true');
    expect(text).toContain("opencode/autoinvoke: 'false'");
  });

  it('launches dromos plan, run and status as JSON', () => {
    for (const cmd of [
      'dromos run plan <nr> --format json',
      'dromos run pbi <nr> --format json',
      'dromos status <nr> --format json',
    ]) {
      expect(text).toContain(cmd);
    }
    expect(text).toContain('--harness');
  });

  it('asks planner questions on exit 2 and re-runs with --answer', () => {
    expect(text).toMatch(/`2` from `plan`/);
    expect(text).toContain('--answer <id>=<value>');
    expect(text).toContain('AskUserQuestion');
    expect(text).toContain('ask_user');
    expect(text).toContain('.dromos/state/<nr>/plan.json');
  });

  it('does not auto-assume answers and ships no agent file', () => {
    expect(text).toMatch(/Never pass `--assume-recommended`/);
    expect(fs.readdirSync(skillDir).filter((f) => f.endsWith('.agent.md'))).toEqual([]);
    expect(fs.existsSync(path.resolve(skillDir, '../../agents'))).toBe(false);
  });
});
