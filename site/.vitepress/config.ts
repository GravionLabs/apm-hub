import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';
import { repoFilesOnDisk, repoLinksPlugin, REPO_URL } from './repo-links';
import { sidebar } from './sidebar';
import { stripHtmlComments } from './strip-comments';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const files = repoFilesOnDisk(repoRoot);

export default withMermaid(
  defineConfig({
  title: 'apm-hub',
  description:
    'Cross-platform agent skills for GitHub Copilot, Claude Code and OpenCode, distributed as APM packages.',
  lang: 'en',
  // `/<repository>/` on GitHub Pages; the workflow sets SITE_BASE.
  base: process.env['SITE_BASE'] ?? '/',
  // The site is the documentation of the repository: its pages are the files of `docs`.
  // The home page `docs/index.md` includes the README at the repository root (see site/README.md).
  srcDir: '../docs',
  cleanUrls: true,
  lastUpdated: false,
  appearance: 'dark',
  // A link that leads nowhere fails the build. Only the example addresses of a local run are exempt.
  ignoreDeadLinks: [/^https?:\/\/localhost/],
  markdown: {
    // The docs write placeholders such as <issue> or <name> as plain text (GitHub drops them as
    // unknown tags). As raw HTML they break the Vue compile of the page, so they are shown as text.
    html: false,
    config: (md) => {
      repoLinksPlugin(md as never, files);
      stripHtmlComments(md as never);
    },
  },
  themeConfig: {
    siteTitle: 'apm-hub',
    nav: [
      { text: 'Overview', link: '/overview' },
      { text: 'Skills', link: '/skill-list' },
      { text: 'GitHub', link: REPO_URL },
    ],
    sidebar,
    search: { provider: 'local' },
    editLink: {
      pattern: `${REPO_URL}/edit/main/docs/:path`,
      text: 'Edit this page on GitHub',
    },
    socialLinks: [{ icon: 'github', link: REPO_URL }],
    footer: { message: 'Released under the MIT License.' },
  },
})
);
