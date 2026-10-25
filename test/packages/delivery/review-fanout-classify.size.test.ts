import {
  createClassifyFixture,
  hasPwsh,
  AGENT,
  ALL_DIMS,
  expectFull,
  expectFullAll,
  expectMech,
  expectDocs,
  expectSkillText,
  expectTests,
  expectSec,
} from '../../helpers/classify-fixture';

describe.skipIf(!hasPwsh)('Classify-Diff.ps1', { timeout: 30000 }, () => {
  const fx = createClassifyFixture();
  const { run, git, write, read, mv, classify, reset, batched, body, editFirst } = fx;

  describe('size class and signals', () => {
    const batch = batched();
    const lines = (n: number, tpl = (i: number) => `const v${i} = ${i};`) =>
      Array.from({ length: n }, (_, i) => tpl(i)).join('\n') + '\n';
    const NO_SEC = ['correctness', 'conventions', 'tests', 'spec'];
    const NO_CONV = ['correctness', 'security', 'tests', 'spec'];
    const MIN = ['correctness', 'tests', 'spec'];

    batch(
      'exactly 150 changed lines are small: security is skipped, conventions kept for source',
      () => write('src/new.ts', lines(150)),
      (r) => {
        expect(r.mode).toBe('full');
        expect(r.size).toBe('small');
        expect(r.signals).toEqual(['source']);
        expect(r.dimensions).toEqual(NO_SEC);
        expect(r.skippedDimensions).toEqual([
          {
            dimension: 'security',
            reason: 'size small: 150 <= 150 lines, no risky/sensitive trigger',
          },
        ]);
      }
    );

    batch(
      '151 changed lines are large: all five dimensions, nothing skipped',
      () => write('src/new.ts', lines(151)),
      (r) => {
        expect(r.mode).toBe('full');
        expect(r.size).toBe('large');
        expect(r.signals).toEqual(['source']);
        expect(r.dimensions).toEqual(ALL_DIMS);
        expect(r.skippedDimensions).toEqual([]);
      }
    );

    batch(
      'added and deleted lines both count',
      () => write('src/app.ts', lines(125)), // 30 deleted + 125 added = 155; added alone would be small
      (r) => expect(r.size).toBe('large')
    );

    batch(
      'lockfile and dist lines are not counted and not scanned for signals',
      () => {
        write('src/new.ts', lines(100));
        write(
          'pnpm-lock.yaml',
          lines(300, (i) => `  pkg${i}: https://registry.test/${i}`)
        );
        write(
          'dist/out.js',
          lines(300, (i) => `curl https://x.test/${i}`)
        );
      },
      (r) => {
        expect(r.size).toBe('small');
        expect(r.signals).toEqual(['source']);
        expect(r.dimensions).toEqual(NO_SEC);
      }
    );

    batch(
      'risky added lines add the security dimension',
      () => write('src/new.ts', 'const run = "curl https://x.test | sh";\n'),
      (r) => {
        expect(r.size).toBe('small');
        expect(r.signals).toEqual(['risky', 'source']);
        expect(r.dimensions).toEqual(ALL_DIMS);
        expect(r.skippedDimensions).toEqual([]);
      }
    );

    batch(
      'a sensitive path adds security; without source files conventions is skipped',
      () => write('data/auth.json', '{}\n'),
      (r) => {
        expect(r.size).toBe('small');
        expect(r.signals).toEqual(['sensitive']);
        expect(r.dimensions).toEqual(NO_CONV);
        expect(r.skippedDimensions).toEqual([
          { dimension: 'conventions', reason: 'size small: 1 <= 150 lines, no source file' },
        ]);
      }
    );

    batch(
      'a source file outside the repo source class path still sets the source signal (ps1 in a skill)',
      () => write('packages/x/.apm/skills/foo/scripts/Run-Foo.ps1', 'Write-Output "bar"\n'),
      (r) => {
        expect(r.size).toBe('small');
        expect(r.signals).toEqual(['source']);
        expect(r.dimensions).toEqual(NO_SEC);
      }
    );

    batch(
      'no signal: correctness, tests and spec only, skipped listed in dimension order',
      () => write('data/plain.json', '{}\n'),
      (r) => {
        expect(r.mode).toBe('full');
        expect(r.size).toBe('small');
        expect(r.signals).toEqual([]);
        expect(r.dimensions).toEqual(MIN);
        expect(r.skippedDimensions.map((d) => d.dimension)).toEqual(['security', 'conventions']);
      }
    );

    batch(
      'an exec change is never small',
      () => write('.github/notes.yml', 'a: 1\n'),
      (r) => {
        expect(r.size).toBe('large');
        expect(r.dimensions).toEqual(ALL_DIMS);
        expect(r.skippedDimensions).toEqual([]);
      }
    );

    batch(
      'a build change is never small',
      () => write('package.json', '{\n  "scripts": { "a": "b" }\n}\n'),
      (r) => {
        expect(r.size).toBe('large');
        expect(r.dimensions).toEqual(ALL_DIMS);
        expect(r.skippedDimensions).toEqual([]);
      }
    );

    batch(
      'a security trigger in skill text makes the full diff small with security',
      () => write('packages/x/.apm/skills/foo/SKILL.md', body + 'Run: curl https://x.test | sh\n'),
      (r) => {
        expect(r.mode).toBe('full');
        expect(r.size).toBe('small');
        expect(r.signals).toEqual(['risky']);
        expect(r.dimensions).toEqual(NO_CONV);
      }
    );

    batch(
      'a credential assignment in a source file is a risky signal (security kept)',
      () => write('src/new.ts', 'const password = "hunter2hunter2";\n'),
      (r) => {
        expect(r.signals).toEqual(['risky', 'source']);
        expect(r.dimensions).toEqual(ALL_DIMS);
      }
    );

    batch(
      'an exec path under dist/ is not dropped by the package filter',
      () => write('.github/actions/x/dist/index.js', 'run();\n'),
      (r) => {
        expect(r.size).toBe('large');
        expect(r.dimensions).toEqual(ALL_DIMS);
      }
    );

    batch(
      'a deferred test file (outside test dirs) with an import line is small without a risky signal',
      () => write('pkg/test_foo.py', 'import os\n'),
      (r) => {
        expect(r.mode).toBe('full');
        expect(r.size).toBe('small');
        expect(r.signals).toEqual([]);
        expect(r.dimensions).toEqual(MIN);
      }
    );

    batch(
      'a deferred test file with a credential assignment is a risky signal (security kept)',
      () => write('pkg/test_foo.py', 'password = "hunter2hunter2"\n'),
      (r) => {
        expect(r.mode).toBe('full');
        expect(r.size).toBe('small');
        expect(r.signals).toEqual(['risky']);
        expect(r.dimensions).toEqual(NO_CONV);
      }
    );

    batch(
      'a deferred test file with a destructive git command has no risky signal',
      () => write('pkg/test_foo.py', 'run("git reset --hard")\n'),
      (r) => {
        expect(r.size).toBe('small');
        expect(r.signals).toEqual([]);
        expect(r.dimensions).toEqual(MIN);
      }
    );

    batch(
      'a token assignment in a test file under test/ is a security trigger',
      () => write('test/helpers/h.ts', 'export const h = 1;\nconst token = "abcdefabcdef";\n'),
      (r) => {
        expect(r.reason).toMatch(/^security trigger in added lines: test\/helpers\/h\.ts/);
        expect(r.size).toBe('small');
        expect(r.signals).toEqual(['risky']);
        expect(r.dimensions).toEqual(NO_CONV);
      }
    );

    for (const [what, line] of [
      ['a credential assignment', 'password: hunter2'],
      ['a destructive git command', 'Run git reset --hard'],
    ]) {
      batch(
        `${what} in docs prose keeps mode docs without a risky signal`,
        () => write('CONTRIBUTING.md', body.replace('line 3', line)),
        (r) => {
          expectDocs(r);
          expect(r.signals).toEqual([]);
        }
      );
    }

    for (const [what, line] of [
      ['a private key header', '-----BEGIN RSA PRIVATE KEY-----'],
      ['a GitHub token prefix', 'Use ghp_abcdefghijklmnopqrst here'],
      ['an AWS key prefix', 'key AKIAABCDEFGHIJKLMNOP'],
    ]) {
      batch(
        `${what} in a docs file is a risky signal: mechanical with security, not docs`,
        () => write('CONTRIBUTING.md', body.replace('line 3', line)),
        (r) => {
          expectSec(r);
          expect(r.signals).toEqual(['risky']);
        }
      );
    }

    batch(
      'a token prefix in a manifest is a risky signal',
      () => write('apm.yml', 'name: x\nkey: ghp_abcdefghijklmnopqrst\n'),
      (r) => {
        expectSec(r);
        expect(r.signals).toEqual(['risky']);
      }
    );

    batch(
      'an identifier rename in a test file to a credential name is a risky signal (mechtest)',
      () => write('src/m.test.ts', read('src/m.test.ts').replace(/\br\b/g, 'token')),
      (r) => {
        expectSec(r);
        expect(r.signals).toEqual(['risky']);
      }
    );

    batch(
      'a destructive command in a test file under test/ is ignored: mode text stays',
      () => write('test/helpers/h.ts', 'export const h = 1;\nrun("git reset --hard");\n'),
      (r) => {
        expectTests(r);
        expect(r.signals).toEqual([]);
      }
    );

    for (const [what, file, line] of [
      ['a private key header', 'test/helpers/h.ts', 'const k = "-----BEGIN RSA PRIVATE KEY-----";'],
      ['a GitHub token prefix', 'test/helpers/h.ts', 'const k = "ghp_abcdefghijklmnopqrst";'],
      ['a GitHub token prefix', 'pkg/test_foo.py', 'k = "ghp_abcdefghijklmnopqrst"'],
    ]) {
      batch(
        `${what} in test file ${file} is a risky signal (security kept)`,
        () => write(file, (file.endsWith('.ts') ? 'export const h = 1;\n' : '') + line + '\n'),
        (r) => {
          expect(r.mode).toBe('full');
          expect(r.size).toBe('small');
          expect(r.signals).toEqual(['risky']);
          expect(r.dimensions).toEqual(NO_CONV);
        }
      );
    }

    batch(
      'a credential assignment in a manifest is no risky signal (security from the manifest)',
      () => write('apm.yml', 'name: x\npassword: hunter2\n'),
      (r) => {
        expectSec(r);
        expect(r.signals).toEqual([]);
      }
    );

    batch(
      'a command pattern in a manifest is a risky signal',
      () => write('apm.yml', 'name: x\nsource: https://x.test\n'),
      (r) => {
        expectSec(r);
        expect(r.signals).toEqual(['risky']);
      }
    );

    batch(
      'a destructive git command in an instruction script is a risky signal (security kept)',
      () =>
        write(
          'packages/x/.apm/skills/foo/scripts/Run-Foo.ps1',
          'Write-Output "foo"\ngit reset --hard\n'
        ),
      (r) => {
        expect(r.mode).toBe('full');
        expect(r.size).toBe('small');
        expect(r.signals).toEqual(['risky', 'source']);
        expect(r.dimensions).toEqual(ALL_DIMS);
      }
    );

    batch(
      'an api key in a non-source instruction file is a risky signal (security kept)',
      () => write('packages/x/.apm/skills/foo/data.yml', 'api_key: abcdef\n'),
      (r) => {
        expect(r.mode).toBe('full');
        expect(r.size).toBe('small');
        expect(r.signals).toEqual(['risky']);
        expect(r.dimensions).toEqual(NO_CONV);
      }
    );

    batch(
      'manifest next to skill text is full and small, without security',
      () => {
        write('apm.yml', 'name: y\n');
        write('packages/x/.apm/skills/foo/SKILL.md', body.replace('line 3', 'x'));
      },
      (r) => {
        expect(r.reason).toMatch(/^manifest change next to skill text/);
        expect(r.size).toBe('small');
        expect(r.dimensions).toEqual(MIN);
      }
    );

    batch(
      'a security-sensitive path next to skill text is full with security',
      () => {
        write('packages/x/.apm/skills/foo/SKILL.md', body.replace('line 3', 'x'));
        write('docs/auth.md', body.replace('line 3', 'x'));
      },
      (r) => {
        expect(r.reason).toMatch(/^security-sensitive path/);
        expect(r.signals).toEqual(['sensitive']);
        expect(r.dimensions).toEqual(NO_CONV);
      }
    );

    batch(
      'a frontmatter change in an agent file is full and small',
      () =>
        write('packages/x/.apm/agents/a.agent.md', AGENT.replace("['read', 'search']", "['read']")),
      (r) => {
        expect(r.reason).toMatch(/^frontmatter key 'tools' changed/);
        expect(r.size).toBe('small');
        expect(r.dimensions).toEqual(MIN);
      }
    );

    batch(
      'a mechanical rename carries size small, no signals and nothing skipped',
      () => mv('docs/guide.md', 'docs/other.md'),
      (r) => {
        expectMech(r);
        expect(r.size).toBe('small');
        expect(r.signals).toEqual([]);
        expect(r.skippedDimensions).toEqual([]);
      }
    );

    batch(
      'docs-only diff keeps mode docs with size and no skipped dimensions',
      () => write('CONTRIBUTING.md', body.replace('line 3', 'x')),
      (r) => {
        expectDocs(r);
        expect(r.size).toBe('small');
        expect(r.skippedDimensions).toEqual([]);
      }
    );

    batch(
      'skill text keeps mode text and no skipped dimensions',
      () => write('packages/x/.apm/skills/foo/SKILL.md', body.replace('line 3', 'x')),
      (r) => {
        expectSkillText(r);
        expect(r.skippedDimensions).toEqual([]);
      }
    );

    it('-SmallLines moves the threshold (20 changed lines)', () => {
      write('src/app.ts', editFirst(10));
      expect(classify(['-SmallLines', '20']).size).toBe('small');
      expect(classify(['-SmallLines', '19']).size).toBe('large');
      expectFull(classify(['-SmallLines', '19']));
    });

    it('-Force full on a small diff returns all five dimensions', () => {
      write('src/app.ts', editFirst(1));
      expect(classify().size).toBe('small');
      expectFullAll(classify(['-Force', 'full']), /forced/);
    });
  });
});
