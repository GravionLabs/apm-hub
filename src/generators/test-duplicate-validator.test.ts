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
  fs.writeFileSync(file, `---\nname: ${name}\ndescription: 'Rules (vitest, pytest).'\n---\n${body}`);
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
    ['runner command', '```\nnpx vitest run\n```'],
    ['runner command (pytest)', 'Run `pytest -q` to check.'],
    ['runner command (dotnet test)', '`dotnet test --no-build`'],
    ['runner config', 'Add a vitest.config.ts with globals.'],
    ['runner config (jest)', 'See jest.config.js for setup.'],
    ['framework (xUnit)', 'Use xUnit for tests.'],
    ['framework (NUnit)', 'Use NUnit for tests.'],
    ['naming (ts)', 'Name files user.test.ts next to the source.'],
    ['naming (py)', 'Name files test_user.py in tests/.'],
    ['naming (cs)', 'Name classes OrderServiceTests.cs.'],
    ['mocking (vi.fn)', 'Stub with vi.fn() and vi.mock.'],
    ['mocking (pytest-mock)', 'Install pytest-mock for the mocker fixture.'],
    ['mocking (NSubstitute)', 'Use NSubstitute for fakes.'],
    ['assertions (Shouldly)', 'Assert with Shouldly.'],
  ];

  it.each(families)('flags %s', (_family, line) => {
    const f = skill(`# X\n\n${line}\n`);
    const v = checkTestDuplicates([f]);
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].filePath).toBe(f);
  });

  it('reports the 1-based line number in the file', () => {
    const f = skill('# X\n\nUse NSubstitute.\n');
    expect(checkTestDuplicates([f])[0].line).toBe(7);
  });

  it('flags bare runner names without a pointer', () => {
    expect(checkTestDuplicates([skill('# X\n\nWe use Vitest here.\n')])).toHaveLength(1);
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
