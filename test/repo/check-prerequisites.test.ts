import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SCRIPT = path.resolve(
  __dirname,
  '../../.github/skills/check-prerequisites/scripts/Check-Prerequisites.ps1',
);
const pwshProbe = spawnSync('sh', ['-c', 'command -v pwsh'], { encoding: 'utf8' });
const hasPwsh = pwshProbe.status === 0;
const pwshPath = pwshProbe.stdout.trim();

// The unit project keeps the default 5 s test timeout; every case here starts pwsh at least once, which takes
// several seconds on a cold CI runner (the scripts project allows 30 s, but it lists test/packages files only).
vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

const SOURCE =
  "---\nname: explorer\ntools: ['read']\nmetadata:\n  claude:\n    tools: [Read]\n---\n\nBody.\n";
const SANITIZED = '---\nname: explorer\ntools: [Read]\nmodel: haiku\n---\n\nBody.\n';

describe.skipIf(!hasPwsh || process.platform === 'win32')(
  'Check-Prerequisites.ps1: apmw becomes required for unsanitized agents',
  () => {
    let dir: string;
    let home: string;
    let proj: string;
    let lean: string;

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prereq-'));
      home = path.join(dir, 'home');
      proj = path.join(dir, 'proj');
      lean = path.join(dir, 'lean');
      [home, proj, lean].forEach((d) => fs.mkdirSync(d));
      // PATH with the core tools the script checks (pwsh, git, node, npm, uname) but without apmw
      for (const tool of ['git', 'node', 'npm', 'uname', 'sh']) {
        const found = spawnSync('sh', ['-c', `command -v ${tool}`], {
          encoding: 'utf8',
        }).stdout.trim();
        if (found) fs.symlinkSync(found, path.join(lean, tool));
      }
      fs.symlinkSync(pwshPath, path.join(lean, 'pwsh'));
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    const write = (d: string, text: string) => {
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'explorer.md'), text);
    };
    const run = (extraPath = '') => {
      const r = spawnSync(pwshPath, ['-NoProfile', '-File', SCRIPT], {
        cwd: proj,
        encoding: 'utf8',
        env: { HOME: home, PATH: extraPath ? `${extraPath}:${lean}` : lean },
      });
      return { code: r.status, out: r.stdout };
    };

    it('passes when every agent file is sanitized or absent', () => {
      write(path.join(home, '.claude/agents'), SANITIZED);
      write(path.join(proj, '.claude/agents'), SANITIZED);
      const r = run();
      expect(r.code).toBe(0);
      expect(r.out).not.toContain('apmw');
    });

    it.each(['.claude/agents', '.opencode/agents', '.github/agents'])(
      'fails with the install hint for a source-format file in the project %s',
      (sub) => {
        write(path.join(proj, sub), SOURCE);
        const r = run();
        expect(r.code).toBe(1);
        expect(r.out).toContain('apm-hub source format');
        expect(r.out).toContain('uv tool install apmw');
      },
    );

    it('checks the home directories too', () => {
      write(path.join(home, '.config/opencode/agents'), SOURCE);
      expect(run().code).toBe(1);
    });

    it('ignores the keys in a body', () => {
      write(path.join(home, '.claude/agents'), `${SANITIZED}metadata:\n  claude:\n`);
      expect(run().code).toBe(0);
    });

    it('is satisfied by an apmw on PATH', () => {
      write(path.join(home, '.claude/agents'), SOURCE);
      const bin = path.join(dir, 'bin');
      fs.mkdirSync(bin);
      fs.writeFileSync(path.join(bin, 'apmw'), '#!/bin/sh\necho 1.0\n', { mode: 0o755 });
      const r = run(bin);
      expect(r.code).toBe(0);
      expect(r.out).not.toContain('source format');
    });

    it('reports dromos --version when installed and stays green when missing', () => {
      const missing = run();
      expect(missing.code).toBe(0);
      expect(missing.out).toContain('dromos: NOT FOUND');
      expect(missing.out).toContain('npm i -g @gravionlabs/dromos');
      const bin = path.join(dir, 'bin');
      fs.mkdirSync(bin);
      fs.writeFileSync(path.join(bin, 'dromos'), '#!/bin/sh\necho 0.5.0\n', { mode: 0o755 });
      const found = run(bin);
      expect(found.code).toBe(0);
      expect(found.out).toContain('dromos: 0.5.0');
    });
  },
);
