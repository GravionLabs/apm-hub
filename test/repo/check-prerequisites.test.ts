import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PwshWorker } from '../helpers/pwsh-worker';

const SCRIPT = path.resolve(
  __dirname,
  '../../.github/skills/check-prerequisites/scripts/Check-Prerequisites.ps1',
);
const pwshProbe = spawnSync('sh', ['-c', 'command -v pwsh'], { encoding: 'utf8' });
const hasPwsh = pwshProbe.status === 0;
const pwshPath = pwshProbe.stdout.trim();

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
    let bin: string;
    // one pwsh worker runs the script in-process per call; each call gets its own HOME and PATH, and the script resolves
    // tools through Get-Command on the current $env:PATH, so a PATH without apmw needs no separate process
    let worker: PwshWorker;

    beforeAll(() => {
      worker = new PwshWorker(SCRIPT);
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prereq-'));
      lean = path.join(dir, 'lean');
      bin = path.join(dir, 'bin');
      for (const d of [lean, bin]) fs.mkdirSync(d);
      // PATH with the core tools the script checks (pwsh, git, node, npm, uname) but without apmw
      for (const tool of ['git', 'node', 'npm', 'uname', 'sh']) {
        const found = spawnSync('sh', ['-c', `command -v ${tool}`], {
          encoding: 'utf8',
        }).stdout.trim();
        if (found) fs.symlinkSync(found, path.join(lean, tool));
      }
      fs.symlinkSync(pwshPath, path.join(lean, 'pwsh'));
      fs.writeFileSync(path.join(bin, 'apmw'), '#!/bin/sh\necho 1.0\n', { mode: 0o755 });
    });
    afterAll(() => {
      worker.close();
      fs.rmSync(dir, { recursive: true, force: true });
    });
    beforeEach(() => {
      home = fs.mkdtempSync(path.join(dir, 'home-'));
      proj = fs.mkdtempSync(path.join(dir, 'proj-'));
    });

    const write = (d: string, text: string) => {
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'explorer.md'), text);
    };
    const run = async (extraPath = '') => {
      const r = await worker.run([], {
        cwd: proj,
        env: { HOME: home, PATH: extraPath ? `${extraPath}:${lean}` : lean },
      });
      return { code: r.status, out: r.stdout };
    };

    it('passes when every agent file is sanitized (keys in a body do not count) and says nothing about dromos', async () => {
      write(path.join(home, '.claude/agents'), `${SANITIZED}metadata:\n  claude:\n`);
      write(path.join(proj, '.claude/agents'), SANITIZED);
      const r = await run();
      expect(r.code).toBe(0);
      expect(r.out).not.toContain('apmw');
      // the runner is gone (#828)
      expect(r.out).not.toMatch(/dromos/i);
    });

    it.each([
      ['proj', '.claude/agents'],
      ['proj', '.opencode/agents'],
      ['proj', '.github/agents'],
      ['home', '.config/opencode/agents'],
    ])('fails with the install hint for a source-format file in the %s %s', async (root, sub) => {
      write(path.join(root === 'home' ? home : proj, sub), SOURCE);
      const r = await run();
      expect(r.code).toBe(1);
      expect(r.out).toContain('apm-hub source format');
      expect(r.out).toContain('uv tool install apmw');
    });

    it('is satisfied by an apmw on PATH', async () => {
      write(path.join(home, '.claude/agents'), SOURCE);
      const r = await run(bin);
      expect(r.code).toBe(0);
      expect(r.out).not.toContain('source format');
    });
  },
);
