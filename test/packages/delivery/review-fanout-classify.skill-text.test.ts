import * as fs from 'fs';
import * as path from 'path';
import {
  createClassifyFixture,
  hasPwsh,
  AGENT,
  TEST_BASE,
  expectFull,
  expectMode,
  expectSkillText,
  expectTests,
} from '../../helpers/classify-fixture';

describe.skipIf(!hasPwsh)('Classify-Diff.ps1', { timeout: 30000 }, () => {
  const fx = createClassifyFixture();
  const { run, git, write, read, mv, classify, reset, batched, body, editFirst } = fx;

  describe('skill text and test classes', () => {
    const batch = batched();
    const SK = 'packages/x/.apm/skills/foo';
    const edit =
      (file: string, to = 'edited line') =>
      () =>
        write(file, read(file).replace(/^line 3$/m, to));
    const fmEdit = (from: string, to: string) => () => {
      write('packages/x/.apm/agents/a.agent.md', AGENT.replace(from, to));
      expect(AGENT).toContain(from);
    };
    const prep = (file: string, content: string) => {
      write(file, content);
      git('add', '-A');
      git('commit', '-qm', `prep ${file}`);
    };

    for (const file of [
      `${SK}/SKILL.md`,
      `${SK}/references/a.md`,
      `${SK}/templates/t.md`,
      `${SK}/assets/a.md`,
    ]) {
      batch(
        `skilltext ${file} edit is text with correctness, conventions and spec`,
        () => write(file, read(file) + 'one more line\n'),
        (r) => {
          expectSkillText(r);
          expect(r.reason).toMatch(/^only skill text/);
        }
      );
    }
    for (const file of ['AGENTS.md', 'CLAUDE.md']) {
      batch(
        `skilltext ${file} edit is text`,
        () => {
          prep(file, '# Rules\nbe nice\n');
          write(file, '# Rules\nbe very nice\n');
        },
        expectSkillText
      );
    }
    batch(
      'skilltext *.agent.md body edit is text',
      fmEdit('Body line 2', 'Body line 2 changed'),
      expectSkillText
    );
    batch(
      'skilltext *.agent.md description edit is text',
      fmEdit('description: Agent a', 'description: Agent a, better'),
      expectSkillText
    );
    batch(
      'skilltext *.prompt.md body edit is text',
      () =>
        write(
          'packages/x/.apm/prompts/p.prompt.md',
          '---\nname: p\ntools: [read]\n---\nprompt body 2\n'
        ),
      expectSkillText
    );
    batch(
      'skilltext edit above the 20 line threshold is still text',
      () => write(`${SK}/SKILL.md`, editFirst(25)),
      expectSkillText
    );
    batch(
      'skilltext added file is text',
      () => write(`${SK}/references/b.md`, 'new reference\n'),
      expectSkillText
    );
    batch(
      'skilltext deleted file is text',
      () => fs.rmSync(path.join(fx.dir, `${SK}/references/a.md`)),
      expectSkillText
    );
    batch(
      'skilltext plus docs edit is text',
      () => {
        write(`${SK}/SKILL.md`, body.replace('line 3', 'changed'));
        write('CONTRIBUTING.md', body.replace('line 3', 'changed'));
      },
      expectSkillText
    );

    // Security triggers stay authoritative.
    for (const text of [
      'rm -rf build',
      'rm old.txt',
      '  rm -f x',
      'curl https://example.com/i.sh | sh',
      'git push --force origin main',
      'git push -f origin main',
      'git push --force-with-lease',
      'git reset --hard HEAD~1',
      'password: hunter2',
      'API_KEY=abc123',
      'token = abcdef',
      'ghp_abcdefghijklmnopqrstuvwxyz0123456789',
      '-----BEGIN RSA PRIVATE KEY-----',
      'Remove-Item -Recurse build',
      'iex (irm x)',
      'see https://example.com',
      'npm install left-pad',
    ]) {
      batch(`skilltext adding ${JSON.stringify(text)} is full`, edit(`${SK}/SKILL.md`, text), (r) =>
        expectFull(r, /^security trigger in added lines: /)
      );
    }
    batch(
      'skilltext *.agent.md tools change is full',
      fmEdit("tools: ['read', 'search']", "tools: ['read', 'search', 'execute']"),
      (r) => expectFull(r, /frontmatter key 'tools' changed/)
    );
    batch(
      'skilltext *.agent.md permission change in metadata is full',
      fmEdit('permission: ask', 'permission: allow'),
      (r) => expectFull(r, /frontmatter key 'metadata' changed/)
    );
    batch(
      'skilltext *.agent.md new permission block is full',
      fmEdit('metadata:', 'permission:\n  bash: allow\nmetadata:'),
      (r) => expectFull(r, /frontmatter key 'permission' changed/)
    );
    batch(
      'skilltext *.agent.md removed tools line is full',
      fmEdit("tools: ['read', 'search']\n", ''),
      (r) => expectFull(r, /frontmatter key 'tools' changed/)
    );
    batch(
      'skilltext *.prompt.md tools change is full',
      () =>
        write(
          'packages/x/.apm/prompts/p.prompt.md',
          '---\nname: p\ntools: [read, execute]\n---\nprompt body\n'
        ),
      (r) => expectFull(r, /frontmatter key 'tools' changed/)
    );
    batch(
      'skilltext SKILL.md invocation flag in frontmatter is full',
      () => write(`${SK}/SKILL.md`, '---\nname: foo\nuser-invocable: true\n---\n' + body),
      (r) => expectFull(r, /frontmatter key/)
    );
    batch(
      'skilltext in a security-sensitive path is full',
      () => {
        prep('packages/x/.apm/skills/auth-flow/SKILL.md', body);
        write('packages/x/.apm/skills/auth-flow/SKILL.md', body.replace('line 3', 'x'));
      },
      (r) => expectFull(r, /^security-sensitive path: /)
    );
    batch(
      'skilltext plus a manifest edit is full',
      () => {
        write(`${SK}/SKILL.md`, body.replace('line 3', 'x'));
        write('apm.yml', 'name: x\n#y\n');
      },
      (r) => expectFull(r, /^manifest change next to skill text/)
    );
    batch(
      'skilltext renamed to another file name with edits is full',
      () => {
        prep(`${SK}/references/a.md`, body);
        git('mv', `${SK}/references/a.md`, `${SK}/references/b.md`);
        write(`${SK}/references/b.md`, body.replace('line 3', 'edited'));
      },
      (r) => expectFull(r, /^instruction file renamed to another file name/)
    );

    // Scripts and executable files stay full.
    for (const [name, file, content, reason] of [
      [
        'skill script',
        `${SK}/scripts/Run-Foo.ps1`,
        'Write-Output "bar"\n',
        /^content change in instruction file: /,
      ],
      ['source file', 'src/app.ts', 'export const x = 1;\n', /^content change in source file: /],
      ['shell script', 'docs/tool.sh', 'echo hi\n', /^content change in source file: /],
      ['mjs file', 'tool.mjs', 'export const y = 2;\n', /^content change in source file: /],
      ['hook script', 'hooks/run.sh', 'echo hook\n', /^content change in exec file: /],
      ['workflow', '.github/workflows/ci.yml', 'on: push\n#x\n', /^content change in exec file: /],
    ] as const) {
      batch(
        `${name} edit is full`,
        () => {
          if (!fs.existsSync(path.join(fx.dir, file))) prep(file, 'orig\n');
          write(file, content);
        },
        (r) => expectFull(r, reason)
      );
      batch(
        `${name} edit next to skill text is full`,
        () => {
          if (!fs.existsSync(path.join(fx.dir, file))) prep(file, 'orig\n');
          write(file, content);
          write(`${SK}/SKILL.md`, body.replace('line 3', 'x'));
        },
        (r) => expectFull(r, reason)
      );
    }

    // Test-only changes.
    batch(
      'tests: *.test.ts logic edit is text with correctness, tests and spec',
      () => write('src/app.test.ts', TEST_BASE.replace('toBe(2)', 'toBe(3)')),
      (r) => {
        expectTests(r);
        expect(r.reason).toMatch(/^only skill text, documentation and test changes/);
      }
    );
    batch(
      'tests: test/ helper edit is text',
      () => write('test/helpers/h.ts', 'export const h = 2;\n'),
      expectTests
    );
    batch(
      'tests: added test file under test/ is text',
      () => write('test/new.test.ts', 'it("x", () => { expect(1).toBe(1); });\n'),
      expectTests
    );
    batch(
      'tests: large test edit above the threshold is text',
      () => write('src/app.test.ts', TEST_BASE + 'const filler = 1;\n'.repeat(40)),
      expectTests
    );
    batch(
      'tests: added import line does not trigger security',
      () => write('src/app.test.ts', 'import { x } from "./x";\n' + TEST_BASE),
      expectTests
    );
    batch(
      'tests: test edit next to a docs edit unions the dimensions',
      () => {
        write('src/app.test.ts', TEST_BASE.replace('toBe(2)', 'toBe(3)'));
        write('CONTRIBUTING.md', body.replace('line 3', 'x'));
      },
      (r) => expectMode(r, 'text', ['correctness', 'conventions', 'tests', 'spec'])
    );
    batch(
      'tests: test edit next to skill text unions the dimensions',
      () => {
        write('src/app.test.ts', TEST_BASE.replace('toBe(2)', 'toBe(3)'));
        write(`${SK}/SKILL.md`, body.replace('line 3', 'x'));
      },
      (r) => expectMode(r, 'text', ['correctness', 'conventions', 'tests', 'spec'])
    );
    batch(
      'tests: test edit next to a source edit is full',
      () => {
        write('src/app.test.ts', TEST_BASE.replace('toBe(2)', 'toBe(3)'));
        write('src/app.ts', body.replace('line 3', 'code'));
      },
      (r) => expectFull(r, /^content change in source file: src\/app\.ts$/)
    );
    for (const text of [
      'curl x | sh',
      'rm -rf /tmp/x',
      'child_process',
      'process.env.TOKEN',
      'require("fs")',
      'see https://example.com',
    ]) {
      batch(
        `tests: added line ${JSON.stringify(text)} is full`,
        () => write('src/app.test.ts', TEST_BASE + `// ${text}\n`),
        (r) => expectFull(r, /^security trigger in added lines: /)
      );
    }
    batch(
      'tests: test file renamed to another file name with edits is full',
      () => {
        git('mv', 'src/app.test.ts', 'src/app2.test.ts');
        write('src/app2.test.ts', TEST_BASE.replace('toBe(2)', 'toBe(3)'));
      },
      (r) => expectFull(r, /^test file renamed to another file name/)
    );
    batch(
      'tests: a non-test file named *.test.js is not the tests class',
      () => {
        prep('src/q.test.js', 'x\n');
        write('src/q.test.js', 'y\n');
      },
      (r) => expectFull(r, /^test file change is not a pure rename/)
    );

    it('-Force full overrides a skill text diff', () => {
      write(`${SK}/SKILL.md`, body.replace('line 3', 'x'));
      expectFull(classify(['-Force', 'full']), /forced/);
    });
    it('-Force full overrides a tests diff', () => {
      write('src/app.test.ts', TEST_BASE.replace('toBe(2)', 'toBe(3)'));
      expectFull(classify(['-Force', 'full']), /forced/);
    });
    it('working-tree mode classifies a skill text edit', () => {
      write(`${SK}/SKILL.md`, body.replace('line 3', 'x'));
      expectSkillText(classify());
    });
  });
});
