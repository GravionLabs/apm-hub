---
name: cliff-setup
description: >
  Set up git-cliff for conventional-commit changelog generation and integrate it
  into the project workflow. Installs git-cliff, creates or validates cliff.toml
  configuration, generates CHANGELOG.md, and adds a changelog script to
  package.json. Use this skill when setting up changelog generation or updating
  the changelog before a release.
---

## Prerequisites

- Git repository with conventional commits; `package.json` at the root (for script integration)

## Steps

1. **Install** — if `git-cliff --version` fails: `cargo install git-cliff` (preferred), else `pnpm add -g git-cliff` or `npm install -g git-cliff`
2. **Configure** — if `cliff.toml` is missing, create it with: conventional-commit parsing on; group by type (feat, fix, docs, perf, refactor); skip chore/ci/test/style/build. If it exists, validate only — never overwrite project-specific customizations.
3. **Generate**
   - No prior changelog: `git-cliff -c cliff.toml -o CHANGELOG.md`
   - Existing changelog with `v*` tags: `git-cliff -c cliff.toml -o CHANGELOG.md --unreleased -t v{next-version}`
4. **Integrate** — add to `package.json` scripts:
   ```json
   "changelog": "git-cliff -c cliff.toml -o CHANGELOG.md",
   "changelog:release": "git-cliff -c cliff.toml -o CHANGELOG.md --unreleased -t v{version}"
   ```

## Gotchas

- The first run covers the whole git history — review and trim for large repos
- Incremental updates need tags in `v{major}.{minor}.{patch}` format
- git-cliff reads the current branch — check out the target branch first

Report: summary, files changed (`cliff.toml`, `CHANGELOG.md`, `package.json`), verify command (`head -5 CHANGELOG.md`).
