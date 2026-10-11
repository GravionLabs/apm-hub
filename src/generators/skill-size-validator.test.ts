import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  findSkillFiles,
  findGithubSkillFiles,
  checkSkillSizes,
  checkDescriptionLengths,
  extractDescription,
  SKILL_MD_LINE_LIMIT,
  SKILL_DESCRIPTION_CHAR_LIMIT,
} from './skill-size-validator';

describe('findSkillFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-size-find-'));

    const tsSkillsDir = path.join(tmpDir, 'ts', '.apm', 'skills');
    fs.mkdirSync(path.join(tsSkillsDir, 'ts-strict'), { recursive: true });
    fs.writeFileSync(path.join(tsSkillsDir, 'ts-strict', 'SKILL.md'), '# ts-strict\n');

    const pySkillsDir = path.join(tmpDir, 'py', '.apm', 'skills');
    fs.mkdirSync(path.join(pySkillsDir, 'py-test'), { recursive: true });
    fs.writeFileSync(path.join(pySkillsDir, 'py-test', 'SKILL.md'), '# py-test\n');

    // A skill directory without SKILL.md must be ignored
    fs.mkdirSync(path.join(pySkillsDir, 'empty'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return all SKILL.md paths across domains', () => {
    const files = findSkillFiles(tmpDir);
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith(path.join('ts-strict', 'SKILL.md')))).toBe(true);
    expect(files.some((f) => f.endsWith(path.join('py-test', 'SKILL.md')))).toBe(true);
  });

  it('should return empty array when base dir does not exist', () => {
    expect(findSkillFiles(path.join(tmpDir, 'nonexistent'))).toEqual([]);
  });

  it('should return empty array when no skills subdirs exist', () => {
    const emptyBase = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-size-empty-'));
    try {
      fs.mkdirSync(path.join(emptyBase, 'domain', '.apm'), { recursive: true });
      expect(findSkillFiles(emptyBase)).toEqual([]);
    } finally {
      fs.rmSync(emptyBase, { recursive: true, force: true });
    }
  });
});

describe('findGithubSkillFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-size-gh-'));
    fs.mkdirSync(path.join(tmpDir, 'check-prerequisites'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'check-prerequisites', 'SKILL.md'), '# check\n');
    fs.mkdirSync(path.join(tmpDir, 'no-skill-here'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return all SKILL.md paths in the github skills dir', () => {
    const files = findGithubSkillFiles(tmpDir);
    expect(files).toHaveLength(1);
    expect(files[0].endsWith(path.join('check-prerequisites', 'SKILL.md'))).toBe(true);
  });

  it('should return empty array when directory does not exist', () => {
    expect(findGithubSkillFiles(path.join(tmpDir, 'nonexistent'))).toEqual([]);
  });
});

describe('checkSkillSizes', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-size-check-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return no violations for a file at exactly the line limit', () => {
    const file = path.join(tmpDir, 'SKILL.md');
    const content = Array(SKILL_MD_LINE_LIMIT).join('line\n') + 'line';
    fs.writeFileSync(file, content);
    expect(checkSkillSizes([file])).toEqual([]);
  });

  it('should return a violation for a file exceeding the line limit', () => {
    const file = path.join(tmpDir, 'SKILL.md');
    const content = Array(SKILL_MD_LINE_LIMIT + 1).fill('line').join('\n') + '\nextra';
    fs.writeFileSync(file, content);
    const violations = checkSkillSizes([file]);
    expect(violations).toHaveLength(1);
    expect(violations[0].filePath).toBe(file);
    expect(violations[0].limit).toBe(SKILL_MD_LINE_LIMIT);
    expect(violations[0].lines).toBeGreaterThan(SKILL_MD_LINE_LIMIT);
  });

  it('should return violations only for files that exceed the limit', () => {
    const small = path.join(tmpDir, 'small-SKILL.md');
    const big = path.join(tmpDir, 'big-SKILL.md');
    fs.writeFileSync(small, 'line\n');
    fs.writeFileSync(big, Array(SKILL_MD_LINE_LIMIT + 2).fill('line').join('\n'));
    const violations = checkSkillSizes([small, big]);
    expect(violations).toHaveLength(1);
    expect(violations[0].filePath).toBe(big);
  });

  it('should return empty array for empty input', () => {
    expect(checkSkillSizes([])).toEqual([]);
  });
});

describe('extractDescription', () => {
  it('reads a single-quoted scalar and unescapes doubled quotes', () => {
    expect(extractDescription("---\nname: x\ndescription: 'Review a PR''s diff.'\n---\n")).toBe(
      "Review a PR's diff."
    );
  });

  it('joins a folded block into one line', () => {
    const fm = '---\nname: x\ndescription: >\n  Does X.\n  Use when Y.\nlicense: MIT\n---\n';
    expect(extractDescription(fm)).toBe('Does X. Use when Y.');
  });

  it('returns an empty string without frontmatter or description', () => {
    expect(extractDescription('# title\n')).toBe('');
    expect(extractDescription('---\nname: x\n---\n')).toBe('');
  });
});

describe('checkDescriptionLengths', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-desc-check-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('accepts a description at the limit and flags one above it', () => {
    const ok = path.join(tmpDir, 'ok-SKILL.md');
    const long = path.join(tmpDir, 'long-SKILL.md');
    fs.writeFileSync(ok, `---\nname: ok\ndescription: ${'a'.repeat(SKILL_DESCRIPTION_CHAR_LIMIT)}\n---\n`);
    fs.writeFileSync(long, `---\nname: long\ndescription: ${'a'.repeat(SKILL_DESCRIPTION_CHAR_LIMIT + 1)}\n---\n`);
    const violations = checkDescriptionLengths([ok, long]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toEqual({ filePath: long, chars: SKILL_DESCRIPTION_CHAR_LIMIT + 1, limit: SKILL_DESCRIPTION_CHAR_LIMIT });
  });
});

describe('live repo size check', () => {
  const repoPackagesDir = path.resolve(__dirname, '../../packages');
  const repoGithubSkillsDir = path.resolve(__dirname, '../../.github/skills');
  const skillFiles = () => [
    ...findSkillFiles(repoPackagesDir),
    ...findGithubSkillFiles(repoGithubSkillsDir),
  ];

  it('no SKILL.md in the repo exceeds the line limit', () => {
    const violations = checkSkillSizes(skillFiles());
    const message = violations
      .map((v) => `${v.filePath} (${v.lines} lines, limit ${v.limit})`)
      .join('\n');
    expect(violations, message).toEqual([]);
  });

  it('no SKILL.md description in the repo exceeds the character limit', () => {
    const violations = checkDescriptionLengths(skillFiles());
    const message = violations
      .map((v) => `${v.filePath} (${v.chars} chars, limit ${v.limit})`)
      .join('\n');
    expect(violations, message).toEqual([]);
  });
});
