import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../..');
const sources = path.join(root, 'packages/github/.apm/issue-templates');
const copies = path.join(root, '.github/ISSUE_TEMPLATE');
const expected: Record<string, string> = {
  'epic.md': '[Epic] ',
  'feature.md': '[Feature] ',
  'pbi.md': '[PBI] ',
  'task.md': '[Task] ',
  'bug_report.md': '[Bug] ',
};
const titleOf = (file: string): string | undefined =>
  /^title: '(.*)'$/m.exec(readFileSync(file, 'utf8'))?.[1];

describe('issue templates default to the level prefix', () => {
  for (const [name, prefix] of Object.entries(expected)) {
    it(`${name} title is exactly ${prefix.trim()}`, () => {
      expect(titleOf(path.join(sources, name))).toBe(prefix);
      expect(titleOf(path.join(copies, name))).toBe(prefix);
    });

    it(`${name} is identical in both template sets`, () => {
      expect(readFileSync(path.join(copies, name), 'utf8')).toBe(
        readFileSync(path.join(sources, name), 'utf8'),
      );
    });
  }

  it('both sets hold the same template files', () => {
    const md = (dir: string) =>
      readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .sort();
    expect(md(sources)).toEqual(Object.keys(expected).sort());
    expect(md(copies)).toEqual(md(sources));
  });
});

describe('no skill prescribes an unprefixed Epic/Feature title', () => {
  // Reading-side mentions only: legacy forms, parent links, status grouping, plan summaries.
  const allowed =
    /Legacy titles \(`Epic: |legacy `Epic: `|Parent (Epic|Feature): #|Epic: grouped per Feature|\(Feature: the capability;/;

  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : [p];
    });

  const files = readdirSync(path.join(root, 'packages')).flatMap((pkg) => {
    const skills = path.join(root, 'packages', pkg, '.apm/skills');
    try {
      return walk(skills).filter((f) => /(SKILL|references[\\/].*)\.md$/.test(f));
    } catch {
      return [];
    }
  });

  it('scans skill documents', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('has no unallowed `Epic: ` or `Feature: ` title line', () => {
    const offenders = files.flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${path.relative(root, f)}:${i + 1}` }))
        .filter(({ line }) => /\b(Epic|Feature): /.test(line) && !allowed.test(line))
        .map(({ at }) => at),
    );
    expect(offenders).toEqual([]);
  });
});
