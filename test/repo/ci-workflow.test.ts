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
    expect(projects).toEqual(['unit', 'scripts', 'integration', 'perf']);
    expect(wf.jobs.test.strategy.matrix.project).toContain('perf');
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
    expect(pkg.scripts['test:ci']).toBe(
      'vitest run --coverage --project unit --project scripts --project integration'
    );
    expect(pkg.scripts['test:all']).toBe(
      'vitest run --project unit --project scripts --project integration'
    );
    expect(pkg.scripts['test:perf']).toBe('vitest run --project perf');
    const artifacts = steps('test').filter((s) => s.uses?.startsWith('actions/upload-artifact'));
    expect(artifacts.length).toBe(2);
    for (const a of artifacts) expect(a.with?.name).toContain('${{ matrix.project }}');
  });

  it('runs related tests on pull requests and the full project on push (#704)', () => {
    expect(wf.on.push.branches).toEqual(['main', 'release/**']);
    expect(wf.on.pull_request.types).toContain('labeled');
    expect(wf.jobs.test.name).toBe('Test (${{ matrix.project }})');
    const related = steps('test').find((s) => s.run?.includes('run-related-tests.mjs')) as Step & {
      if?: string;
      env?: Record<string, string>;
    };
    expect(related.run).toContain('--project "$PROJECT" --base "origin/$BASE_REF" --coverage');
    expect(related.env?.BASE_REF).toBe('${{ github.base_ref }}');
    expect(related.run).toContain('GITHUB_STEP_SUMMARY');
    expect(related.if).toContain("github.event_name == 'pull_request'");
    expect(related.if).toContain("!contains(github.event.pull_request.labels.*.name, 'ci:full')");
    const full = steps('test').find((s) => s.run === 'pnpm run test:ci:project') as Step & {
      if?: string;
    };
    expect(full.if).toContain("github.event_name != 'pull_request'");
    expect(full.if).toContain("contains(github.event.pull_request.labels.*.name, 'ci:full')");
    const checkout = steps('test').find((s) => s.uses?.startsWith('actions/checkout'));
    expect(checkout?.with?.['fetch-depth']).toContain("'pull_request' && 0");
  });

  it('tolerates a missing junit.xml and coverage file when no tests are related (#704)', () => {
    const reporter = steps('test').find((s) => s.uses?.startsWith('dorny/test-reporter'));
    expect(reporter?.with?.['fail-on-empty']).toBe(false);
    const summary = steps('test').find((s) => s.uses?.startsWith('irongut/CodeCoverageSummary')) as
      | (Step & { if?: string })
      | undefined;
    expect(summary?.if).toContain("hashFiles('coverage/cobertura-coverage.xml') != ''");
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

describe('ci.yml formatting check and triggers', () => {
  it('runs on pull requests into main and release/next', () => {
    expect(wf.on.pull_request.branches).toEqual(['main', 'release/next']);
  });

  it('runs prettier --check over the files the format script writes', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'));
    expect(pkg.scripts['format:check']).toBe(pkg.scripts.format.replace('--write', '--check'));
    expect(steps('build-test').some((s) => s.run === 'pnpm run format:check')).toBe(true);
  });
});
