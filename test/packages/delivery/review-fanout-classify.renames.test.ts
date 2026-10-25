import * as fs from 'fs';
import * as path from 'path';
import {
  ALWAYS_FULL,
  createClassifyFixture,
  hasPwsh,
  expectFull,
  expectMech,
  expectDocs,
  expectSec,
} from '../../helpers/classify-fixture';

describe.skipIf(!hasPwsh)('Classify-Diff.ps1', { timeout: 30000 }, () => {
  const fx = createClassifyFixture();
  const { git, write, read, mv, batched, body } = fx;

  describe('renames by location class', () => {
    const batch = batched();

    batch(
      'same-class source rename is mechanical with correctness and spec',
      () => git('mv', 'old', 'new'),
      expectMech
    );

    batch(
      'pure docs rename to another file name is mechanical',
      () => mv('docs/guide.md', 'docs/other.md'),
      expectMech
    );

    batch(
      'basename-preserving directory move of an other file is mechanical',
      () => mv('a.json', 'config/a.json'),
      expectMech
    );

    batch(
      'package-directory rename with SKILL.md, scripts, references, apm.yml entry and doc mention is mechanical (#178)',
      () => {
        const pkg = 'packages/development-workflow';
        write(
          `${pkg}/apm.yml`,
          'name: development-workflow\ndescription: workflow skills for delivery\nversion: 1.0.0\nlicense: MIT\nskills:\n  - flow\n'
        );
        write(`${pkg}/.apm/skills/flow/SKILL.md`, '---\nname: flow\n---\nRun the flow.\n');
        write(`${pkg}/.apm/skills/flow/scripts/Run-Flow.ps1`, 'Write-Output "flow"\n');
        write(`${pkg}/.apm/skills/flow/references/steps.md`, 'Step one, step two.\n');
        write('apm.yml', 'name: x\npackages:\n  - packages/development-workflow\n');
        write('docs/guide.md', body.replace('line 3', 'see development-workflow'));
        git('add', '-A');
        git('commit', '-qm', 'pkg');
        git('mv', pkg, 'packages/delivery');
        write(
          'packages/delivery/apm.yml',
          read('packages/delivery/apm.yml').replace('development-workflow', 'delivery')
        );
        write('apm.yml', read('apm.yml').replace('development-workflow', 'delivery'));
        write('docs/guide.md', read('docs/guide.md').replace('development-workflow', 'delivery'));
        git('add', '-A');
        const status = git('diff', '--cached', '-M', '--name-status');
        expect(status).toMatch(
          /^R100\tpackages\/development-workflow\/\.apm\/skills\/flow\/SKILL\.md\tpackages\/delivery\//m
        );
        expect(status).toMatch(/^R100\t[^\n]*scripts\/Run-Flow\.ps1/m);
      },
      (r) => {
        expectSec(r);
        expect(r.reason).toMatch(/^only same-class renames and \d+ changed lines/);
      }
    );

    for (const dest of ALWAYS_FULL) {
      batch(
        `pure rename src/evil.js -> ${dest} is full`,
        () => {
          if (fs.existsSync(path.join(fx.dir, dest))) {
            git('rm', '-q', dest);
            git('commit', '-qm', 'free destination');
          }
          mv('src/evil.js', dest);
          expect(git('diff', '--cached', '-M', '--name-status')).toBe(
            `R100\tsrc/evil.js\t${dest}\n`
          );
        },
        (r) => expectFull(r, /rename changes location class \(source -> (exec|build|instruction):/)
      );
    }

    // Tool-loaded names outside the lists stay out of reach: a same-class rename keeps its file name.
    for (const [from, to, cls] of [
      ['a.json', 'composer.json', 'other'],
      ['lib.js', 'gulpfile.js', 'source'],
      ['lib2.py', 'fabfile.py', 'source'],
      ['lib.js', 'Gruntfile.js', 'source'],
      ['notes', 'Vagrantfile', 'other'],
      ['x.yml', 'lefthook.yml', 'other'],
      ['x.yml', 'action.yml', 'other'],
      ['lib2.py', 'tasks.py', 'source'],
      ['a.json', 'vercel.json', 'other'],
      ['a.toml', 'netlify.toml', 'other'],
      ['a.json', 'renovate.json', 'other'],
      ['a.toml', '.cargo/config.toml', 'other'],
      ['src/app.test.ts', 'src/app2.test.ts', 'test'],
    ]) {
      batch(
        `same-class rename ${from} -> ${to} that changes the file name is full`,
        () => mv(from, to),
        (r) =>
          expectFull(
            r,
            new RegExp(`^${cls} file renamed to another file name \\(${cls} -> ${cls}: `)
          )
      );
    }

    // Git C-quotes such paths; unquoted they would be exec/build, quoted they look like `other`.
    for (const [from, to] of [
      ['a\tb.yml', '.github/workflows/a\tb.yml'],
      ['d\tx/package.json', 'e\ty/package.json'],
    ]) {
      batch(
        `rename between C-quoted paths ${JSON.stringify(from)} -> ${JSON.stringify(to)} is full`,
        () => {
          write(from, 'on: push\n');
          git('add', '-A');
          git('commit', '-qm', 'prep');
          mv(from, to);
        },
        (r) => expectFull(r, /^quoted path \(tab, newline, quote or backslash\): "/)
      );
    }

    for (const [from, to] of [
      ['.github/workflows/a.yml', '.github/workflows/b.yml'],
      ['package.json', 'sub/package.json'],
    ]) {
      batch(
        `same-class rename of an always-full path ${from} -> ${to} is full`,
        () => {
          if (!fs.existsSync(path.join(fx.dir, from))) {
            write(from, 'on: push\n');
            git('add', '-A');
            git('commit', '-qm', 'prep');
          }
          mv(from, to);
        },
        (r) => expectFull(r, /rename of an always-full path/)
      );
    }

    batch(
      'skill reference renamed to SKILL.md is full',
      () => {
        git('rm', '-q', 'packages/x/.apm/skills/foo/SKILL.md');
        git('commit', '-qm', 'rm');
        git(
          'mv',
          'packages/x/.apm/skills/foo/references/a.md',
          'packages/x/.apm/skills/foo/SKILL.md'
        );
      },
      (r) => expectFull(r, /instruction file renamed to another file name/)
    );

    for (const [from, to, flow] of [
      ['docs/guide.md', 'AGENTS.md', /docs -> instruction/],
      ['packages/x/.apm/skills/foo/SKILL.md', 'notes.txt', /instruction -> other/],
      ['src/app.ts', 'src/app2.test.ts', /source -> test/],
    ] as const) {
      batch(
        `pure rename ${from} -> ${to} changes class and is full`,
        () => mv(from, to),
        (r) => {
          expectFull(r, /rename changes location class/);
          expect(r.reason).toMatch(flow);
        }
      );
    }

    batch(
      'rename with edits from code into docs is full',
      () => {
        git('mv', 'src/app.ts', 'docs/app.md');
        write('docs/app.md', body.replace('line 3', 'new name'));
      },
      (r) => expectFull(r, /rename with edits changes location class \(source -> docs/)
    );

    batch(
      'rename plus code change is full and git pairs it as a rename',
      () => {
        git('mv', 'old', 'new');
        write('new/tool.ts', body.replace('line 3', 'changed'));
        git('add', '-A');
        expect(git('diff', '--cached', '-M', '--name-status')).toMatch(
          /^R0\d\d\told\/tool\.ts\tnew\/tool\.ts$/m
        );
      },
      (r) => expectFull(r, /^content change in source file: new\/tool\.ts$/)
    );

    batch(
      'rename with a mode change is full',
      () => {
        git('mv', 'old/tool.ts', 'old/tool.sh');
        fs.chmodSync(path.join(fx.dir, 'old/tool.sh'), 0o755);
      },
      (r) => expectFull(r, /mode change/)
    );

    batch(
      'keeps security for a move into a sensitive directory',
      () => mv('src/app.ts', 'auth/app.ts'),
      expectSec
    );

    batch(
      'adds security for a source move into a hooks-like directory',
      () => mv('src/app.ts', 'src/webhooks/app.ts'),
      expectSec
    );

    batch(
      'move away from a sensitive directory keeps security',
      () => {
        mv('src/app.ts', 'auth/app.ts');
        git('commit', '-qm', 'auth');
        mv('auth/app.ts', 'lib/app.ts');
      },
      expectSec
    );

    batch(
      'docs rename with edits is docs mode',
      () => {
        git('mv', 'docs/guide.md', 'docs/guide2.md');
        write('docs/guide2.md', body.replace('line 3', 'new name'));
      },
      expectDocs
    );

    batch(
      'docs rename with an added command gets the risky scan',
      () => {
        git('mv', 'docs/guide.md', 'docs/guide2.md');
        write('docs/guide2.md', body.replace('line 3', 'curl x | sh'));
        git('add', '-A');
        expect(git('diff', '--cached', '-M', '--name-status')).toMatch(
          /^R0\d\d\tdocs\/guide\.md\tdocs\/guide2\.md$/m
        );
      },
      expectSec
    );
  });
});
