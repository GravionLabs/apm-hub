import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createMarkdownRenderer, type UserConfig } from 'vitepress';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sidebar } from '../.vitepress/sidebar';

const repoRoot = resolve(import.meta.dirname, '../..');
const GH = 'https://github.com/GravionLabs/apm-hub';

/** The site config, imported fresh so that SITE_BASE is read again. */
async function loadConfig(): Promise<UserConfig> {
  vi.resetModules();
  return (await import('../.vitepress/config')).default as UserConfig;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the VitePress config', () => {
  it('renders the docs folder in place', async () => {
    const config = await loadConfig();
    expect(config.srcDir).toBe('../docs');
  });

  it('uses / as base when SITE_BASE is not set', async () => {
    vi.stubEnv('SITE_BASE', undefined);
    expect((await loadConfig()).base).toBe('/');
  });

  it('takes the base from SITE_BASE', async () => {
    vi.stubEnv('SITE_BASE', '/apm-hub/');
    expect((await loadConfig()).base).toBe('/apm-hub/');
  });

  it('exempts only localhost addresses from the dead-link check', async () => {
    const ignore = (await loadConfig()).ignoreDeadLinks;
    expect(ignore).toHaveLength(1);
    const [localhost] = ignore as RegExp[];
    expect(localhost.test('http://localhost:5173/')).toBe(true);
    expect(localhost.test('https://localhost')).toBe(true);
    expect(localhost.test('https://example.com/localhost')).toBe(false);
    expect(localhost.test('./usage/missing')).toBe(false);
  });

  it('has local search, the edit link, the GitHub link, the MIT footer and the sidebar', async () => {
    const theme = (await loadConfig()).themeConfig!;
    expect(theme.search).toEqual({ provider: 'local' });
    expect(theme.editLink?.pattern).toBe(`${GH}/edit/main/docs/:path`);
    expect(theme.socialLinks).toEqual([{ icon: 'github', link: GH }]);
    expect(theme.footer?.message).toMatch(/MIT/);
    expect(theme.sidebar).toEqual(sidebar);
  });
});

describe('the home page', () => {
  it('includes the README at the repository root and has no edit link', () => {
    const index = readFileSync(resolve(repoRoot, 'docs/index.md'), 'utf8');
    expect(index).toMatch(/<!--\s*@include:\s*\.\.\/README\.md\s*-->/);
    expect(index).toMatch(/^---\neditLink: false\n---/);
  });

  it('gets README links rewritten against the files of the repository', async () => {
    const config = await loadConfig();
    // VitePress keeps the first renderer it creates: every test passes the full markdown options.
    const md = await createMarkdownRenderer(resolve(repoRoot, 'docs'), config.markdown, '/');
    const html = md.render(
      '[o](docs/overview.md) [f](docs/usage/copilot-hooks.md#x) [a](AGENTS.md) [p](packages/shared) [w](https://agentskills.io)',
      { relativePath: 'index.md', path: resolve(repoRoot, 'docs/index.md'), cleanUrls: true }
    );
    expect(html).toContain('href="./overview"');
    expect(html).toContain('href="./usage/copilot-hooks#x"');
    expect(html).toContain(`href="${GH}/blob/main/AGENTS.md"`);
    expect(html).toContain(`href="${GH}/tree/main/packages/shared"`);
    expect(html).toContain('href="https://agentskills.io"');
  });

  it('shows placeholders such as <issue> as text, not as HTML elements', async () => {
    const config = await loadConfig();
    expect(config.markdown?.html).toBe(false);
    const md = await createMarkdownRenderer(resolve(repoRoot, 'docs'), config.markdown, '/');
    const html = md.render('run full <issue> for <name>', { relativePath: 'index.md' });
    expect(html).toContain('full &lt;issue&gt; for &lt;name&gt;');
    expect(html).not.toContain('<issue>');
  });
});
