import * as fs from 'fs';
import * as path from 'path';
import { findSkillFiles, frontmatterLines } from './skill-size-validator';

export interface TestDuplicatePattern {
  name: string;
  regex: RegExp;
  /** Bare tool names may appear on a line that is a clear pointer (see `isPointerLine`). */
  allowPointer?: boolean;
}

/**
 * Test runner commands, config, naming and mocking belong in `<lang>-test`, not in `<lang>-implementation`.
 * Generic words ("tests", "mocking") and the `<lang>-test` skill name are allowed.
 *
 * Only the bare `runner name` pattern can be excused by a pointer. All other patterns are always flagged:
 * reword a legitimate mention to the generic term (e.g. "the test runner configured in `ts-test`")
 * or move the detail into the `<lang>-test` skill.
 */
export const TEST_DUPLICATE_PATTERNS: TestDuplicatePattern[] = [
  {
    name: 'runner name',
    regex: /\b(vitest|jest|pytest|nunit|xunit|mstest|mocha|jasmine|karma|playwright|cypress)\b/i,
    allowPointer: true,
  },
  { name: 'dotnet test', regex: /\bdotnet\s+test\b/i },
  { name: 'cargo test', regex: /\bcargo\s+(test|nextest)\b/i },
  { name: 'package test command', regex: /\b(npm|pnpm|yarn)\s+(run\s+)?test\b|\bng\s+test\b/i },
  {
    name: 'runner config',
    regex:
      /\b(vitest|jest|pytest|karma|playwright|cypress|mocha)\.config\b|\bpytest\.ini\b|\bconftest\.py\b/i,
  },
  {
    name: 'test file naming',
    regex: /\.(test|spec)\.[cm]?[jt]sx?\b|\btest_\w*\.py\b|\b\w+_test\.(py|go)\b|\w+Tests?\.cs\b/,
  },
  {
    name: 'mocking api',
    regex:
      /\bvi\.(fn|mock|spyOn)\b|\bjest\.(fn|mock|spyOn)\b|pytest-mock|\bmocker\b|\bmock\.patch\b|\bmonkeypatch\b|\bunittest\.mock\b|\bNSubstitute\b|\bMoq\b|\bFakeItEasy\b|\bAutoFixture\b/i,
  },
  { name: 'assertion library', regex: /\bShouldly\b|\bFluentAssertions\b|@testing-library/i },
  // Bare framework API name: a pointer line ("Load `ng-test` for TestBed setup") is fine, a how-to is not.
  { name: 'test api name', regex: /\bTestBed\b/, allowPointer: true },
];

export interface TestDuplicateViolation {
  filePath: string;
  line: number;
  pattern: string;
  text: string;
}

/** A pointer names a `<lang>-test` skill or a `references/<file>` path, in backticks. */
const POINTER = /`(ts|ng|py|dotnet|rust)-test`|`references\/[^`\s]+`/;
/** Command-like tokens: flags, package runners, `run`. A line with these is a command, not a pointer. */
const COMMAND_LIKE = /(^|\s)-{1,2}\w|\b(npx|pnpm|run)\b/i;

export function isPointerLine(text: string): boolean {
  return POINTER.test(text) && !COMMAND_LIKE.test(text);
}

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
          if (p.allowPointer && isPointerLine(text)) continue;
          if (p.regex.test(text))
            violations.push({ filePath, line: offset + i + 1, pattern: p.name, text: text.trim() });
        }
      });
  }
  return violations;
}
