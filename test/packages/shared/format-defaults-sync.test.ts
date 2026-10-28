import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PwshWorker } from '../../helpers/pwsh-worker';

// The `## Format` section of every <lang>-implementation skill spells the default commands of Format-Changed.ps1;
// this test keeps both in sync (the script's `-WhatIf` JSON is the source of truth).
const PACKAGES = path.resolve(__dirname, '../../../packages');
const SCRIPT = path.join(PACKAGES, 'shared/.apm/skills/implementation/scripts/Format-Changed.ps1');
const LANGS = ['ts', 'ng', 'py', 'dotnet', 'rust', 'go'];
const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', '1']).status === 0;

const sectionLines = (lang: string): string[] => {
  const skill = fs.readFileSync(
    path.join(PACKAGES, `${lang}/.apm/skills/${lang}-implementation/SKILL.md`),
    'utf8',
  );
  const section = /^## Format$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(skill)?.[1] ?? '';
  return section.split('\n').filter((l) => l.trim());
};
const line = (lang: string, label: string): string =>
  sectionLines(lang).find((l) => l.startsWith('- ' + label)) ?? '';
// the backticked commands of a line, in order (only those with {files}: `biome.json[c]` is a file name)
const commands = (text: string): string[] =>
  [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((c) => c.includes('{files}'));

describe.skipIf(!hasPwsh || process.platform === 'win32')(
  '## Format sections match the Format-Changed.ps1 defaults',
  () => {
    let worker: PwshWorker;
    let plain: string;
    let biome: string;
    beforeAll(() => {
      worker = new PwshWorker(SCRIPT);
      plain = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fmt-sync-')));
      biome = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fmt-sync-biome-')));
      for (const d of [plain, biome]) spawnSync('git', ['init', '-q'], { cwd: d });
      fs.writeFileSync(path.join(biome, 'biome.json'), '{}');
    });
    afterAll(() => {
      worker.close();
      for (const d of [plain, biome]) fs.rmSync(d, { recursive: true, force: true });
    });

    const defaults = async (lang: string, cwd: string, check: boolean): Promise<string[]> => {
      const r = await worker.run(['-Language', lang, ...(check ? ['-Check'] : []), '-WhatIf'], {
        cwd,
      });
      expect(r.status, r.stderr).toBe(0);
      const steps = JSON.parse(r.stdout) as { commands: string[] }[];
      return steps.flatMap((s) => s.commands);
    };

    it.each(LANGS)(
      '%s: Format and Check (read-only) lines equal the script defaults',
      async (lang) => {
        const format = commands(line(lang, 'Format:'));
        const check = commands(line(lang, 'Check (read-only):'));
        expect(format.length).toBeGreaterThan(0);
        expect(check.length).toBeGreaterThan(0);
        expect(format).toEqual(await defaults(lang, plain, false));
        expect(check).toEqual(await defaults(lang, plain, true));
      },
    );

    it.each(['ts', 'ng'])('%s: the Biome project line equals the biome defaults', async (lang) => {
      const [format, check, ...rest] = commands(line(lang, 'Biome project'));
      expect(rest).toEqual([]);
      expect([format]).toEqual(await defaults(lang, biome, false));
      expect([check]).toEqual(await defaults(lang, biome, true));
    });

    it.each(['py', 'dotnet', 'rust', 'go'])(
      '%s: no Biome line, the biome.json fixture changes nothing',
      async (lang) => {
        expect(line(lang, 'Biome project')).toBe('');
        expect(await defaults(lang, biome, false)).toEqual(await defaults(lang, plain, false));
      },
    );
  },
);
