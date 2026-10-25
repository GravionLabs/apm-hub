import * as fs from 'fs';
import * as path from 'path';

const pk = path.resolve(__dirname, '../../../packages');
const read = (p: string) => fs.readFileSync(path.join(pk, p), 'utf-8');
const docs = fs.readFileSync(path.resolve(__dirname, '../../../docs/orchestrator.md'), 'utf-8');

const pipeline = read('github/.apm/skills/github-issue/references/pbi-pipeline.md');
const gates = read('github/.apm/skills/github-issue/references/orchestrator-gates.md');
const verifyProject = read('delivery/.apm/skills/verify-project/SKILL.md');
const waves = read('github/.apm/skills/github-issue/references/task-waves.md');
const runner = read('agents/.apm/agents/pbi-runner.agent.md');
const step5 = pipeline.split('\n').find((l) => l.startsWith('5. '))!;

describe('Final-Verify step (#449)', () => {
  it('step 5 invokes verify-project directly on Claude Code before the review', () => {
    expect(step5.indexOf('Final-Verify')).toBeGreaterThanOrEqual(0);
    expect(step5.indexOf('Final-Verify')).toBeLessThan(
      step5.indexOf('review `<first BASE>..HEAD`')
    );
    expect(step5).toContain('`verify-project`');
    expect(step5).toMatch(/invoke the skill directly/);
    expect(step5).toContain('`context: fork`');
    expect(step5).toContain('<state>/<pbi>/verify.json');
    expect(step5).toContain('{status, summary, tests}');
    expect(step5).toMatch(/OpenCode\/Copilot[^;]*read-only subagent/);
  });

  it('regression #610: step 5 never dispatches verify-project through a general-purpose Agent', () => {
    // a wrapper agent plus the skill's own fork ran the full suite twice, in parallel
    const forbidden = [
      /forked general-purpose context/,
      /dispatch the `verify-project` skill/,
      /`Agent` with `subagent_type: general-purpose`/,
    ];
    for (const re of forbidden) expect(step5).not.toMatch(re);
    // every mention of general-purpose in step 5 is a prohibition
    for (const m of step5.matchAll(/general-purpose/g)) {
      expect(step5.slice(Math.max(0, m.index - 80), m.index)).toMatch(/never/);
    }
  });

  it('verify-project, the light check, task waves and the runner carry the run-once rule (#610)', () => {
    expect(verifyProject).toContain('context: fork');
    expect(verifyProject).toMatch(
      /exactly once per call; never start another agent, subagent or skill that runs them again/
    );
    expect(verifyProject).not.toMatch(/runs in a forked general-purpose context/);
    const light = gates.split('\n').find((l) => l.startsWith('- Light check'))!;
    expect(light).toMatch(/one direct `verify-project` invocation \(no `Agent` wrapper\)/);
    expect(light).toMatch(/one build and one full suite run/);
    expect(runner).toMatch(/`verify-project` skill invoked directly, not an `Agent` dispatch/);
    expect(runner).toMatch(/runs the full suite once/);
    expect(waves).toMatch(/never through a general-purpose `Agent`/);
  });

  it('red verify gets a fix round, red twice is a gate, a second run follows the last fix round', () => {
    expect(step5).toMatch(/fix round with the failure list/);
    expect(step5).toMatch(/Final-Verify again; red twice → gate to the user/);
    expect(step5).toMatch(
      /once after the LAST fix round \(never per fix round, except after an advisory-only round/
    );
    expect(step5).toMatch(/green `verify\.json` gate the PR phase/);
    const gateList = pipeline.split('## Gate points')[1];
    expect(gateList).toMatch(/Final-Verify red twice/);
    expect(gates).toContain('## Final-Verify red twice');
    expect(gates).toMatch(/Gate: Final-Verify red twice/);
  });

  it('models: Final-Verify is standard (sonnet of the caller) in the pipeline and in the runner pins', () => {
    expect(pipeline).not.toContain('final verify inherit');
    expect(pipeline).toContain('Final-Verify standard');
    expect(pipeline).toMatch(/`explorer` to fast, final verify,/);
    expect(runner).toContain('final verify sonnet');
    expect(runner).not.toContain('final verify haiku');
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
    expect(docs).toMatch(/verify \(the forked `verify-project`\) on the caller's sonnet/);
  });
});
