import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateSkillList } from './skill-list-generator';

describe('generateSkillList', () => {
  let tmpDir: string;
  let packagesDir: string;
  let outputFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-list-test-'));
    packagesDir = path.join(tmpDir, 'packages');
    outputFile = path.join(tmpDir, 'docs', 'skill-list.md');

    // csharp/packages/<domain>/.apm/skills/<name>/SKILL.md — agentskills.io directory layout
    const csSkillsDir = path.join(packagesDir, 'csharp', '.apm', 'skills');
    fs.mkdirSync(path.join(csSkillsDir, 'csharp-async'), { recursive: true });
    fs.writeFileSync(
      path.join(csSkillsDir, 'csharp-async', 'SKILL.md'),
      '---\nname: csharp-async\ndescription: Best practices for async/await in C#.\n---\nContent'
    );
    fs.mkdirSync(path.join(csSkillsDir, 'csharp-docs'), { recursive: true });
    fs.writeFileSync(
      path.join(csSkillsDir, 'csharp-docs', 'SKILL.md'),
      '---\nname: csharp-docs\ndescription: Document C# types with XML comments.\n---\nContent'
    );
    // Agents/instructions in csharp domain should be ignored by skill-list
    const csAgentsDir = path.join(packagesDir, 'csharp', '.apm', 'agents');
    fs.mkdirSync(csAgentsDir, { recursive: true });
    fs.writeFileSync(path.join(csAgentsDir, 'csharp-expert.agent.md'), '---\nname: C# Expert\n---\n');
    const csInstrDir = path.join(packagesDir, 'csharp', '.apm', 'instructions');
    fs.mkdirSync(csInstrDir, { recursive: true });
    fs.writeFileSync(path.join(csInstrDir, 'csharp.instructions.md'), '---\ndescription: C# standards.\n---\n');

    // shared/.apm/skills/ts-write-tests/SKILL.md
    const sharedSkillsDir = path.join(packagesDir, 'shared', '.apm', 'skills');
    fs.mkdirSync(path.join(sharedSkillsDir, 'ts-write-tests'), { recursive: true });
    fs.writeFileSync(
      path.join(sharedSkillsDir, 'ts-write-tests', 'SKILL.md'),
      '---\nname: ts-write-tests\ndescription: Write unit tests.\n---\nContent'
    );
    // shared/.apm/skills/ts-create-project/SKILL.md — gated from model invocation
    fs.mkdirSync(path.join(sharedSkillsDir, 'ts-create-project'), { recursive: true });
    fs.writeFileSync(
      path.join(sharedSkillsDir, 'ts-create-project', 'SKILL.md'),
      "---\nname: ts-create-project\ndescription: Scaffold a project.\ndisable-model-invocation: true\nmetadata:\n  opencode/autoinvoke: 'false'\n---\nContent"
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should generate domain sections with only skill files', () => {
    generateSkillList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('# Skill List');
    expect(content).toContain('## Csharp');
    expect(content).toContain('## Shared');
    expect(content).toContain('csharp-async');
    expect(content).toContain('csharp-docs');
    expect(content).toContain('ts-write-tests');
  });

  it('should not include agents or instructions in skill list', () => {
    generateSkillList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).not.toContain('C# Expert');
    expect(content).not.toContain('csharp.instructions');
  });

  it('should include overview table with domain links', () => {
    generateSkillList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('## Overview');
    expect(content).toContain('[Csharp](#csharp)');
    expect(content).toContain('[Shared](#shared)');
  });

  it('should mark skills with disable-model-invocation as user-invoked', () => {
    generateSkillList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('Scaffold a project. *(user-invoked: `/ts-create-project`)*');
    expect(content).toContain('| [`ts-write-tests`](../packages/shared/.apm/skills/ts-write-tests/SKILL.md) | Write unit tests. |');
  });

  it('should link to skill directory layout package files', () => {
    generateSkillList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('packages/csharp/.apm/skills/csharp-async/SKILL.md');
    expect(content).toContain('packages/shared/.apm/skills/ts-write-tests/SKILL.md');
  });

  it('should list external dependencies per package and skip internal ones', () => {
    fs.writeFileSync(
      path.join(packagesDir, 'csharp', 'apm.yml'),
      'name: csharp\ndependencies:\n  apm:\n    - dotnet/skills/plugins/dotnet#v1.0.0\n    - GravionLabs/apm-hub/packages/shared\n'
    );
    generateSkillList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('External dependencies: `dotnet/skills/plugins/dotnet#v1.0.0`');
    expect(content).not.toContain('`GravionLabs/apm-hub/packages/shared`');
  });

  it('should list object-form dependencies and omit the line without external ones', () => {
    fs.writeFileSync(
      path.join(packagesDir, 'csharp', 'apm.yml'),
      'name: csharp\ndependencies:\n  apm:\n    - git: https://github.com/o/r\n      path: p\n      ref: v1\n'
    );
    fs.writeFileSync(path.join(packagesDir, 'shared', 'apm.yml'), 'name: shared\n');
    generateSkillList(packagesDir, outputFile);
    const content = fs.readFileSync(outputFile, 'utf8');
    expect(content).toContain('External dependencies: `https://github.com/o/r/p#v1`');
    expect(content.match(/External dependencies/g)).toHaveLength(1);
  });

  it('should ignore a malformed apm.yml', () => {
    fs.writeFileSync(path.join(packagesDir, 'csharp', 'apm.yml'), ': : [');
    expect(() => generateSkillList(packagesDir, outputFile)).not.toThrow();
  });
});
