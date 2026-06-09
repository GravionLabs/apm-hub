---
name: ng-build
description: >
  Angular build and format rules using the Angular CLI. Covers ng build,
  SSR/prerendering, and linting. Use this skill during the build/verify
  phase of an Angular project.
allowed-tools: execute shell runCommands read search codebase
compatibility: opencode, github-copilot
---

## Prerequisites

- Node.js v22+, pnpm installed
- Project root with `angular.json` and `package.json`

## Build

```powershell
pnpm build
```

- Runs `ng build` via the `build` script in `package.json`
- Output: `dist/` directory
- Strict mode: `strictTemplates`, `strictInputTypes` enabled

## SSR / Prerender

```powershell
pnpm build:ssr    # if defined
pnpm prerender    # if defined
```

## Format & Lint

```powershell
pnpm lint
pnpm format       # if defined (Prettier)
```

## Gotchas

- `angular.json` defines build target, output path, and optimization settings
- Production build: `pnpm build --configuration production`
- Use `ng update` for framework upgrades, not manual changes
