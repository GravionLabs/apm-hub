import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  TEST_DUPLICATE_PATTERNS,
  findImplementationSkillFiles,
  checkTestDuplicates,
} from './test-duplicate-validator';

let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-dupes-'));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const skill = (body: string, name = 'x-implementation') => {
  const file = path.join(tmpDir, `${name}-SKILL.md`);
  fs.writeFileSync(
    file,
    `---\nname: ${name}\ndescription: 'Rules (vitest, pytest).'\n---\n${body}`,
  );
  return file;
};

describe('findImplementationSkillFiles', () => {
  it('returns only *-implementation SKILL.md files', () => {
    for (const n of ['ts-implementation', 'ts-test', 'implementation']) {
      const dir = path.join(tmpDir, 'ts', '.apm', 'skills', n);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'SKILL.md'), '# x\n');
    }
    const files = findImplementationSkillFiles(tmpDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain('ts-implementation');
  });

  it('returns empty for a missing directory', () => {
    expect(findImplementationSkillFiles(path.join(tmpDir, 'nope'))).toEqual([]);
  });
});

describe('checkTestDuplicates', () => {
  it('passes on a clean skill with a Tests pointer and review rules', () => {
    const f = skill(
      '# X\n\n- **Tests**: Vitest, see `ts-test`\n\n## Tests\n\nRunner config, naming and mocking live in `ts-test`.\n\n## Review rules\n\n- Missing tests for new code\n- Read `references/version-notes.md` for Vitest setup\n',
    );
    expect(checkTestDuplicates([f])).toEqual([]);
  });

  it('ignores the frontmatter', () => {
    expect(checkTestDuplicates([skill('# X\n')])).toEqual([]);
  });

  const families: [string, string][] = [
    ['runner name', '```\nnpx vitest run\n```'],
    ['runner name', 'Run `pytest -q` to check.'],
    ['runner name', 'Use xUnit for tests.'],
    ['runner name', 'Use NUnit for tests.'],
    ['runner name', 'Use MSTest for tests.'],
    ['runner name', 'Use jest for unit tests.'],
    ['runner name', 'E2E with Playwright.'],
    ['runner name', 'E2E with Cypress.'],
    ['runner name', 'Use mocha here.'],
    ['runner name', 'Use Jasmine here.'],
    ['runner name', 'Run karma in CI.'],
    ['dotnet test', '`dotnet test --no-build`'],
    ['cargo test', 'Run `cargo test --all`.'],
    ['cargo test', 'Use cargo nextest run in CI.'],
    ['package test command', 'Run `npm test` before commit.'],
    ['package test command', 'Run `pnpm test`.'],
    ['package test command', 'Run `yarn test`.'],
    ['package test command', 'Run `ng test`.'],
    ['runner config', 'Add a vitest.config.ts with globals.'],
    ['runner config', 'See jest.config.js for setup.'],
    ['runner config', 'Edit karma.config.js.'],
    ['runner config', 'Edit pytest.ini for markers.'],
    ['runner config', 'Fixtures go into conftest.py.'],
    ['test file naming', 'Name files user.test.ts next to the source.'],
    ['test file naming', 'Name files user.spec.ts next to the source.'],
    ['test file naming', 'Name files test_user.py in tests/.'],
    ['test file naming', 'Name files user_test.py in tests/.'],
    ['test file naming', 'Name files user_test.go next to the source.'],
    ['test file naming', 'Name classes OrderServiceTests.cs.'],
    ['mocking api', 'Stub with vi.fn() and vi.mock.'],
    ['mocking api', 'Stub with jest.fn().'],
    ['mocking api', 'Install pytest-mock for fixtures.'],
    ['mocking api', 'Use the mocker fixture.'],
    ['mocking api', 'Use mock.patch for clients.'],
    ['mocking api', 'Use monkeypatch for env vars.'],
    ['mocking api', 'Import from unittest.mock.'],
    ['mocking api', 'Use NSubstitute for fakes.'],
    ['mocking api', 'Use Moq for fakes.'],
    ['mocking api', 'Use FakeItEasy for fakes.'],
    ['mocking api', 'Use AutoFixture for data.'],
    ['assertion library', 'Assert with Shouldly.'],
    ['assertion library', 'Assert with FluentAssertions.'],
    ['assertion library', 'Query with @testing-library/angular.'],
    ['test api name', 'Configure TestBed once.'],
  ];

  it.each(families)('flags %s: %s', (pattern, line) => {
    expect(TEST_DUPLICATE_PATTERNS.map((p) => p.name)).toContain(pattern);
    const f = skill(`# X\n\n${line}\n`);
    const v = checkTestDuplicates([f]);
    expect(v.some((x) => x.pattern === pattern)).toBe(true);
    expect(v[0].filePath).toBe(f);
  });

  it('has a fixture for every pattern', () => {
    const covered = new Set(families.map(([p]) => p));
    for (const p of TEST_DUPLICATE_PATTERNS) expect(covered).toContain(p.name);
  });

  describe('cargo test pattern', () => {
    it('does not flag unrelated cargo commands', () => {
      const v = checkTestDuplicates([skill('# X\n\nRun `cargo build` and `cargo clippy`.\n')]);
      expect(v.some((x) => x.pattern === 'cargo test')).toBe(false);
    });
  });

  describe('pointer handling', () => {
    const flagged = (line: string, pattern?: string) => {
      const v = checkTestDuplicates([skill(`# X\n\n${line}\n`)]);
      return pattern ? v.some((x) => x.pattern === pattern) : v.length > 0;
    };

    it('allows a bare runner name on a backticked <lang>-test pointer', () => {
      expect(flagged('Vitest, see `ts-test`')).toBe(false);
      expect(flagged('pytest conventions: `py-test`')).toBe(false);
      expect(flagged('pytest, see `rust-test`')).toBe(false);
    });

    it('allows a bare runner name on a backticked references/ pointer', () => {
      expect(flagged('Vitest setup: `references/setup.md`')).toBe(false);
    });

    it('allows TestBed on a pointer line but not in a how-to', () => {
      expect(flagged('Load `ng-test` for TestBed setup.')).toBe(false);
      expect(flagged('Configure TestBed once.', 'test api name')).toBe(true);
    });

    it('does not accept an unbackticked or non-lang -test mention', () => {
      expect(flagged('Vitest, see ts-test', 'runner name')).toBe(true);
      expect(flagged('Vitest, see `other-test`', 'runner name')).toBe(true);
      expect(flagged('Vitest, see references/ somewhere', 'runner name')).toBe(true);
    });

    it('does not excuse a runner command with flags, npx, pnpm or run', () => {
      expect(flagged('Run npx vitest run --coverage, see `ts-test`', 'runner name')).toBe(true);
      expect(flagged('pytest -q, see `py-test`', 'runner name')).toBe(true);
      expect(flagged('pnpm vitest, see `ts-test`', 'runner name')).toBe(true);
      expect(flagged('uv run pytest, see `py-test`', 'runner name')).toBe(true);
      expect(flagged('Run jest, see `references/a.md`', 'runner name')).toBe(true);
    });

    it('does not excuse dotnet test, package commands, config, naming or mocking', () => {
      expect(flagged('`dotnet test`, see `dotnet-test`', 'dotnet test')).toBe(true);
      expect(flagged('`npm test`, see `ts-test`', 'package test command')).toBe(true);
      expect(flagged('vitest.config.ts, see `ts-test`', 'runner config')).toBe(true);
      expect(flagged('conftest.py, see `py-test`', 'runner config')).toBe(true);
      expect(flagged('user.test.ts, see `ts-test`', 'test file naming')).toBe(true);
      expect(flagged('vi.fn(), see `ts-test`', 'mocking api')).toBe(true);
      expect(flagged('Moq, see `dotnet-test`', 'mocking api')).toBe(true);
      expect(flagged('Shouldly, see `dotnet-test`', 'assertion library')).toBe(true);
    });
  });

  it('handles CRLF files with the right line number', () => {
    const f = path.join(tmpDir, 'crlf-SKILL.md');
    fs.writeFileSync(
      f,
      '---\r\nname: x-implementation\r\ndescription: d\r\n---\r\n# X\r\n\r\nUse Moq.\r\n',
    );
    const v = checkTestDuplicates([f]);
    expect(v).toHaveLength(1);
    expect(v[0].line).toBe(7);
    expect(v[0].text).toBe('Use Moq.');
  });

  it('scans a file without frontmatter from line 1', () => {
    const f = path.join(tmpDir, 'plain-SKILL.md');
    fs.writeFileSync(f, 'Use Moq.\nclean\n');
    const v = checkTestDuplicates([f]);
    expect(v).toHaveLength(1);
    expect(v[0].line).toBe(1);
  });

  it('exports an explicit pattern list', () => {
    expect(TEST_DUPLICATE_PATTERNS.length).toBeGreaterThan(5);
  });
});

describe('live repo test duplicate check', () => {
  it('no *-implementation SKILL.md duplicates test runner commands or config', () => {
    const files = findImplementationSkillFiles(path.resolve(__dirname, '../../packages'));
    expect(files.length).toBeGreaterThanOrEqual(4);
    const v = checkTestDuplicates(files);
    const msg = v.map((x) => `${x.filePath}:${x.line} [${x.pattern}] ${x.text}`).join('\n');
    expect(v, `Move this content to the <lang>-test skill.\n${msg}`).toEqual([]);
  });
});
