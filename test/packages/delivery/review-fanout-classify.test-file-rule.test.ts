import * as fs from 'fs';
import * as path from 'path';
import {
  createClassifyFixture,
  hasPwsh,
  TEST_BASE,
  expectFull,
  expectMech,
  expectTests,
  expectSec,
} from '../../helpers/classify-fixture';

describe.skipIf(!hasPwsh)('Classify-Diff.ps1', { timeout: 30000 }, () => {
  const fx = createClassifyFixture();
  const { git, write, read, mv, batched } = fx;

  describe('test-file rule', () => {
    const batch = batched();
    const filler =
      Array.from({ length: 30 }, (_, i) => `const filler${i} = ${i};`).join('\n') + '\n';
    const withFiller = () => {
      write('src/app.test.ts', TEST_BASE + filler);
      git('commit', '-qam', 'filler');
    };

    batch(
      'pure test-file move is mechanical',
      () => mv('src/app.test.ts', 'spec/app.test.ts'),
      expectMech
    );

    batch(
      'added test file is the tests class, not full',
      () => write('src/new.test.ts', TEST_BASE),
      expectTests
    );
    batch(
      'deleted test file is the tests class, not full',
      () => fs.rmSync(path.join(fx.dir, 'src/app.test.ts')),
      expectTests
    );

    batch(
      'rename of a locally declared identifier is mechanical',
      () => write('src/app.test.ts', TEST_BASE.replace(/oldName/g, 'newName')),
      expectMech
    );

    batch(
      'rename of a local const in the matcher fixture is mechanical',
      () => write('src/m.test.ts', read('src/m.test.ts').replace(/\br\b/g, 'res')),
      expectMech
    );

    batch(
      'CRLF test file with identifier-only edit is mechanical',
      () => write('src/crlf.test.ts', 'const newName = 1;\r\nexpect(newName).toBe(1);\r\n'),
      expectMech
    );

    batch(
      'moved test file with identifier-only edit is mechanical',
      () => {
        withFiller();
        mv('src/app.test.ts', 'spec/app.test.ts');
        write('spec/app.test.ts', (TEST_BASE + filler).replace(/oldName/g, 'newName'));
      },
      expectMech
    );
    batch(
      'moved test file with a logic edit is not mechanical (tests class)',
      () => {
        withFiller();
        mv('src/app.test.ts', 'spec/app.test.ts');
        write(
          'spec/app.test.ts',
          (TEST_BASE + filler).replace(/oldName/g, 'newName').replace('toBe(2)', 'toBe(3)')
        );
      },
      expectTests
    );
    batch(
      'test file renamed with edits to another file name is not mechanical (tests class)',
      () => {
        withFiller();
        mv('src/app.test.ts', 'spec/app2.test.ts');
        write('spec/app2.test.ts', (TEST_BASE + filler).replace(/oldName/g, 'newName'));
        git('add', '-A');
        expect(git('diff', '--cached', '-M', '--name-status')).toMatch(
          /^R0\d\d\tsrc\/app\.test\.ts\tspec\/app2\.test\.ts$/m
        );
      },
      (r) => expectFull(r, /^test file renamed to another file name \(test -> test: /)
    );

    // Added lines of test files get the risky scan (reference "Dimensions"): a local renamed onto a
    // command token passes the test-file rule and stays mechanical, but adds the security dimension.
    for (const name of ['curl', 'npx', 'base64']) {
      batch(
        `test-file rename r -> ${name} is mechanical with security`,
        () => write('src/m.test.ts', read('src/m.test.ts').replace(/\br\b/g, name)),
        (r) => {
          expectSec(r);
          expect(r.reason).toMatch(/^only same-class renames/);
        }
      );
    }

    for (const [name, file, from, to] of [
      ['matcher swap toEqual -> toBeDefined', 'src/m.test.ts', 'toEqual', 'toBeDefined'],
      ['number change', 'src/app.test.ts', 'toBe(2)', 'toBe(3)'],
      ['keyword swap', 'src/app.test.ts', 'const first', 'let first'],
      ['string literal change', 'src/app.test.ts', "toBe('a')", "toBe('b')"],
      ['undeclared call target rename', 'src/app.test.ts', 'label()', 'other()'],
      ['non-injective self assignment', 'src/app.test.ts', 'const first = second;', 'const x = x;'],
      [
        'merge onto an existing name',
        'src/app.test.ts',
        'const first = second;',
        'const second = second;',
      ],
      ['merge onto an existing argument', 'src/b.test.ts', 'expect(a(b));', 'expect(b(b));'],
      [
        'old token surviving in a context line',
        'src/ctx.test.ts',
        'let old = 1;\nfoo(old);',
        'let renamed = 1;\nfoo(renamed);',
      ],
      ['pure deletion of a line', 'src/app.test.ts', "expect(label()).toBe('a');\n", ''],
      ['comment change', 'src/cm.test.ts', '// note', '// other'],
      ['JSDoc change', 'src/cm.test.ts', '/** doc */', '/** docs */'],
      ['double-quoted string change', 'src/cm.test.ts', '"a"', '"b"'],
      ['template string change', 'src/cm.test.ts', '`a${s}`', '`b${s}`'],
    ]) {
      batch(
        `${name} is not mechanical (tests class)`,
        () => {
          const before = read(file);
          expect(before).toContain(from);
          write(file, before.replace(from, to));
        },
        expectTests
      );
    }

    for (const name of [
      'NaN',
      'Math',
      'process',
      'undefined',
      'globalThis',
      'require',
      'self',
      'toBe',
    ]) {
      batch(
        `local renamed to builtin or matcher ${name} is not mechanical (tests class)`,
        () => write('src/m.test.ts', read('src/m.test.ts').replace(/\br\b/g, name)),
        expectTests
      );
    }

    for (const [name, content] of [
      ['named import', 'import { oldName } from "./app";\nexpect(oldName(1)).toBe(2);\n'],
      ['object destructuring', 'const { oldName } = mod;\nexpect(oldName(1)).toBe(2);\n'],
      ['member access', 'const oldName = 1;\nexpect(obj.oldName).toBe(oldName);\n'],
      ['optional member call', 'const oldName = 1;\nexpect(obj?.oldName()).toBe(oldName);\n'],
      ['object key', 'const oldName = 1;\nconst o = { oldName: 2 };\nexpect(o).toBe(oldName);\n'],
      ['shorthand property', 'const oldName = 1;\nexpect({ oldName }).toEqual(x);\n'],
      ['python keyword argument', 'def f(oldName):\n    return g(oldName=oldName)\n'],
    ]) {
      batch(
        `rename through a ${name} is not mechanical (tests class)`,
        () => {
          write('src/k.test.ts', content);
          git('add', '-A');
          git('commit', '-qm', 'prep');
          write('src/k.test.ts', content.replace(/oldName/g, 'newName'));
        },
        expectTests
      );
    }

    batch(
      'inconsistent rename is not mechanical (tests class)',
      () =>
        write(
          'src/app.test.ts',
          TEST_BASE.replace('oldName(1)', 'other(1)').replace('const oldName', 'const newName')
        ),
      expectTests
    );

    batch(
      'rename onto a name already used elsewhere is not mechanical (tests class)',
      () => write('src/app.test.ts', TEST_BASE.replace(/oldName/g, 'first')),
      expectTests
    );

    batch(
      'added assertion is not mechanical (tests class)',
      () => write('src/app.test.ts', TEST_BASE + 'expect(1).toBe(1);\n'),
      expectTests
    );

    batch(
      'rename that makes an assertion tautological is not mechanical (tests class)',
      () => {
        write('src/app.test.ts', 'const x = 1;\nconst expected = 1;\nexpect(x).toBe(expected);\n');
        git('commit', '-qam', 'prep');
        write('src/app.test.ts', 'const x = 1;\nconst x = 1;\nexpect(x).toBe(x);\n');
      },
      expectTests
    );
  });
});
