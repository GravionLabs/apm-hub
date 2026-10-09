import * as fs from 'fs';
import * as path from 'path';

export const SKILL_MD_LINE_LIMIT = 100;

export interface SizeViolation {
  filePath: string;
  lines: number;
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
