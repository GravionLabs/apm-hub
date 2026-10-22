import * as fs from 'fs';
import * as path from 'path';

const pk = path.resolve(__dirname, '../../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');
const docs = fs.readFileSync(path.resolve(__dirname, '../../../docs/orchestrator.md'), 'utf-8');

const pipeline = read('github/.apm/skills/github-issue/references/pbi-pipeline.md');
const gates = read('github/.apm/skills/github-issue/references/orchestrator-gates.md');
const verifyProject = read('delivery/.apm/skills/verify-project/SKILL.md');
const runner = read('agents/.apm/agents/pbi-runner.agent.md');
const step5 = pipeline.split('\n').find((l) => l.startsWith('5. '))!;

describe('Final-Verify step (#449)', () => {
  it('step 5 runs verify-project in a forked haiku general-purpose context before the review', () => {
    expect(step5.indexOf('Final-Verify')).toBeGreaterThanOrEqual(0);
    expect(step5.indexOf('Final-Verify')).toBeLessThan(step5.indexOf('review `<first BASE>..HEAD`'));
    expect(step5).toContain('`verify-project`');
    expect(step5).toContain('forked general-purpose context');
    expect(step5).toMatch(/`subagent_type: general-purpose`, model haiku/);
    expect(step5).toContain('<state>/<pbi>/verify.json');
    expect(step5).toContain('{status, summary, tests}');
  });

  it('red verify gets a fix round, red twice is a gate, a second run follows the last fix round', () => {
    expect(step5).toMatch(/fix round with the failure list/);
    expect(step5).toMatch(/Final-Verify again; red twice → gate to the user/);
    expect(step5).toMatch(/once after the LAST fix round \(never per fix round\)/);
    expect(step5).toMatch(/green `verify\.json` gate the PR phase/);
    const gateList = pipeline.split('## Gate points')[1];
    expect(gateList).toMatch(/Final-Verify red twice/);
    expect(gates).toContain('## Final-Verify red twice');
    expect(gates).toMatch(/Gate: Final-Verify red twice/);
  });

  it('models: Final-Verify is haiku in the pipeline and in the runner pins', () => {
    expect(pipeline).not.toContain('final verify inherit');
    expect(pipeline).toContain('Final-Verify haiku');
    expect(pipeline).toMatch(/`explorer` and final verify to haiku/);
    expect(runner).toContain('final verify haiku');
    expect(runner).not.toContain('final verify opus');
  });

  it('ledger line Phase verify with the test count', () => {
    expect(pipeline).toContain('`Phase verify: <ok|fail> — tests <n>/<m>`');
    expect(docs).toContain('Phase verify: ok — tests');
  });

  it('verify-project output carries tests and writes the caller-given file', () => {
    expect(verifyProject).toContain('"tests": "<passed>/<total>"');
    expect(verifyProject).toMatch(/caller passes an output path/);
    expect(verifyProject).toContain('<state>/<pbi>/verify.json');
    expect(verifyProject.split('\n').length).toBeLessThanOrEqual(100);
  });

  it('docs/orchestrator.md lists Final-Verify among the phases and the gates', () => {
    expect(docs).toMatch(/\*\*Final-Verify, then review\.\*\*/);
    expect(docs).toMatch(/Final-Verify is red twice/);
    expect(docs).toMatch(/verify on haiku/);
  });
});
