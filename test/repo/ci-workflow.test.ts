import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';
import config from '../../vitest.config';

const file = path.resolve(__dirname, '../../.github/workflows/ci.yml');
const wf = parse(fs.readFileSync(file, 'utf-8'));

type Step = { uses?: string; run?: string; with?: Record<string, string> };
const steps = (job: string): Step[] => wf.jobs[job].steps;

describe('ci.yml parallel Vitest jobs (#502)', () => {
  it('runs every Vitest project as a matrix entry of the test job', () => {
    const projects = ((config.test?.projects ?? []) as Array<{ test: { name: string } }>).map(
      (p) => p.test.name
    );
    expect(projects).toEqual(['unit', 'scripts', 'integration']);
    expect([...wf.jobs.test.strategy.matrix.project].sort()).toEqual([...projects].sort());
    expect(wf.jobs.test.strategy['fail-fast']).toBe(false);
  });

  it('runs the selected project and names result artifacts per project', () => {
    const run = steps('test').find((s) => s.run === 'pnpm run test:ci:project');
    expect(run).toBeDefined();
    expect((run as Step & { env?: Record<string, string> }).env?.PROJECT).toBe(
      '${{ matrix.project }}'
    );
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'));
    expect(pkg.scripts['test:ci:project']).toContain('--project "$PROJECT"');
    expect(pkg.scripts['test:ci']).toBe('vitest run --coverage');
    const artifacts = steps('test').filter((s) => s.uses?.startsWith('actions/upload-artifact'));
    expect(artifacts.length).toBe(2);
    for (const a of artifacts) expect(a.with?.name).toContain('${{ matrix.project }}');
  });

  it('publishes a per-project report and coverage summary from the vitest outputs', () => {
    const reporter = steps('test').find((s) => s.uses?.startsWith('dorny/test-reporter'));
    expect(reporter?.with?.name).toContain('${{ matrix.project }}');
    expect(reporter?.with?.path).toBe('test-results/junit.xml');
    const summary = steps('test').find((s) => s.uses?.startsWith('irongut/CodeCoverageSummary'));
    expect(summary?.with?.filename).toBe('coverage/cobertura-coverage.xml');
    expect(wf.jobs.test.permissions).toEqual({ checks: 'write', contents: 'read' });
  });

  it('does not use the fixed-name node/test action in any job', () => {
    for (const job of Object.keys(wf.jobs)) {
      for (const s of steps(job)) expect(s.uses ?? '').not.toContain('node/test@');
    }
    expect(steps('build-test').some((s) => s.run?.includes('vitest'))).toBe(false);
  });

  it('makes regenerate and release wait for the test jobs and build-test', () => {
    for (const job of ['regenerate-and-commit', 'release']) {
      expect(wf.jobs[job].needs).toEqual(expect.arrayContaining(['test', 'build-test']));
    }
  });
});
