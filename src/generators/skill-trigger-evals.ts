import * as fs from 'fs';
import * as path from 'path';
import { findSkillFiles, isModelGated } from './skill-size-validator';

export interface TriggerEval {
  skill: string;
  shouldTrigger: string[];
  shouldNotTrigger: string[];
}

/** Reads and parses the eval file; throws when it is not a JSON array. */
export function loadEvals(evalsPath: string): TriggerEval[] {
  const data: unknown = JSON.parse(fs.readFileSync(evalsPath, 'utf8'));
  if (!Array.isArray(data)) throw new Error(`${evalsPath}: expected a JSON array`);
  return data as TriggerEval[];
}

/** Names of model-invocable consumer skills (apm-tooling excluded), derived from disk. */
export function modelInvocableSkills(packagesBaseDir: string): string[] {
  const toolingDir = path.join(packagesBaseDir, 'apm-tooling') + path.sep;
  return findSkillFiles(packagesBaseDir)
    .filter((f) => !f.startsWith(toolingDir))
    .filter((f) => !isModelGated(fs.readFileSync(f, 'utf8')))
    .map((f) => path.basename(path.dirname(f)))
    .sort();
}

/** Returns human-readable problems; an empty list means the evals match the skills on disk. */
export function validateEvals(evals: TriggerEval[], packagesBaseDir: string): string[] {
  const problems: string[] = [];
  const expected = new Set(modelInvocableSkills(packagesBaseDir));
  const seenSkills = new Set<string>();
  const seenPrompts = new Map<string, string>();

  for (const e of evals) {
    if (seenSkills.has(e.skill)) problems.push(`${e.skill}: duplicate entry`);
    seenSkills.add(e.skill);
    if (!expected.has(e.skill))
      problems.push(`${e.skill}: not a model-invocable consumer skill (gated or unknown)`);
    if (!Array.isArray(e.shouldTrigger) || !e.shouldTrigger.length)
      problems.push(`${e.skill}: needs at least one shouldTrigger prompt`);
    if (!Array.isArray(e.shouldNotTrigger) || !e.shouldNotTrigger.length)
      problems.push(`${e.skill}: needs at least one shouldNotTrigger prompt`);
    const prompts = [e.shouldTrigger, e.shouldNotTrigger];
    if (prompts.some((l) => l !== undefined && !Array.isArray(l))) {
      problems.push(`${e.skill}: shouldTrigger and shouldNotTrigger must be arrays`);
      continue;
    }
    for (const p of [...(e.shouldTrigger ?? []), ...(e.shouldNotTrigger ?? [])]) {
      if (typeof p !== 'string' || !p.trim()) {
        problems.push(`${e.skill}: prompts must be non-empty strings`);
        continue;
      }
      if (p.trim().startsWith('-'))
        problems.push(`${e.skill}: prompt starts with "-" (read as a CLI flag): "${p}"`);
      const key = p.trim().toLowerCase();
      const prev = seenPrompts.get(key);
      if (prev !== undefined)
        problems.push(`${e.skill}: duplicate prompt "${p}" (also in ${prev})`);
      else seenPrompts.set(key, e.skill);
    }
  }
  for (const s of expected) if (!seenSkills.has(s)) problems.push(`${s}: missing eval entry`);
  return problems;
}
