import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ALLOWED_CLAUDE_MODELS, ALLOWED_OPENCODE_MODELS, checkAgentModels } from './agent-model-validator';
import { findAgentFiles } from './agent-size-validator';

const agent = (claude?: string, opencode?: string) => {
  const lines = ['---', 'name: x', 'description: y', 'metadata:'];
  if (claude !== undefined) lines.push('  claude:', `    model: ${claude}`);
  if (opencode !== undefined) lines.push('  opencode:', `    model: ${opencode}`);
  return [...lines, '---', '', 'body', ''].join('\n');
};

describe('checkAgentModels', () => {
  let tmpDir: string;
  const write = (name: string, content: string) => {
    const p = path.join(tmpDir, name);
    fs.writeFileSync(p, content);
    return p;
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-model-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('accepts every allowed id', () => {
    const files = ALLOWED_OPENCODE_MODELS.map((m, i) => write(`a${i}.agent.md`, agent('sonnet', m)));
    expect(checkAgentModels(files)).toEqual([]);
  });

  it('accepts every allowed claude value', () => {
    const files = ALLOWED_CLAUDE_MODELS.map((m, i) => write(`c${i}.agent.md`, agent(m)));
    expect(checkAgentModels(files)).toEqual([]);
  });

  it('accepts an agent without metadata or opencode model', () => {
    const f1 = write('none.agent.md', '---\nname: x\ndescription: y\n---\nbody\n');
    const f2 = write('inherit.agent.md', agent('inherit'));
    expect(checkAgentModels([f1, f2])).toEqual([]);
  });

  it('flags an unknown opencode id', () => {
    const f = write('bad.agent.md', agent('sonnet', 'anthropic/claude-haiku-9-9'));
    const v = checkAgentModels([f]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ filePath: f, field: 'metadata.opencode.model', value: 'anthropic/claude-haiku-9-9' });
  });

  it('flags an unknown claude model', () => {
    const f = write('bad.agent.md', agent('gpt', 'anthropic/claude-sonnet-5-5'));
    const v = checkAgentModels([f]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ field: 'metadata.claude.model', value: 'gpt' });
  });
});

describe('live repo agent model check', () => {
  it('every agent uses allowed model ids', () => {
    const violations = checkAgentModels(findAgentFiles(path.resolve(__dirname, '../../packages')));
    const message = violations.map((v) => `${v.filePath}: ${v.field}=${v.value}`).join('\n');
    expect(violations, message).toEqual([]);
  });
});
