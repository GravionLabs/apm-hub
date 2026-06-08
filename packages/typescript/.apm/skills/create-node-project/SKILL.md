---
name: create-node-project
description: 'Scaffold a new TypeScript/Node.js project (library, CLI, or application) with strict tsconfig, Vitest, and ESM support.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
compatibility: opencode, github-copilot
model: gpt-4.1
---

Scaffold TypeScript/Node.js project with production-ready baseline.

## Stack
- **TypeScript** — NodeNext modules, strict mode, `tsc` for builds
- **`tsx`** — run TypeScript directly during development
- **Vitest** — fast unit testing with globals
- **Package manager:** npm (or pnpm)

## Steps
1. **Ask first:**
   - Project name
   - Project type: **app** (general application), **library** (publishable package), or **cli** (command-line tool)?
   - Package manager: npm or pnpm?

2. **Run the scaffold script** (recommended):
   ```powershell
   pwsh scripts/New-NodeProject.ps1 -ProjectName <Name> -ProjectType <app|library|cli> [-PackageManager npm]
   ```
   Script creates directory, copies templates, patches `package.json`, runs `npm install`, initializes git repository.

3. **Alternatively — manual steps:**
   ```bash
   mkdir <Name> && cd <Name>
   # Copy template files from templates/
   npm install
   git init
   ```

4. **Verify:**
   ```bash
   npm run build   # tsc — should complete with no errors
   npm test        # vitest run — all tests pass
   ```

5. **Next steps:** set up code quality with `setup-prettier-eslint-husky`

## CI Workflow

Create GitHub Actions CI workflow for project.

1. Ask: Node.js version, package manager (npm / pnpm / yarn), whether publish (npm registry / GitHub Packages / none)
2. Create `.github/workflows/ci.yml`:
   ```yaml
   name: CI

   on:
     push:
       branches: [main]
     pull_request:

   jobs:
     build:
       uses: GravionLabs/ci/.github/workflows/node.yml@main
       with:
         node-version: '22'
       secrets: inherit
   ```
3. Confirm `package.json` has `test`, `build`, and `lint` scripts
4. If publishing: confirm `NPM_TOKEN` secret configured

**Constraints:**
- Use `secrets: inherit` to pass secrets
- `package.json` must define `test` and `build` scripts — reusable workflow calls them
- Do not hardcode Node.js version if project uses `.nvmrc`

## Template Files
| File | Purpose |
|---|---|
| `templates/package.json` | ESM baseline: `build`, `dev` (tsx watch), `start`, `test` scripts |
| `templates/tsconfig.json` | NodeNext module resolution, strict mode, sourceMap, declaration |
| `templates/src/index.ts` | Minimal entry point placeholder |
| `templates/vitest.config.ts` | Vitest with `globals: true` |
| `templates/.gitignore` | Node.js standard ignores (dist/, node_modules/, .env) |

## Scripts
- **`scripts/New-NodeProject.ps1`** — Full scaffold automation.
  ```powershell
  pwsh scripts/New-NodeProject.ps1 -ProjectName "my-tool" -ProjectType cli
  pwsh scripts/New-NodeProject.ps1 -ProjectName "my-lib" -ProjectType library -PackageManager pnpm
  ```
  Parameters: `-ProjectName` (required), `-ProjectType` (app/library/cli), `-PackageManager` (npm/pnpm), `-OutputDirectory`

## Constraints
- Use `"type": "module"` (ESM) — avoid CJS `require()`
- Library projects: include `exports`, `types`, `files` fields in `package.json`
- CLI projects: include `bin` field and `#!/usr/bin/env node` shebang
- Solution must build and test cleanly before task complete

## Tips
> **Use `task` tool** for scaffolding — mechanical.
> Example: `#task pwsh scripts/New-NodeProject.ps1 -ProjectName "my-cli" -ProjectType cli`
