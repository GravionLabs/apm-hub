---
name: pnpm-workflow
description: >
  Set up pnpm as the project package manager and migrate from npm. Installs
  pnpm, converts lockfiles, updates scripts, and configures the project for
  pnpm-based development. Use this skill when starting a new TypeScript/Node.js
  project or migrating an existing npm project to pnpm.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
compatibility: opencode, github-copilot
---

## Overview

Set up pnpm as the project package manager, handling the full migration from npm. The skill works in four phases: install pnpm, migrate project files, update scripts, and install dependencies.

Avoid verbose reasoning.

## Prerequisites

- Node.js installed (v18+)
- Project root with `package.json`

## Instructions

### Phase 1 — Install pnpm

1. Check if pnpm is already installed: `pnpm --version`
2. If not installed, install via corepack:
   ```powershell
   corepack enable pnpm
   ```
   Fallback if corepack unavailable:
   ```powershell
   npm install -g pnpm
   ```
3. ✓ **Checkpoint:** pnpm installed. Ready for Phase 2.

### Phase 2 — Migrate from npm

4. Remove npm artifacts:
   - Delete `package-lock.json` (if exists)
   - Delete `node_modules/` directory (if exists)
5. Add `packageManager` field to `package.json`:
   - Detect the installed pnpm version with `pnpm --version`
   - Add `"packageManager": "pnpm@{version}"` to `package.json`
6. Create `.npmrc` in project root if not present:
   ```
   shamefully-hoist=true
   ```
7. ✓ **Checkpoint:** Project cleaned and configured. Ready for Phase 3.

### Phase 3 — Update Scripts

8. Read `package.json` and find any scripts using `npm run` — convert them to use `pnpm`:
   - `"npm run build"` → `"pnpm build"`
   - `"npm run test"` → `"pnpm test"`
   - `"npm install"` → no change needed (but may want `pnpm install`)
9. ✓ **Checkpoint:** Scripts updated. Ready for Phase 4.

### Phase 4 — Install Dependencies

10. Run `pnpm install` to generate `pnpm-lock.yaml`
11. Verify the project builds: `pnpm build`
12. ✓ **Checkpoint:** Dependencies installed and build passes. Ready for use.

## Gotchas

- If `packageManager` already exists, update the version instead of duplicating.
- `.npmrc` may already have content — append `shamefully-hoist=true` if not present.
- Some npm-specific lifecycle scripts (e.g. `preinstall`, `postinstall`) may behave differently in pnpm — verify they work.
- After migration, commit `pnpm-lock.yaml` and remove `package-lock.json` from tracking.

## Output Format

### ✅ Summary
pnpm {version} set up for {project}. Migration complete.

### 📝 What Changed
- Created/Updated: `.npmrc`
- Modified: `package.json` (packageManager, scripts)
- Deleted: `package-lock.json`, `node_modules/`
- Created: `pnpm-lock.yaml`

### ✔️ Verify
```powershell
pnpm --version
pnpm build
pnpm test
```

### 🚀 Next Steps
1. Update CI pipelines to use `pnpm` instead of `npm`
2. Verify `pnpm-lock.yaml` is committed
3. Update README with pnpm installation instructions if needed
