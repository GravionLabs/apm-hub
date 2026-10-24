import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  findSkillFiles,
  findGithubSkillFiles,
  checkSkillSizes,
  checkDescriptionLengths,
  extractDescription,
  checkDescriptionBudget,
  findBudgetViolation,
  SKILL_DESCRIPTION_TOTAL_CHAR_BUDGET,
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
    const content =
      Array(SKILL_MD_LINE_LIMIT + 1)
        .fill('line')
        .join('\n') + '\nextra';
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
    fs.writeFileSync(
      big,
      Array(SKILL_MD_LINE_LIMIT + 2)
        .fill('line')
        .join('\n')
    );
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
    fs.writeFileSync(
      ok,
      `---\nname: ok\ndescription: ${'a'.repeat(SKILL_DESCRIPTION_CHAR_LIMIT)}\n---\n`
    );
    fs.writeFileSync(
      long,
      `---\nname: long\ndescription: ${'a'.repeat(SKILL_DESCRIPTION_CHAR_LIMIT + 1)}\n---\n`
    );
    const violations = checkDescriptionLengths([ok, long]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toEqual({
      filePath: long,
      chars: SKILL_DESCRIPTION_CHAR_LIMIT + 1,
      limit: SKILL_DESCRIPTION_CHAR_LIMIT,
    });
  });
});

describe('checkDescriptionBudget', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-budget-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const write = (name: string, chars: number, extra = '') => {
    const file = path.join(tmpDir, `${name}-SKILL.md`);
    fs.writeFileSync(file, `---\nname: ${name}\ndescription: ${'a'.repeat(chars)}\n${extra}---\n`);
    return file;
  };

  it('stays within the budget at exactly the limit', () => {
    const files = [write('a', SKILL_DESCRIPTION_TOTAL_CHAR_BUDGET - 100), write('b', 100)];
    const r = checkDescriptionBudget(files);
    expect(r.total).toBe(SKILL_DESCRIPTION_TOTAL_CHAR_BUDGET);
    expect(r.total).toBeLessThanOrEqual(r.budget);
  });

  it('exceeds the budget when the sum is over the limit', () => {
    const files = [write('a', SKILL_DESCRIPTION_TOTAL_CHAR_BUDGET - 100), write('b', 101)];
    const r = checkDescriptionBudget(files);
    expect(r.total).toBe(SKILL_DESCRIPTION_TOTAL_CHAR_BUDGET + 1);
    expect(r.total).toBeGreaterThan(r.budget);
  });

  it('ignores skills with disable-model-invocation: true', () => {
    const files = [write('a', 50), write('b', 5000, 'disable-model-invocation: true\n')];
    expect(checkDescriptionBudget(files).total).toBe(50);
  });

  it('returns zero for no skills', () => {
    expect(checkDescriptionBudget([]).total).toBe(0);
  });

  const raw = (name: string, content: string) => {
    const file = path.join(tmpDir, `${name}-SKILL.md`);
    fs.writeFileSync(file, content);
    return file;
  };

  it('counts single-quoted, double-quoted and folded descriptions by their value', () => {
    const files = [
      raw('s', "---\nname: s\ndescription: 'it''s ok'\n---\n"),
      raw('d', '---\nname: d\ndescription: "abc"\n---\n'),
      raw('f', '---\nname: f\ndescription: >\n  one\n  two\n---\n'),
    ];
    expect(checkDescriptionBudget(files).skills.map((s) => s.chars)).toEqual([7, 3, 7]);
  });

  it('handles CRLF line endings', () => {
    const files = [
      raw('c', '---\r\nname: c\r\ndescription: hello\r\n---\r\n'),
      raw(
        'g',
        '---\r\nname: g\r\ndescription: hidden\r\ndisable-model-invocation: true\r\n---\r\n'
      ),
    ];
    const r = checkDescriptionBudget(files);
    expect(r.skills.map((s) => s.chars)).toEqual([5]);
  });

  it('gates quoted true and tolerates trailing spaces', () => {
    const files = [
      raw('q1', "---\nname: a\ndescription: xxxx\ndisable-model-invocation: 'true'\n---\n"),
      raw('q2', '---\nname: b\ndescription: xxxx\ndisable-model-invocation: "true"\n---\n'),
      raw('q3', '---\nname: c\ndescription: xxxx\ndisable-model-invocation: true   \n---\n'),
    ];
    expect(checkDescriptionBudget(files).total).toBe(0);
  });

  it('does not gate on disable-model-invocation: true in the body', () => {
    const f = raw('b', '---\nname: b\ndescription: xxxx\n---\n\ndisable-model-invocation: true\n');
    expect(checkDescriptionBudget([f]).total).toBe(4);
  });

  it('does not gate on disable-model-invocation: false', () => {
    const f = raw('n', '---\nname: n\ndescription: xxxx\ndisable-model-invocation: false\n---\n');
    expect(checkDescriptionBudget([f]).total).toBe(4);
  });

  it('reports a violation for an over-budget fixture and none within budget', () => {
    const over = checkDescriptionBudget([
      write('a', SKILL_DESCRIPTION_TOTAL_CHAR_BUDGET),
      write('b', 1),
    ]);
    expect(findBudgetViolation(over)).toEqual({
      total: SKILL_DESCRIPTION_TOTAL_CHAR_BUDGET + 1,
      budget: SKILL_DESCRIPTION_TOTAL_CHAR_BUDGET,
    });
    expect(findBudgetViolation(checkDescriptionBudget([write('c', 10)]))).toBeNull();
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

  it('model-invocable descriptions of the consumer-visible packages stay within the total character budget', () => {
    // Excluded from the budget: .github/skills and packages/apm-tooling are contributor tooling,
    // never loaded in consumer projects (apm-tooling is not part of `all`); they keep the per-skill limit.
    const files = findSkillFiles(repoPackagesDir).filter(
      (f) => !f.startsWith(path.join(repoPackagesDir, 'apm-tooling') + path.sep)
    );
    const r = checkDescriptionBudget(files);
    const list = r.skills
      .sort((a, b) => b.chars - a.chars)
      .map((s) => `${s.chars} ${s.filePath}`)
      .join('\n');
    const hint =
      'Budget hit: shorten a description, gate the skill with disable-model-invocation: true, or raise SKILL_DESCRIPTION_TOTAL_CHAR_BUDGET with a justification.';
    expect(
      findBudgetViolation(r),
      `total ${r.total}, budget ${r.budget}\n${hint}\n${list}`
    ).toBeNull();
  });
});
