import { createMarkdownRenderer } from 'vitepress';
import { describe, expect, it } from 'vitest';
import { RepoFiles, isSitePage, repoLink, repoLinksPlugin } from '../.vitepress/repo-links';

/** A repository with these files and folders (a path ending in `/` is a folder). */
const files = (...paths: string[]): RepoFiles => ({
  kind: (p) => (paths.includes(p) ? 'file' : paths.includes(`${p}/`) ? 'directory' : null),
});
const repo = files(
  'README.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'docs/usage/install.md',
  'docs/concepts/agent-frontmatter.md',
  'packages/shared/',
  'packages/shared/apm.yml',
  'packages/shared/.apm/skills/implementation/SKILL.md',
  '.github/workflows/ci.yml',
  '.github/skills/check-prerequisites/',
  'scripts/check-manifests.mjs',
  'src/generators/'
);
const GH = 'https://github.com/GravionLabs/apm-hub';

describe('isSitePage', () => {
  it('is every markdown file under docs', () => {
    expect(isSitePage('docs/usage/install.md')).toBe(true);
    expect(isSitePage('docs/skill-list.md')).toBe(true);
  });
  it('is nothing else', () => {
    expect(isSitePage('README.md')).toBe(false);
    expect(isSitePage('packages/shared/apm.yml')).toBe(false);
    expect(isSitePage('docs/images/x.png')).toBe(false);
  });
});

describe('repoLink from a page in docs/', () => {
  const link = (href: string, page = 'concepts/agent-frontmatter.md') => repoLink(href, page, repo);

  it('leaves links between site pages, external links, anchors and mail alone', () => {
    expect(link('../usage/install.md')).toBe('../usage/install.md');
    expect(link('../usage/install.md#x')).toBe('../usage/install.md#x');
    expect(link('https://example.org/x')).toBe('https://example.org/x');
    expect(link('//example.org/x')).toBe('//example.org/x');
    expect(link('#top')).toBe('#top');
    expect(link('/usage/install')).toBe('/usage/install');
    expect(link('mailto:a@b.c')).toBe('mailto:a@b.c');
  });

  it('sends ../README.md and root files to GitHub as blobs', () => {
    expect(link('../../README.md', 'usage/install.md')).toBe(`${GH}/blob/main/README.md`);
    expect(link('../README.md', 'self.md')).toBe(`${GH}/blob/main/README.md`);
    expect(link('../../AGENTS.md')).toBe(`${GH}/blob/main/AGENTS.md`);
    expect(link('../../CONTRIBUTING.md#rename')).toBe(`${GH}/blob/main/CONTRIBUTING.md#rename`);
  });

  it('sends packages, .github, scripts and src files to GitHub as blobs', () => {
    expect(link('../../packages/shared/apm.yml')).toBe(`${GH}/blob/main/packages/shared/apm.yml`);
    expect(link('../packages/shared/.apm/skills/implementation/SKILL.md', 'x.md')).toBe(
      `${GH}/blob/main/packages/shared/.apm/skills/implementation/SKILL.md`
    );
    expect(link('../../.github/workflows/ci.yml')).toBe(`${GH}/blob/main/.github/workflows/ci.yml`);
    expect(link('../../scripts/check-manifests.mjs')).toBe(
      `${GH}/blob/main/scripts/check-manifests.mjs`
    );
  });

  it('sends a folder to GitHub as a tree, with or without trailing slash', () => {
    expect(link('../../packages/shared')).toBe(`${GH}/tree/main/packages/shared`);
    expect(link('../../src/generators/')).toBe(`${GH}/tree/main/src/generators`);
    expect(link('../../.github/skills/check-prerequisites')).toBe(
      `${GH}/tree/main/.github/skills/check-prerequisites`
    );
  });

  it('leaves a link to something that is not there, so the dead-link check can say so', () => {
    expect(link('nowhere.md')).toBe('nowhere.md');
    expect(link('../../../outside.md')).toBe('../../../outside.md');
  });
});

describe('repoLink from the README embedded as the home page', () => {
  const link = (href: string) => repoLink(href, 'index.md', repo);

  it('resolves docs/... links as site pages', () => {
    expect(link('docs/usage/install.md')).toBe('usage/install.md');
    expect(link('./docs/usage/install.md#a')).toBe('usage/install.md#a');
  });
  it('sends other repository paths to GitHub', () => {
    expect(link('AGENTS.md')).toBe(`${GH}/blob/main/AGENTS.md`);
    expect(link('CONTRIBUTING.md')).toBe(`${GH}/blob/main/CONTRIBUTING.md`);
    expect(link('packages/shared')).toBe(`${GH}/tree/main/packages/shared`);
    expect(link('scripts/check-manifests.mjs')).toBe(`${GH}/blob/main/scripts/check-manifests.mjs`);
  });
  it('leaves missing docs pages alone', () => {
    expect(link('docs/missing.md')).toBe('docs/missing.md');
  });
});

describe('the markdown-it plugin', () => {
  it('rewrites links in text, lists and tables, and not images', async () => {
    const md = await createMarkdownRenderer(
      '/docs',
      { config: (m) => repoLinksPlugin(m as never, repo) },
      '/'
    );
    const html = md.render(
      [
        '[pkg](../../packages/shared) and [page](../usage/install.md)',
        '',
        '- [file](../../AGENTS.md)',
        '',
        '| a |',
        '| - |',
        '| [x](../../README.md) |',
        '',
        '![shot](../images/x.png)',
      ].join('\n'),
      {
        relativePath: 'concepts/agent-frontmatter.md',
        path: 'concepts/agent-frontmatter.md',
        cleanUrls: true,
      }
    );
    expect(html).toContain(`href="${GH}/tree/main/packages/shared"`);
    expect(html).toContain('href="./../usage/install"');
    expect(html).toContain(`href="${GH}/blob/main/AGENTS.md"`);
    expect(html).toContain(`href="${GH}/blob/main/README.md"`);
    expect(html).toMatch(/src="[^"]*images\/x\.png"/);
    expect(html).not.toContain('apm-hub/blob/main/docs/images');
  });
});
