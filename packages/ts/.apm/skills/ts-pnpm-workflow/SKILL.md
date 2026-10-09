---
name: ts-pnpm-workflow
description: >
  Set up pnpm as the project package manager and migrate from npm. Installs pnpm,
  converts lockfiles, updates scripts, and configures the project for pnpm-based
  development. Use this skill when starting a new TypeScript/Node.js project or
  migrating an existing npm project to pnpm.
---

## Prerequisites

Node.js 22 LTS and a `package.json` at the project root.

## Steps

1. **Install** — if `pnpm --version` fails: `corepack enable pnpm`, else `npm install -g pnpm`
2. **Clean npm artifacts** — delete `package-lock.json` and `node_modules/`
3. **Pin** — set `"packageManager": "pnpm@<version>"` in `package.json` (update if it already exists)
4. **`.npmrc`** — create it only if the project needs pnpm settings; do not add `shamefully-hoist` unless a dependency breaks without it
5. **Scripts** — replace `npm run <x>` with `pnpm <x>` in `package.json` scripts
6. **Install and verify** — `pnpm install` (generates `pnpm-lock.yaml`), then `pnpm build`

## Gotchas

- `preinstall`/`postinstall` lifecycle scripts can behave differently under pnpm — verify they run
- Commit `pnpm-lock.yaml`; make sure `package-lock.json` is removed from tracking
- Update CI to use pnpm

Report: summary, files changed, verify commands (`pnpm build`, `pnpm test`).
