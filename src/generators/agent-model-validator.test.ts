import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ALLOWED_CLAUDE_MODELS,
  ALLOWED_OPENCODE_MODELS,
  MODEL_BY_TIER,
  OPENCODE_MODEL_BY_TIER,
  TIERS,
  checkAgentModels,
} from './agent-model-validator';
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
    const files = ALLOWED_OPENCODE_MODELS.map((m, i) =>
      write(`a${i}.agent.md`, agent('sonnet', m))
    );
    expect(checkAgentModels(files)).toEqual([]);
  });

  it('accepts every allowed claude value', () => {
    const files = ALLOWED_CLAUDE_MODELS.map((m, i) => write(`c${i}.agent.md`, agent(m)));
    expect(checkAgentModels(files)).toEqual([]);
  });

  it('accepts an agent without metadata or opencode model', () => {
    const f1 = write('none.agent.md', '---\nname: x\ndescription: y\n---\nbody\n');
    const f2 = write('claude-only.agent.md', agent('sonnet'));
    expect(checkAgentModels([f1, f2])).toEqual([]);
  });

  it('flags inherit as a claude model', () => {
    const f = write('inherit.agent.md', agent('inherit'));
    const v = checkAgentModels([f]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ filePath: f, field: 'metadata.claude.model', value: 'inherit' });
  });

  it('flags a tier name used as a model', () => {
    const f = write('tier.agent.md', agent('strong', 'standard'));
    expect(checkAgentModels([f]).map((x) => x.value)).toEqual(['strong', 'standard']);
  });

  it('flags an unknown opencode id', () => {
    const f = write('bad.agent.md', agent('sonnet', 'anthropic/claude-haiku-9-9'));
    const v = checkAgentModels([f]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({
      filePath: f,
      field: 'metadata.opencode.model',
      value: 'anthropic/claude-haiku-9-9',
    });
  });

  it('flags an unknown claude model', () => {
    const f = write('bad.agent.md', agent('gpt', 'anthropic/claude-sonnet-5-5'));
    const v = checkAgentModels([f]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ field: 'metadata.claude.model', value: 'gpt' });
  });

  it('reports both fields when both are invalid', () => {
    const f = write('both.agent.md', agent('gpt', 'nope'));
    const v = checkAgentModels([f]);
    expect(v.map((x) => x.field)).toEqual(['metadata.claude.model', 'metadata.opencode.model']);
  });

  it('reports malformed YAML as a violation naming the file', () => {
    const f = write('broken.agent.md', '---\nname: [unclosed\nmetadata: {\n---\nbody\n');
    const v = checkAgentModels([f]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ filePath: f, field: 'frontmatter' });
    expect(v[0].value).not.toBe('');
  });

  it.each([
    ['a string', 'metadata: nope'],
    ['a list', 'metadata:\n  - a'],
    ['null', 'metadata:'],
  ])('flags metadata that is %s', (_label, yaml) => {
    const f = write('meta.agent.md', `---\nname: x\n${yaml}\n---\nbody\n`);
    const v = checkAgentModels([f]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ filePath: f, field: 'metadata' });
  });

  it('flags a null claude section and a null opencode section', () => {
    const f = write(
      'nulls.agent.md',
      '---\nname: x\nmetadata:\n  claude:\n  opencode:\n---\nbody\n'
    );
    const v = checkAgentModels([f]);
    expect(v.map((x) => x.field)).toEqual(['metadata.claude', 'metadata.opencode']);
  });

  it('flags a null model value', () => {
    const f = write(
      'nullmodel.agent.md',
      '---\nname: x\nmetadata:\n  claude:\n    model:\n---\nbody\n'
    );
    const v = checkAgentModels([f]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ field: 'metadata.claude.model', value: 'null' });
  });
});

describe('MODEL_BY_TIER', () => {
  it('lists the three tiers in order', () => {
    expect(TIERS).toEqual(['fast', 'standard', 'strong']);
  });

  it('maps every tier to the claude and opencode model', () => {
    expect(MODEL_BY_TIER).toEqual({
      claude: { fast: 'haiku', standard: 'sonnet', strong: 'opus' },
      opencode: {
        fast: 'anthropic/claude-haiku-5-5',
        standard: 'anthropic/claude-sonnet-5-5',
        strong: 'anthropic/claude-opus-5-5',
      },
    });
  });

  it('derives the allowed lists without inherit', () => {
    expect(ALLOWED_CLAUDE_MODELS).toEqual(['haiku', 'sonnet', 'opus']);
    expect(ALLOWED_OPENCODE_MODELS).toEqual([
      'anthropic/claude-haiku-5-5',
      'anthropic/claude-sonnet-5-5',
      'anthropic/claude-opus-5-5',
    ]);
  });

  it('pairs each claude model with the opencode id of the same tier', () => {
    expect(OPENCODE_MODEL_BY_TIER).toEqual({
      haiku: 'anthropic/claude-haiku-5-5',
      sonnet: 'anthropic/claude-sonnet-5-5',
      opus: 'anthropic/claude-opus-5-5',
    });
  });
});

describe('live repo agent model check', () => {
  const files = findAgentFiles(path.resolve(__dirname, '../../packages'));

  it('finds the known agents and validates at least one model', () => {
    const names = files.map((f) => path.basename(f));
    expect(names).toEqual(expect.arrayContaining(['orchestrator.agent.md', 'explorer.agent.md']));
    const withModel = files.filter((f) => /^\s+model:/m.test(fs.readFileSync(f, 'utf8')));
    expect(withModel.length).toBeGreaterThan(0);
  });

  it('documents every allowed id in agent-frontmatter.md', () => {
    const doc = fs.readFileSync(
      path.resolve(__dirname, '../../docs/concepts/agent-frontmatter.md'),
      'utf8'
    );
    for (const id of [...ALLOWED_CLAUDE_MODELS, ...ALLOWED_OPENCODE_MODELS])
      expect(doc).toContain(id);
  });

  it('every agent uses allowed model ids', () => {
    const violations = checkAgentModels(files);
    const message = violations.map((v) => `${v.filePath}: ${v.field}=${v.value}`).join('\n');
    expect(violations, message).toEqual([]);
  });
});
