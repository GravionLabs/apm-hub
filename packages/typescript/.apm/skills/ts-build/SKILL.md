---
name: ts-build
description: >
  TypeScript/Node.js build and format rules. Covers pnpm build, TypeScript
  compilation, and code formatting. Use this skill during the build/verify
  phase of a TypeScript project.
allowed-tools: execute shell runCommands read search codebase
compatibility: opencode, github-copilot
---

## Prerequisites

- Node.js v18+, pnpm installed
- Project root with `package.json`, `tsconfig.json`, `vitest.config.ts`

## Build

```powershell
pnpm build
```

- Runs `tsc` via the `build` script in `package.json`
- Output goes to `dist/` (library) or remains in `src/` (app)
- Strict TypeScript — `noUncheckedIndexedAccess`, `strictNullChecks`

## Format & Lint

```powershell
pnpm check
```

- Uses Biome or Prettier depending on project config
- Runs both format check and lint in one pass

## Clean

```powershell
pnpm clean  # if defined
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
```

## Gotchas

- `tsconfig.json` may have path aliases — build resolves them via `tsc`
- CI uses `pnpm install --frozen-lockfile` to verify lockfile matches
