import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  findSkillFiles,
  findGithubSkillFiles,
  findAgentFiles,
  findGithubAgentFiles,
  checkSkillSizes,
  checkAgentSizes,
  SKILL_MD_LINE_LIMIT,
  AGENT_MD_LINE_LIMIT,
} from './skill-size-validator';

// ---------------------------------------------------------------------------
// findSkillFiles
// ---------------------------------------------------------------------------

describe('findSkillFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-size-find-'));

    // packages/typescript/.apm/skills/ts-strict/SKILL.md
    const tsSkillsDir = path.join(tmpDir, 'typescript', '.apm', 'skills');
    fs.mkdirSync(path.join(tsSkillsDir, 'ts-strict'), { recursive: true });
    fs.writeFileSync(path.join(tsSkillsDir, 'ts-strict', 'SKILL.md'), '# ts-strict\n');

    // packages/go/.apm/skills/go-errors/SKILL.md
    const goSkillsDir = path.join(tmpDir, 'go', '.apm', 'skills');
    fs.mkdirSync(path.join(goSkillsDir, 'go-errors'), { recursive: true });
    fs.writeFileSync(path.join(goSkillsDir, 'go-errors', 'SKILL.md'), '# go-errors\n');

    // packages/go/.apm/agents — should not be picked up by findSkillFiles
    const goAgentsDir = path.join(tmpDir, 'go', '.apm', 'agents');
    fs.mkdirSync(goAgentsDir, { recursive: true });
    fs.writeFileSync(path.join(goAgentsDir, 'go-expert.agent.md'), '# agent\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return all SKILL.md paths across domains', () => {
    const files = findSkillFiles(tmpDir);
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith(path.join('ts-strict', 'SKILL.md')))).toBe(true);
    expect(files.some((f) => f.endsWith(path.join('go-errors', 'SKILL.md')))).toBe(true);
  });

  it('should not include agent files', () => {
    const files = findSkillFiles(tmpDir);
    expect(files.every((f) => f.endsWith('SKILL.md'))).toBe(true);
  });

  it('should return empty array when base dir does not exist', () => {
    expect(findSkillFiles(path.join(tmpDir, 'nonexistent'))).toEqual([]);
  });

  it('should return empty array when no skills subdirs exist', () => {
    const emptyBase = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-size-empty-'));
    try {
      fs.mkdirSync(path.join(emptyBase, 'domain', '.apm', 'agents'), { recursive: true });
      expect(findSkillFiles(emptyBase)).toEqual([]);
    } finally {
      fs.rmSync(emptyBase, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// findGithubSkillFiles
// ---------------------------------------------------------------------------

describe('findGithubSkillFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-size-gh-'));

    // .github/skills/skill-create/SKILL.md
    fs.mkdirSync(path.join(tmpDir, 'skill-create'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'skill-create', 'SKILL.md'), '# skill-create\n');

    // .github/skills/skill-audit/SKILL.md
    fs.mkdirSync(path.join(tmpDir, 'skill-audit'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'skill-audit', 'SKILL.md'), '# skill-audit\n');

    // A directory that has no SKILL.md — should be ignored
    fs.mkdirSync(path.join(tmpDir, 'no-skill-here'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return all SKILL.md paths in the github skills dir', () => {
    const files = findGithubSkillFiles(tmpDir);
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith(path.join('skill-create', 'SKILL.md')))).toBe(true);
    expect(files.some((f) => f.endsWith(path.join('skill-audit', 'SKILL.md')))).toBe(true);
  });

  it('should not include directories without SKILL.md', () => {
    const files = findGithubSkillFiles(tmpDir);
    expect(files.every((f) => f.endsWith('SKILL.md'))).toBe(true);
  });

  it('should return empty array when directory does not exist', () => {
    expect(findGithubSkillFiles(path.join(tmpDir, 'nonexistent'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// findAgentFiles
// ---------------------------------------------------------------------------

describe('findAgentFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-size-find-'));

    // packages/dotnet/.apm/agents/dotnet-expert.agent.md
    const dotnetAgentsDir = path.join(tmpDir, 'dotnet', '.apm', 'agents');
    fs.mkdirSync(dotnetAgentsDir, { recursive: true });
    fs.writeFileSync(path.join(dotnetAgentsDir, 'dotnet-expert.agent.md'), '# dotnet-expert\n');
    fs.writeFileSync(path.join(dotnetAgentsDir, 'dotnet-upgrade.agent.md'), '# dotnet-upgrade\n');
    // Non-agent file in agents dir — should be ignored
    fs.writeFileSync(path.join(dotnetAgentsDir, 'README.md'), '# readme\n');

    // packages/python/.apm/agents/python-expert.agent.md
    const pyAgentsDir = path.join(tmpDir, 'python', '.apm', 'agents');
    fs.mkdirSync(pyAgentsDir, { recursive: true });
    fs.writeFileSync(path.join(pyAgentsDir, 'python-expert.agent.md'), '# python-expert\n');

    // packages/dotnet/.apm/skills — should not be picked up by findAgentFiles
    const dotnetSkillsDir = path.join(tmpDir, 'dotnet', '.apm', 'skills', 'dotnet-async');
    fs.mkdirSync(dotnetSkillsDir, { recursive: true });
    fs.writeFileSync(path.join(dotnetSkillsDir, 'SKILL.md'), '# skill\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return all .agent.md paths across domains', () => {
    const files = findAgentFiles(tmpDir);
    expect(files).toHaveLength(3);
    expect(files.some((f) => f.endsWith('dotnet-expert.agent.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('dotnet-upgrade.agent.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('python-expert.agent.md'))).toBe(true);
  });

  it('should not include non-.agent.md files', () => {
    const files = findAgentFiles(tmpDir);
    expect(files.every((f) => f.endsWith('.agent.md'))).toBe(true);
  });

  it('should not include SKILL.md files', () => {
    const files = findAgentFiles(tmpDir);
    expect(files.some((f) => f.endsWith('SKILL.md'))).toBe(false);
  });

  it('should return empty array when base dir does not exist', () => {
    expect(findAgentFiles(path.join(tmpDir, 'nonexistent'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// findGithubAgentFiles
// ---------------------------------------------------------------------------

describe('findGithubAgentFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-size-gh-'));

    fs.writeFileSync(path.join(tmpDir, 'github-pull-request.agent.md'), '# pr agent\n');
    fs.writeFileSync(path.join(tmpDir, 'github-issue.agent.md'), '# issue agent\n');
    // Non-agent file — should be ignored
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# readme\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return all .agent.md files in the github agents dir', () => {
    const files = findGithubAgentFiles(tmpDir);
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith('github-pull-request.agent.md'))).toBe(true);
    expect(files.some((f) => f.endsWith('github-issue.agent.md'))).toBe(true);
  });

  it('should not include non-.agent.md files', () => {
    const files = findGithubAgentFiles(tmpDir);
    expect(files.every((f) => f.endsWith('.agent.md'))).toBe(true);
  });

  it('should return empty array when directory does not exist', () => {
    expect(findGithubAgentFiles(path.join(tmpDir, 'nonexistent'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// checkSkillSizes
// ---------------------------------------------------------------------------

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
    // SKILL_MD_LINE_LIMIT lines means split('\n').length === SKILL_MD_LINE_LIMIT
    // content.split('\n').length === number_of_newlines + 1
    // so SKILL_MD_LINE_LIMIT lines of text = SKILL_MD_LINE_LIMIT - 1 newlines at the end
    const content = Array(SKILL_MD_LINE_LIMIT).join('line\n') + 'line';
    fs.writeFileSync(file, content);
    expect(checkSkillSizes([file])).toEqual([]);
  });

  it('should return no violations for a file under the line limit', () => {
    const file = path.join(tmpDir, 'SKILL.md');
    fs.writeFileSync(file, 'short content\n');
    expect(checkSkillSizes([file])).toEqual([]);
  });

  it('should return a violation for a file exceeding the line limit', () => {
    const file = path.join(tmpDir, 'SKILL.md');
    // SKILL_MD_LINE_LIMIT + 1 lines → split('\n').length === SKILL_MD_LINE_LIMIT + 1
    const content = Array(SKILL_MD_LINE_LIMIT + 1).fill('line').join('\n') + '\nextra';
    fs.writeFileSync(file, content);
    const violations = checkSkillSizes([file]);
    expect(violations).toHaveLength(1);
    expect(violations[0].filePath).toBe(file);
    expect(violations[0].type).toBe('skill');
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

// ---------------------------------------------------------------------------
// checkAgentSizes
// ---------------------------------------------------------------------------

describe('checkAgentSizes', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-size-check-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return no violations for a file at exactly the line limit', () => {
    const file = path.join(tmpDir, 'test.agent.md');
    const content = Array(AGENT_MD_LINE_LIMIT).join('line\n') + 'line';
    fs.writeFileSync(file, content);
    expect(checkAgentSizes([file])).toEqual([]);
  });

  it('should return no violations for a file under the line limit', () => {
    const file = path.join(tmpDir, 'test.agent.md');
    fs.writeFileSync(file, 'short content\n');
    expect(checkAgentSizes([file])).toEqual([]);
  });

  it('should return a violation for a file exceeding the line limit', () => {
    const file = path.join(tmpDir, 'test.agent.md');
    const content = Array(AGENT_MD_LINE_LIMIT + 1).fill('line').join('\n') + '\nextra';
    fs.writeFileSync(file, content);
    const violations = checkAgentSizes([file]);
    expect(violations).toHaveLength(1);
    expect(violations[0].filePath).toBe(file);
    expect(violations[0].type).toBe('agent');
    expect(violations[0].limit).toBe(AGENT_MD_LINE_LIMIT);
    expect(violations[0].lines).toBeGreaterThan(AGENT_MD_LINE_LIMIT);
  });

  it('should return violations only for files that exceed the limit', () => {
    const small = path.join(tmpDir, 'small.agent.md');
    const big = path.join(tmpDir, 'big.agent.md');
    fs.writeFileSync(small, 'line\n');
    fs.writeFileSync(big, Array(AGENT_MD_LINE_LIMIT + 2).fill('line').join('\n'));
    const violations = checkAgentSizes([small, big]);
    expect(violations).toHaveLength(1);
    expect(violations[0].filePath).toBe(big);
  });

  it('should return empty array for empty input', () => {
    expect(checkAgentSizes([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Live test — checks actual repo files without failing CI
// ---------------------------------------------------------------------------

describe('live repo size check (advisory only)', () => {
  const repoPackagesDir = path.resolve(__dirname, '../../packages');
  const repoGithubSkillsDir = path.resolve(__dirname, '../../.github/skills');
  const repoGithubAgentsDir = path.resolve(__dirname, '../../.github/agents');

  it('should find skill files in the repo packages directory', () => {
    const files = findSkillFiles(repoPackagesDir);
    // We just assert it runs without throwing; the count may be 0 in some envs
    expect(Array.isArray(files)).toBe(true);
  });

  it('should find .github/skills files in the repo', () => {
    const files = findGithubSkillFiles(repoGithubSkillsDir);
    expect(Array.isArray(files)).toBe(true);
  });

  it('should find .github/agents files in the repo', () => {
    const files = findGithubAgentFiles(repoGithubAgentsDir);
    expect(Array.isArray(files)).toBe(true);
  });

  it('should warn (not fail) when any repo skill or agent files exceed size limits', () => {
    const skillFiles = [
      ...findSkillFiles(repoPackagesDir),
      ...findGithubSkillFiles(repoGithubSkillsDir),
    ];
    const agentFiles = [
      ...findAgentFiles(repoPackagesDir),
      ...findGithubAgentFiles(repoGithubAgentsDir),
    ];

    const skillViolations = checkSkillSizes(skillFiles);
    const agentViolations = checkAgentSizes(agentFiles);

    if (skillViolations.length > 0) {
      console.warn(
        `[skill-size-validator] ${skillViolations.length} SKILL.md file(s) exceed the ${SKILL_MD_LINE_LIMIT}-line limit:`
      );
      for (const v of skillViolations) {
        console.warn(`  ${v.filePath} (${v.lines} lines, limit ${v.limit})`);
      }
    }

    if (agentViolations.length > 0) {
      console.warn(
        `[skill-size-validator] ${agentViolations.length} .agent.md file(s) exceed the ${AGENT_MD_LINE_LIMIT}-line limit:`
      );
      for (const v of agentViolations) {
        console.warn(`  ${v.filePath} (${v.lines} lines, limit ${v.limit})`);
      }
    }

    // Advisory only — never fail CI
    expect(true).toBe(true);
  });
});
