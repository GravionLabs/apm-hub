import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateAgentTargets } from './agent-target-generator';

const SAMPLE_AGENT = [
  '---',
  'name: sample',
  'description: "Sample agent."',
  "tools: ['read', 'search']",
  'user-invocable: true',
  'mode: subagent',
  'steps: 5',
  'color: warning',
  'permission:',
  '  read: allow',
  '  bash:',
  '    "*": deny',
  '---',
  '',
  'Body content.',
  '',
].join('\n');

const SAMPLE_AGENT_WITH_METADATA = [
  '---',
  'name: sample',
  'description: "Sample agent."',
  "tools: ['read', 'search']",
  'user-invocable: true',
  'mode: subagent',
  'steps: 5',
  'color: warning',
  'metadata:',
  '  opencode:',
  '    permission:',
  '      read: allow',
  '      bash:',
  '        "*": deny',
  '  claude:',
  '    tools:',
  '      - Bash',
  '      - Read',
  '---',
  '',
  'Body content.',
  '',
].join('\n');

const STRIP_CONFIG = {
  opencode: ['tools', 'user-invocable', 'agents', 'metadata'],
  copilot: ['mode', 'steps', 'color', 'permission', 'task', 'metadata'],
  claude: ['mode', 'steps', 'color', 'tools', 'permission', 'user-invocable', 'agents', 'model', 'metadata'],
};

describe('generateAgentTargets', () => {
  let tmpDir: string;
  let packagesDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-target-test-'));
    packagesDir = path.join(tmpDir, 'packages');

    const agentsDir = path.join(packagesDir, 'demo', '.apm', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, 'sample.agent.md'), SAMPLE_AGENT);

    configPath = path.join(tmpDir, 'agent-strip-fields.json');
    fs.writeFileSync(configPath, JSON.stringify(STRIP_CONFIG));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('strips OpenCode-only fields from the Copilot output', () => {
    generateAgentTargets(packagesDir, tmpDir, configPath);
    const content = fs.readFileSync(path.join(tmpDir, '.github/agents/sample.agent.md'), 'utf8');
    expect(content).not.toContain('mode:');
    expect(content).not.toContain('steps:');
    expect(content).not.toContain('color:');
    expect(content).not.toContain('permission:');
    expect(content).not.toContain('read: allow');
    expect(content).toContain('name: sample');
    expect(content).toContain("tools: ['read', 'search']");
    expect(content).toContain('user-invocable: true');
    expect(content).toContain('Body content.');
  });

  it('strips Copilot-only fields from the OpenCode output', () => {
    generateAgentTargets(packagesDir, tmpDir, configPath);
    const content = fs.readFileSync(path.join(tmpDir, '.opencode/agents/sample.md'), 'utf8');
    expect(content).not.toContain('tools:');
    expect(content).not.toContain('user-invocable:');
    expect(content).toContain('mode: subagent');
    expect(content).toContain('permission:');
    expect(content).toContain('  read: allow');
    expect(content).toContain('Body content.');
  });

  it('strips OpenCode and Copilot fields from the Claude output, keeping only name/description', () => {
    generateAgentTargets(packagesDir, tmpDir, configPath);
    const content = fs.readFileSync(path.join(tmpDir, '.claude/agents/sample.md'), 'utf8');
    expect(content).not.toContain('tools:');
    expect(content).not.toContain('user-invocable:');
    expect(content).not.toContain('mode:');
    expect(content).not.toContain('permission:');
    expect(content).toContain('name: sample');
    expect(content).toContain('description: "Sample agent."');
    expect(content).toContain('Body content.');
  });

  it('writes all target files for every agent', () => {
    generateAgentTargets(packagesDir, tmpDir, configPath);
    expect(fs.existsSync(path.join(tmpDir, '.github/agents/sample.agent.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.opencode/agents/sample.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.claude/agents/sample.md'))).toBe(true);
  });
});

describe('generateAgentTargets — metadata injection', () => {
  let tmpDir: string;
  let packagesDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-target-meta-test-'));
    packagesDir = path.join(tmpDir, 'packages');

    const agentsDir = path.join(packagesDir, 'demo', '.apm', 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, 'sample.agent.md'), SAMPLE_AGENT_WITH_METADATA);

    configPath = path.join(tmpDir, 'agent-strip-fields.json');
    fs.writeFileSync(configPath, JSON.stringify(STRIP_CONFIG));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('injects metadata.opencode into the OpenCode output and strips tools/metadata', () => {
    generateAgentTargets(packagesDir, tmpDir, configPath);
    const content = fs.readFileSync(path.join(tmpDir, '.opencode/agents/sample.md'), 'utf8');
    expect(content).not.toContain('tools:');
    expect(content).not.toContain('user-invocable:');
    expect(content).not.toContain('metadata:');
    expect(content).toContain('permission:');
    expect(content).toContain('  read: allow');
    expect(content).toContain('Body content.');
  });

  it('injects metadata.claude tools into the Claude output and strips metadata', () => {
    generateAgentTargets(packagesDir, tmpDir, configPath);
    const content = fs.readFileSync(path.join(tmpDir, '.claude/agents/sample.md'), 'utf8');
    expect(content).not.toContain('metadata:');
    expect(content).not.toContain('mode:');
    expect(content).not.toContain('permission:');
    expect(content).toContain('tools:');
    expect(content).toContain('  - Bash');
    expect(content).toContain('  - Read');
    expect(content).toContain('Body content.');
  });

  it('strips metadata from Copilot output with no injection', () => {
    generateAgentTargets(packagesDir, tmpDir, configPath);
    const content = fs.readFileSync(path.join(tmpDir, '.github/agents/sample.agent.md'), 'utf8');
    expect(content).not.toContain('metadata:');
    expect(content).not.toContain('opencode:');
    expect(content).toContain('name: sample');
    expect(content).toContain("tools: ['read', 'search']");
  });

  it('metadata key is absent from all output files', () => {
    generateAgentTargets(packagesDir, tmpDir, configPath);
    for (const f of [
      path.join(tmpDir, '.github/agents/sample.agent.md'),
      path.join(tmpDir, '.opencode/agents/sample.md'),
      path.join(tmpDir, '.claude/agents/sample.md'),
    ]) {
      expect(fs.readFileSync(f, 'utf8')).not.toContain('metadata:');
    }
  });
});

