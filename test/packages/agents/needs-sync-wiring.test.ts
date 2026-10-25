import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const loop = read('packages/github/.apm/skills/github-issue/references/loop-mode.md');
const agents = {
  orchestrator: read('packages/agents/.apm/agents/orchestrator.agent.md'),
  'pbi-runner': read('packages/agents/.apm/agents/pbi-runner.agent.md'),
};
const body = (agent: string) => agent.replace(/^---\n[\s\S]*?\n---\n/, '');
const PREFIXES = [
  '.claude',
  '.opencode',
  '.agents',
  '.github',
  '~/.claude',
  '~/.agents',
  '~/.config/opencode',
];

describe('Needs sync wiring (#638)', () => {
  for (const [name, text] of Object.entries(agents)) {
    it(`${name} allows Sync-ProjectNeeds.ps1 for every skills directory variant`, () => {
      for (const p of PREFIXES)
        expect(text).toContain(
          `"pwsh ${p}/skills/github-project/scripts/Sync-ProjectNeeds.ps1 *": allow`
        );
    });
    it(`${name} body stays within 40 lines`, () => {
      expect(
        body(text)
          .split('\n')
          .filter((l) => l.trim()).length
      ).toBeLessThanOrEqual(40);
    });
  }

  it('loop-mode.md runs the sync after the PBI start and after the done line, never as a stop', () => {
    const line = loop.split('\n').find((l) => l.startsWith('- Needs sync:')) ?? '';
    expect(line).toContain('Sync-ProjectNeeds.ps1 -Issue <pbi> -IncludeParents');
    expect(line).toContain('Next PBI:');
    expect(line).toContain('Loop: PBI #<nr> done — <pr>');
    expect(line).toMatch(/`parked`|parked/);
    expect(line).toContain('merged');
    expect(line).toMatch(/ignored, never a stop/);
    expect(line).toContain('PROJECT_SYNC_OFF=1');
  });
});
