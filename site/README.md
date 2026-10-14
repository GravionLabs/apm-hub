# site

The apm-hub documentation site, built with [VitePress](https://vitepress.dev). It has no content of
its own: `srcDir` is `../docs`, so every page is a file of `docs/`, rendered in place. Keep `.md`
files out of `site/` (this README is the only one).

## Home page

The home page (`/`) is the `README.md` at the repository root, without a copy. `docs/index.md` is a
tiny page that pulls it in with a VitePress markdown include:

```md
<!--@include: ../README.md-->
```

VitePress inlines the README before rendering, so the page is rendered as `index.md`. The
repo-links plugin (`.vitepress/repo-links.ts`) treats `index.md` as the repository root README:
its `docs/...` links become site links (`docs/usage/x.md` → `usage/x`) and links to files the
site does not contain (`AGENTS.md`, `packages/**`, ...) go to GitHub. `docs/index.md` sets
`editLink: false`, because the text to edit is the README, not the include. On GitHub,
`docs/index.md` shows as an almost empty file; the README stays the one source.

Alternatives not taken: copying the README at build time (two sources, a build step) and
`rewrites` (VitePress only rewrites files inside `srcDir`).

## Commands

```powershell
pnpm install
pnpm --filter site dev       # live preview at http://localhost:5173
pnpm --filter site build     # static build to site/.vitepress/dist; a dead link fails it
pnpm --filter site preview   # serve the build
pnpm --filter site test      # sidebar, repo-links and config tests
```

`SITE_BASE` sets the base path (default `/`); the GitHub Pages workflow sets `/apm-hub/`:

```powershell
$env:SITE_BASE = '/apm-hub/'; pnpm --filter site build
```

The sidebar is the list in `.vitepress/sidebar.ts`; a test fails when a `docs/**/*.md` page is in
no group.
