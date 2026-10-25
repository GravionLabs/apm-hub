import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  createClassifyFixture,
  hasPwsh,
  TEST_BASE,
  hermetic,
  expectFull,
  expectFullAll,
  expectMech,
  expectMode,
  expectDocs,
} from '../../helpers/classify-fixture';

describe.skipIf(!hasPwsh)('Classify-Diff.ps1', { timeout: 30000 }, () => {
  const fx = createClassifyFixture();
  const { git, write, mv, classify, batched, body } = fx;

  describe('ranges, git state and failures', () => {
    const batch = batched();

    it('-Force full overrides a mechanical diff', () => {
      write('docs/guide.md', body.replace('line 3', 'x'));
      expectFullAll(classify(['-Force', 'full']), /forced/);
    });

    it('-Force full overrides a docs-only diff', () => {
      write('CONTRIBUTING.md', body.replace('line 3', 'x'));
      expectFullAll(classify(['-Force', 'full']), /forced/);
    });

    it('untracked files in working-tree mode are full', () => {
      write('docs/guide.md', body.replace('line 3', 'x'));
      write('src/evil.ts', 'x\n');
      expectFullAll(classify(), /untracked/);
    });

    it('working-tree mode classifies unstaged edits', () => {
      write('docs/guide.md', body.replace('line 3', 'x'));
      expectDocs(classify());
    });

    it('working-tree mode classifies a staged pure rename (no -Range)', () => {
      mv('docs/guide.md', 'docs/other.md');
      expect(git('diff', '--cached', '-M', '--name-status')).toBe(
        'R100\tdocs/guide.md\tdocs/other.md\n'
      );
      expectMech(classify());
    });

    it('explicit committed range is classified from that range', () => {
      write('docs/guide.md', body.replace('line 3', 'x'));
      git('commit', '-qam', 'docs');
      write('untracked.ts', 'x\n');
      expectDocs(classify(['-Range', 'HEAD~1..HEAD']));
      write('src/app.ts', body.replace('line 3', 'code'));
      git('commit', '-qam', 'code');
      expectFull(
        classify(['-Range', 'HEAD~2..HEAD']),
        /^content change in source file: src\/app\.ts$/
      );
    });

    it('three-dot range is classified', () => {
      write('docs/guide.md', body.replace('line 3', 'x'));
      git('commit', '-qam', 'docs');
      expectDocs(classify(['-Range', 'HEAD~1...HEAD']));
    });

    batch(
      'path with spaces is handled',
      () => write('docs/my guide.md', body.replace('line 3', 'x')),
      expectDocs
    );

    it('empty diff fails closed to full', () => {
      expectFullAll(classify(), /empty/);
    });

    it('bad range fails closed to full', () => {
      expectFullAll(classify(['-Range', 'nope..alsonope']), /invalid range/);
    });

    it('range starting with a dash fails closed to full', () => {
      write('docs/guide.md', body.replace('line 3', 'x'));
      expectFullAll(classify(['-Range:--output=out.txt']), /invalid range/);
      expect(fs.existsSync(path.join(fx.dir, 'out.txt'))).toBe(false);
    });

    batch(
      'binary files fail closed to full',
      () => fs.writeFileSync(path.join(fx.dir, 'docs/img.md'), Buffer.from([0, 1, 2, 0, 255])),
      (r) => expectFullAll(r, /binary/)
    );

    batch(
      'symlink is full',
      () => fs.symlinkSync('x', path.join(fx.dir, 'docs/link.md')),
      (r) => expectFullAll(r, /^symlink or submodule: docs\/link\.md$/)
    );

    // Not batched: `git add -A` would drop the gitlink, which has no working-tree directory.
    it('submodule is full', () => {
      git('update-index', '--add', '--cacheinfo', '160000,' + 'a'.repeat(40) + ',sub');
      git('commit', '-qm', 'sub');
      expectFullAll(classify(['-Range', 'HEAD~1..HEAD']), /^symlink or submodule: sub$/);
    });

    // Not batched: needs two commits. `ignore = all` must not hide the pointer bump.
    it('submodule pointer bump hidden by ignore = all next to a docs edit is full', () => {
      git('update-index', '--add', '--cacheinfo', '160000,' + 'a'.repeat(40) + ',sub');
      write('.gitmodules', '[submodule "sub"]\n\tpath = sub\n\turl = ../sub\n\tignore = all\n');
      git('add', '.gitmodules');
      git('commit', '-qm', 'sub');
      git('update-index', '--cacheinfo', '160000,' + 'b'.repeat(40) + ',sub');
      write('README.md', body.replace('line 3', 'x'));
      git('commit', '-qam', 'bump');
      expectFullAll(classify(['-Range', 'HEAD~1..HEAD']), /^symlink or submodule: sub$/);
    });

    batch(
      'type change from file to symlink is full',
      () => {
        fs.rmSync(path.join(fx.dir, 'docs/guide.md'));
        fs.symlinkSync('x', path.join(fx.dir, 'docs/guide.md'));
      },
      (r) => expectFullAll(r, /^symlink or submodule: docs\/guide\.md$/)
    );

    it('non-git working directory is full with exit 0', () => {
      const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'classify-nogit-'));
      try {
        expectFullAll(
          classify(
            [],
            { ...hermetic(fx.home), GIT_CEILING_DIRECTORIES: path.dirname(plain) },
            plain
          ),
          /failed/
        );
      } finally {
        fs.rmSync(plain, { recursive: true, force: true });
      }
    });

    const withFakeGit = (script: string[], fn: (env: NodeJS.ProcessEnv) => void) => {
      const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fakegit-'));
      try {
        const fake = path.join(bin, 'git');
        fs.writeFileSync(fake, ['#!/bin/sh', ...script, ''].join('\n'));
        fs.chmodSync(fake, 0o755);
        fn({ ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` });
      } finally {
        fs.rmSync(bin, { recursive: true, force: true });
      }
    };

    it('failing git is full with reason failed and exit 0', () => {
      withFakeGit(['exit 1'], (env) => expectFullAll(classify([], env), /failed/));
    });

    it('scans the added lines of all files with ONE git diff -U0 (#462)', () => {
      for (const f of ['CONTRIBUTING.md', 'README.md', 'docs/guide.md', 'CHANGELOG.md'])
        write(f, body.replace('line 3', 'x'));
      write('packages/x/.apm/skills/foo/SKILL.md', body.replace('line 3', 'x'));
      write('src/app.test.ts', TEST_BASE.replace('toBe(2)', 'toBe(3)'));
      git('add', '-A');
      git('commit', '-qm', 'many');
      const log = path.join(fx.home, 'git-calls.log');
      const real = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
      fs.rmSync(log, { force: true });
      withFakeGit([`echo "$@" >> '${log}'`, `exec '${real}' "$@"`], (env) =>
        expectMode(classify(['-Range', 'HEAD~1..HEAD'], env), 'text', [
          'correctness',
          'conventions',
          'tests',
          'spec',
        ])
      );
      const calls = fs
        .readFileSync(log, 'utf8')
        .split('\n')
        .filter((l) => / -U0 /.test(l));
      expect(calls).toHaveLength(1);
    });

    it('a git failure while scanning the added lines is full', () => {
      write('CONTRIBUTING.md', body.replace('line 3', 'x'));
      git('commit', '-qam', 'docs');
      const real = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
      withFakeGit([`case " $* " in *" -U0 "*) exit 1;; esac`, `exec '${real}' "$@"`], (env) =>
        expectFullAll(classify(['-Range', 'HEAD~1..HEAD'], env), /git diff failed/)
      );
    });

    it('a crash inside the script still emits full JSON and exit 0', () => {
      withFakeGit(
        [
          'for a in "$@"; do',
          '  case "$a" in',
          "    --raw) printf ':100644 100644 a b M\\tdocs/a.md\\n';;",
          "    --numstat) printf 'x\\ty\\tdocs/a.md\\n';;",
          '  esac',
          'done',
          'exit 0',
        ],
        (env) => expectFullAll(classify([], env), /script error/)
      );
    });
  });
});
