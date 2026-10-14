import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadEvals, modelInvocableSkills, validateEvals, TriggerEval } from './skill-trigger-evals';

const repoRoot = path.resolve(__dirname, '../..');
const repoPackagesDir = path.join(repoRoot, 'packages');
const evalsPath = path.join(repoRoot, 'evals', 'skill-triggers.json');

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function makePackages(skills: Record<string, { pkg?: string; gated?: boolean }>): string {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'trigger-evals-'));
  tmpDirs.push(base);
  for (const [name, { pkg = 'shared', gated = false }] of Object.entries(skills)) {
    const dir = path.join(base, pkg, '.apm', 'skills', name);
    fs.mkdirSync(dir, { recursive: true });
    const gate = gated ? "disable-model-invocation: true\n" : '';
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: 'x'\n${gate}---\nbody\n`);
  }
  return base;
}

const entry = (skill: string, pos = [`do ${skill}`], neg = [`not ${skill}`]): TriggerEval => ({
  skill,
  shouldTrigger: pos,
  shouldNotTrigger: neg,
});

describe('skill trigger evals (repository)', () => {
  it('matches the model-invocable consumer skills on disk', () => {
    expect(validateEvals(loadEvals(evalsPath), repoPackagesDir)).toEqual([]);
  });

  it('derives the model-invocable skills from disk and excludes gated and apm-tooling skills', () => {
    const skills = modelInvocableSkills(repoPackagesDir);
    expect(skills).toContain('implementation');
    expect(skills).not.toContain('orch-pipeline');
    expect(skills).not.toContain('skill-write');
  });
});

describe('validateEvals', () => {
  it('accepts a complete set', () => {
    const base = makePackages({ a: {}, b: {} });
    expect(validateEvals([entry('a'), entry('b')], base)).toEqual([]);
  });

  it('reports a model-invocable skill without an entry', () => {
    const base = makePackages({ a: {}, b: {} });
    expect(validateEvals([entry('a')], base)).toEqual(['b: missing eval entry']);
  });

  it('does not require entries for gated or apm-tooling skills but rejects them if present', () => {
    const base = makePackages({ a: {}, g: { gated: true }, t: { pkg: 'apm-tooling' } });
    expect(validateEvals([entry('a')], base)).toEqual([]);
    expect(validateEvals([entry('a'), entry('g')], base)).toEqual([
      'g: not a model-invocable consumer skill (gated or unknown)',
    ]);
    expect(validateEvals([entry('a'), entry('t')], base)).toHaveLength(1);
  });

  it('rejects unknown skills', () => {
    const base = makePackages({ a: {} });
    expect(validateEvals([entry('a'), entry('zzz')], base)).toEqual([
      'zzz: not a model-invocable consumer skill (gated or unknown)',
    ]);
  });

  it('requires at least one positive and one negative prompt', () => {
    const base = makePackages({ a: {} });
    expect(validateEvals([entry('a', [], ['n'])], base)).toEqual(['a: needs at least one shouldTrigger prompt']);
    expect(validateEvals([entry('a', ['p'], [])], base)).toEqual(['a: needs at least one shouldNotTrigger prompt']);
  });

  it('rejects duplicate prompts within and across skills, case-insensitively', () => {
    const base = makePackages({ a: {}, b: {} });
    const problems = validateEvals([entry('a', ['same'], ['n1']), entry('b', ['p2'], ['SAME'])], base);
    expect(problems).toEqual(['b: duplicate prompt "SAME" (also in a)']);
  });

  it('rejects duplicate skill entries', () => {
    const base = makePackages({ a: {} });
    expect(validateEvals([entry('a'), entry('a', ['p2'], ['n2'])], base)).toEqual(['a: duplicate entry']);
  });
});

describe('loadEvals', () => {
  it('parses a JSON array', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trigger-evals-'));
    tmpDirs.push(dir);
    const file = path.join(dir, 'e.json');
    fs.writeFileSync(file, JSON.stringify([entry('a')]));
    expect(loadEvals(file)).toEqual([entry('a')]);
  });

  it('throws when the file is not an array', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trigger-evals-'));
    tmpDirs.push(dir);
    const file = path.join(dir, 'e.json');
    fs.writeFileSync(file, '{}');
    expect(() => loadEvals(file)).toThrow(/JSON array/);
  });

  it('throws when the file is missing', () => {
    expect(() => loadEvals('/nonexistent/evals.json')).toThrow();
  });
});
