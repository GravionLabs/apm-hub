import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../../packages');
const skillDir = path.join(root, 'development-workflow/.apm/skills/issue-planning');
const read = (p: string) => fs.readFileSync(p, 'utf-8');

describe('grilling reference', () => {
  const grilling = read(path.join(skillDir, 'references/grilling.md'));

  it('attributes mattpocock/skills under MIT', () => {
    expect(grilling).toContain('mattpocock/skills');
    expect(grilling).toContain('MIT');
  });

  it.each(['AskUserQuestion', 'Gate:', 'Ruling:', 'needs-decision', 'Owner decision required', 'publish.md'])(
    'covers %s',
    (term) => expect(grilling).toContain(term),
  );

  it('is referenced by issue-planning and the orchestrator', () => {
    expect(read(path.join(skillDir, 'SKILL.md'))).toContain('references/grilling.md');
    expect(read(path.join(root, 'agents/.apm/agents/orchestrator.agent.md'))).toContain('references/grilling.md');
  });
});
