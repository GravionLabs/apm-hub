import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePluginConfig, generatePluginList } from './plugin-list-generator';

vi.mock('fs');
vi.mock('yaml');

import * as fs from 'fs';
import { parse } from 'yaml';

const mockFs = vi.mocked(fs);
const mockParse = vi.mocked(parse);

describe('parsePluginConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.mkdirSync = vi.fn();
    mockFs.writeFileSync = vi.fn();
  });

  it('should parse a full plugin config', () => {
    mockFs.readFileSync = vi.fn().mockReturnValue('yaml content');
    mockParse.mockReturnValue({
      name: 'my-plugin',
      description: 'My plugin description',
      version: '2.1.0',
      skills: [{ name: 'skill-a' }, { name: 'skill-b' }],
      agents: [{ source: 'agent-x' }],
      instructions: [{ source: 'instr-y' }],
      keywords: ['foo', 'bar'],
    });

    const result = parsePluginConfig('/plugins/my-plugin/plugin.config.yml');

    expect(result.dirName).toBe('my-plugin');
    expect(result.name).toBe('my-plugin');
    expect(result.version).toBe('2.1.0');
    expect(result.description).toBe('My plugin description');
    expect(result.skillCount).toBe(2);
    expect(result.agentCount).toBe(1);
    expect(result.instructionCount).toBe(1);
    expect(result.skills).toEqual(['skill-a', 'skill-b']);
    expect(result.agents).toEqual(['agent-x']);
    expect(result.instructions).toEqual(['instr-y']);
    expect(result.keywords).toEqual(['foo', 'bar']);
  });

  it('should handle string-form skills and agents', () => {
    mockFs.readFileSync = vi.fn().mockReturnValue('yaml content');
    mockParse.mockReturnValue({
      name: 'simple',
      skills: ['skill-one', 'skill-two'],
      agents: ['agent-one'],
      instructions: [],
    });

    const result = parsePluginConfig('/plugins/simple/plugin.config.yml');
    expect(result.skills).toEqual(['skill-one', 'skill-two']);
    expect(result.agents).toEqual(['agent-one']);
    expect(result.instructions).toEqual([]);
  });

  it('should default empty arrays when keys are missing', () => {
    mockFs.readFileSync = vi.fn().mockReturnValue('yaml content');
    mockParse.mockReturnValue({ name: 'minimal' });

    const result = parsePluginConfig('/plugins/minimal/plugin.config.yml');
    expect(result.skillCount).toBe(0);
    expect(result.agentCount).toBe(0);
    expect(result.instructionCount).toBe(0);
    expect(result.skills).toEqual([]);
    expect(result.agents).toEqual([]);
    expect(result.instructions).toEqual([]);
    expect(result.keywords).toEqual([]);
    expect(result.version).toBe('1.0.0');
  });

  it('should fall back to dirName when config has no name', () => {
    mockFs.readFileSync = vi.fn().mockReturnValue('yaml content');
    mockParse.mockReturnValue({});

    const result = parsePluginConfig('/plugins/fallback-name/plugin.config.yml');
    expect(result.name).toBe('fallback-name');
    expect(result.dirName).toBe('fallback-name');
  });
});

describe('generatePluginList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.mkdirSync = vi.fn();
    mockFs.writeFileSync = vi.fn();
  });

  it('should generate plugin-list.md with overview table and per-plugin sections', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(true);
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'my-plugin', isDirectory: () => true }] as unknown as fs.Dirent[]);
    mockFs.readFileSync = vi.fn().mockReturnValue('yaml content');
    mockParse.mockReturnValue({
      name: 'my-plugin',
      description: 'A cool plugin',
      version: '1.2.3',
      skills: [{ name: 'skill-a' }, { name: 'skill-b' }],
      agents: [{ source: 'agent-x' }],
      instructions: [{ source: 'instr-y' }],
      keywords: ['cool'],
    });

    generatePluginList('plugins', 'docs/plugin-list.md');

    const written = vi.mocked(fs.writeFileSync).mock.calls[0];
    expect(written[0]).toBe('docs/plugin-list.md');
    const content = written[1] as string;

    expect(content).toContain('# Plugin List');
    expect(content).toContain('automatically generated');
    // Overview table includes Version column
    expect(content).toContain(
      '| Plugin | Version | Description | Skills | Agents | Instructions |'
    );
    expect(content).toContain('`1.2.3`');
    expect(content).toContain('my-plugin');
    expect(content).toContain('A cool plugin');
    // Per-plugin section shows version
    expect(content).toContain('## my-plugin');
    expect(content).toContain('**v1.2.3**');
    expect(content).toContain('plugins/my-plugin');
    expect(content).toContain('skill-a');
    expect(content).toContain('agent-x.agent.md');
    expect(content).toContain('instr-y.instructions.md');
    expect(content).toContain('`cool`');
  });

  it('should write an empty overview when no plugins exist', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(false);

    generatePluginList('plugins', 'docs/plugin-list.md');

    const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    expect(content).toContain('# Plugin List');
    expect(content).toContain(
      '| Plugin | Version | Description | Skills | Agents | Instructions |'
    );
    // No plugin rows
    expect(content).not.toContain('\n## my-plugin');
  });

  it('should skip directories without plugin.config.yml', () => {
    mockFs.existsSync = vi.fn((p: fs.PathLike | string) => {
      return !(typeof p === 'string' && p.endsWith('plugin.config.yml'));
    });
    mockFs.readdirSync = vi
      .fn()
      .mockReturnValue([{ name: 'orphan', isDirectory: () => true }] as unknown as fs.Dirent[]);

    generatePluginList('plugins', 'docs/plugin-list.md');

    const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    expect(content).not.toContain('orphan');
  });

  it('should create output directory if missing', () => {
    mockFs.existsSync = vi.fn().mockReturnValue(false);

    generatePluginList('plugins', 'docs/plugin-list.md');

    expect(mockFs.mkdirSync).toHaveBeenCalledWith('docs', { recursive: true });
  });
});
