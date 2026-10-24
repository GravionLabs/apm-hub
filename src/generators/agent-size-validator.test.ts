import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  AGENT_BODY_LINE_LIMIT,
  checkAgentSizes,
  countBodyLines,
  findAgentFiles,
} from './agent-size-validator';

const agent = (bodyLines: number) =>
  `---\nname: x\ndescription: y\n---\n\n${Array(bodyLines).fill('rule').join('\n')}\n`;

describe('findAgentFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-size-find-'));
    const agentsDir = path.join(tmpDir, 'agents', '.apm', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, 'explorer.agent.md'), agent(3));
    fs.writeFileSync(path.join(agentsDir, 'README.md'), '# not an agent\n');
    // a domain without agents must be ignored
    fs.mkdirSync(path.join(tmpDir, 'ts', '.apm', 'skills'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return only *.agent.md files across domains', () => {
    const files = findAgentFiles(tmpDir);
    expect(files).toHaveLength(1);
    expect(files[0].endsWith('explorer.agent.md')).toBe(true);
  });

  it('should return empty array when base dir does not exist', () => {
    expect(findAgentFiles(path.join(tmpDir, 'nope'))).toEqual([]);
  });
});

describe('countBodyLines', () => {
  it('counts lines after the frontmatter without surrounding blank lines', () => {
    expect(countBodyLines(agent(5))).toBe(5);
  });

  it('counts the whole file when there is no frontmatter', () => {
    expect(countBodyLines('a\nb\n\n')).toBe(2);
  });
});

describe('checkAgentSizes', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-size-check-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('accepts a body at the limit and flags one above it', () => {
    const ok = path.join(tmpDir, 'ok.agent.md');
    const long = path.join(tmpDir, 'long.agent.md');
    fs.writeFileSync(ok, agent(AGENT_BODY_LINE_LIMIT));
    fs.writeFileSync(long, agent(AGENT_BODY_LINE_LIMIT + 1));
    const violations = checkAgentSizes([ok, long]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toEqual({
      filePath: long,
      bodyLines: AGENT_BODY_LINE_LIMIT + 1,
      limit: AGENT_BODY_LINE_LIMIT,
    });
  });
});

describe('live repo agent size check', () => {
  it('no agent body in the repo exceeds the line limit', () => {
    const violations = checkAgentSizes(findAgentFiles(path.resolve(__dirname, '../../packages')));
    const message = violations
      .map((v) => `${v.filePath} (${v.bodyLines} body lines, limit ${v.limit})`)
      .join('\n');
    expect(violations, message).toEqual([]);
  });
});
