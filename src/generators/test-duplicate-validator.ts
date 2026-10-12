import * as fs from 'fs';
import * as path from 'path';
import { findSkillFiles, frontmatterLines } from './skill-size-validator';

export interface TestDuplicatePattern {
  name: string;
  regex: RegExp;
  /** Bare tool names may appear on a line that points to a `<lang>-test` skill or a `references/` file. */
  allowPointer?: boolean;
}

/**
 * Test runner commands, config, naming and mocking belong in `<lang>-test`, not in `<lang>-implementation`.
 * Generic words ("tests", "mocking") and the `<lang>-test` skill name are allowed.
 */
export const TEST_DUPLICATE_PATTERNS: TestDuplicatePattern[] = [
  { name: 'runner name', regex: /\b(vitest|jest|pytest|nunit|xunit)\b/i, allowPointer: true },
  { name: 'dotnet test', regex: /\bdotnet\s+test\b/i },
  { name: 'runner config', regex: /\b(vitest|jest|pytest|karma)\.config\b|\bpytest\.ini\b|\bconftest\.py\b/i },
  { name: 'test file naming', regex: /\.(test|spec)\.[cm]?[jt]sx?\b|\btest_\w*\.py\b|\w+Tests?\.cs\b/ },
  { name: 'mocking api', regex: /\bvi\.(fn|mock|spyOn)\b|\bjest\.(fn|mock|spyOn)\b|pytest-mock|\bmocker\b|\bNSubstitute\b|\bMoq\b/i },
  { name: 'assertion library', regex: /\bShouldly\b|\bFluentAssertions\b/i },
];

export interface TestDuplicateViolation {
  filePath: string;
  line: number;
  pattern: string;
  text: string;
}

const POINTER = /-test\b|\breferences\//;

/** All packages/<domain>/.apm/skills/<lang>-implementation/SKILL.md files. */
export function findImplementationSkillFiles(packagesBaseDir: string): string[] {
  return findSkillFiles(packagesBaseDir).filter((f) =>
    path.basename(path.dirname(f)).endsWith('-implementation'),
  );
}

/** Scans the body (frontmatter excluded) of each file for test runner commands, config, naming and mocking. */
export function checkTestDuplicates(skillFiles: string[]): TestDuplicateViolation[] {
  const violations: TestDuplicateViolation[] = [];
  for (const filePath of skillFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fmLen = frontmatterLines(content).length;
    const offset = fmLen > 0 ? fmLen + 2 : 0;
    content
      .split(/\r?\n/)
      .slice(offset)
      .forEach((text, i) => {
        for (const p of TEST_DUPLICATE_PATTERNS) {
          if (p.allowPointer && POINTER.test(text)) continue;
          if (p.regex.test(text)) violations.push({ filePath, line: offset + i + 1, pattern: p.name, text: text.trim() });
        }
      });
  }
  return violations;
}
