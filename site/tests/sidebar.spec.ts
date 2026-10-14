import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generatedPages, sidebar } from '../.vitepress/sidebar';

const docs = resolve(import.meta.dirname, '../../docs');

/** Every markdown page below docs/ as a site link (`/concepts/skills`). */
function pagesOnDisk(dir = docs, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? pagesOnDisk(resolve(dir, e.name), `${prefix}/${e.name}`)
      : e.name.endsWith('.md')
        ? [`${prefix}/${e.name.replace(/\.md$/, '')}`]
        : [],
  );
}

const listed = sidebar.flatMap((g) => g.items.map((i) => i.link));

describe('the sidebar of the docs site', () => {
  it('lists every existing docs page in some group', () => {
    expect(pagesOnDisk().filter((p) => !listed.includes(p))).toEqual([]);
  });

  it('lists only pages that exist, except the CI-generated ones', () => {
    const missing = listed
      .filter((l) => !generatedPages.includes(l))
      .filter((l) => !existsSync(resolve(docs, `${l.slice(1)}.md`)));
    expect(missing).toEqual([]);
  });

  it('lists the four generated pages in the Reference group', () => {
    const reference = sidebar.find((g) => g.text === 'Reference');
    expect(reference?.items.map((i) => i.link)).toEqual(generatedPages);
  });

  it('has no page twice and no empty group', () => {
    expect(new Set(listed).size).toBe(listed.length);
    for (const g of sidebar) expect(g.items.length).toBeGreaterThan(0);
  });

  it('uses site links without extension', () => {
    for (const l of listed) expect(l).toMatch(/^\/[a-z-]+(\/[a-z-]+)*$/);
  });
});
