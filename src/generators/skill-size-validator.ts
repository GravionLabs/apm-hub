import * as fs from 'fs';
import * as path from 'path';

export const SKILL_MD_LINE_LIMIT = 100;
/** The description is sent with every request; ~40 tokens, hard limit 200 characters. */
export const SKILL_DESCRIPTION_CHAR_LIMIT = 200;
/** Sum of the descriptions of all consumer-visible model-invocable skills (~650 tokens at chars/4). */
export const SKILL_DESCRIPTION_TOTAL_CHAR_BUDGET = 2600;

export interface SizeViolation {
  filePath: string;
  lines: number;
  limit: number;
}

export interface DescriptionViolation {
  filePath: string;
  chars: number;
  limit: number;
}

function countLines(content: string): number {
  return content.split('\n').length;
}

/**
 * Collects all SKILL.md files under a packages base directory
 * (packages/<domain>/.apm/skills/<name>/SKILL.md)
 */
export function findSkillFiles(packagesBaseDir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(packagesBaseDir)) return results;

  for (const domain of fs.readdirSync(packagesBaseDir)) {
    const skillsDir = path.join(packagesBaseDir, domain, '.apm', 'skills');
    if (!fs.existsSync(skillsDir)) continue;
    for (const skillName of fs.readdirSync(skillsDir)) {
      const skillMd = path.join(skillsDir, skillName, 'SKILL.md');
      if (fs.existsSync(skillMd)) results.push(skillMd);
    }
  }
  return results;
}

/**
 * Collects all SKILL.md files under a .github/skills directory
 * (.github/skills/<name>/SKILL.md)
 */
export function findGithubSkillFiles(githubSkillsDir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(githubSkillsDir)) return results;

  for (const skillName of fs.readdirSync(githubSkillsDir)) {
    const skillMd = path.join(githubSkillsDir, skillName, 'SKILL.md');
    if (fs.existsSync(skillMd)) results.push(skillMd);
  }
  return results;
}

/** Frontmatter lines (between the first two `---` fences, CRLF-tolerant); empty when there is none. */
export function frontmatterLines(content: string): string[] {
  const lines = content.split(/\r?\n/);
  if (lines[0].trimEnd() !== '---') return [];
  const end = lines.findIndex((l, i) => i > 0 && l.trimEnd() === '---');
  return end < 0 ? [] : lines.slice(1, end);
}

/**
 * Extracts the frontmatter `description` as one string: a quoted or plain scalar,
 * or a folded/literal block (`>` / `|`) whose indented lines are joined with spaces.
 */
export function extractDescription(content: string): string {
  const fm = frontmatterLines(content);
  const start = fm.findIndex((l) => l.startsWith('description:'));
  if (start < 0) return '';
  const parts = [fm[start].slice('description:'.length).trim().replace(/^[>|]-?$/, '')];
  for (let i = start + 1; i < fm.length && !/^[a-z-]+:/.test(fm[i]); i++) parts.push(fm[i].trim());
  return parts
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^'(.*)'$/s, (_, s) => s.replace(/''/g, "'"))
    .replace(/^"(.*)"$/s, '$1');
}

/** Checks all SKILL.md files and returns violations over the description character limit */
export function checkDescriptionLengths(skillFiles: string[]): DescriptionViolation[] {
  return skillFiles
    .map((filePath) => {
      const chars = extractDescription(fs.readFileSync(filePath, 'utf8')).length;
      return { filePath, chars, limit: SKILL_DESCRIPTION_CHAR_LIMIT };
    })
    .filter((v) => v.chars > v.limit);
}

/** Checks all SKILL.md files and returns violations over the line limit */
export function checkSkillSizes(skillFiles: string[]): SizeViolation[] {
  return skillFiles
    .map((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = countLines(content);
      return { filePath, lines, limit: SKILL_MD_LINE_LIMIT };
    })
    .filter((v) => v.lines > v.limit);
}

export interface DescriptionBudget {
  total: number;
  budget: number;
  skills: { filePath: string; chars: number }[];
}

/** True when the frontmatter gates the skill with `disable-model-invocation: true` (also quoted). */
export function isModelGated(content: string): boolean {
  return frontmatterLines(content).some((l) => /^disable-model-invocation:\s*(['"]?)true\1\s*$/.test(l));
}

export interface BudgetViolation {
  total: number;
  budget: number;
}

/** Sums the description lengths of skills without `disable-model-invocation: true` */
export function checkDescriptionBudget(skillFiles: string[]): DescriptionBudget {
  const skills = skillFiles
    .map((filePath) => ({ filePath, content: fs.readFileSync(filePath, 'utf8') }))
    .filter(({ content }) => !isModelGated(content))
    .map(({ filePath, content }) => ({ filePath, chars: extractDescription(content).length }));
  const total = skills.reduce((n, s) => n + s.chars, 0);
  return { total, budget: SKILL_DESCRIPTION_TOTAL_CHAR_BUDGET, skills };
}

/** Returns the violation when the budget is exceeded, otherwise null. */
export function findBudgetViolation(r: DescriptionBudget): BudgetViolation | null {
  return r.total > r.budget ? { total: r.total, budget: r.budget } : null;
}
