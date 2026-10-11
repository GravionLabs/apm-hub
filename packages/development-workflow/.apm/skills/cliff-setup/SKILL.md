---
name: cliff-setup
description: 'Set up git-cliff (cliff.toml, CHANGELOG.md, changelog script) for conventional-commit changelogs. Use when setting up or updating the changelog before a release.'
disable-model-invocation: true
metadata:
  opencode/autoinvoke: 'false'
---

## Prerequisites

- Git repository with conventional commits; `package.json` at the root (for script integration)

Paths to `scripts/`, `references/` and `templates/` are relative to this skill's directory.

## Steps

1. **Install** — if `git-cliff --version` fails: `cargo install git-cliff`, else `pnpm add -g git-cliff`
2. **Configure** — if `cliff.toml` is missing → copy `templates/cliff.toml` to the repo root and replace `<project>` in the header; otherwise validate only, never overwrite project-specific customizations
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
- Incremental updates need tags in `v{major}.{minor}.{patch}` format (the template's `tag_pattern`)
- git-cliff reads the current branch — check out the target branch first
- The template skips `chore`, `ci`, `style`, `test`, `build` commits; adjust `commit_parsers` if the project wants them listed

Report: summary, files changed (`cliff.toml`, `CHANGELOG.md`, `package.json`), verify command (`head -5 CHANGELOG.md`).
