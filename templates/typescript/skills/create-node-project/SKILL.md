---
name: create-node-project
description: 'Scaffold a new TypeScript/Node.js project (library, CLI, or application) with strict tsconfig, Vitest, and ESM support.'
allowed-tools: editFiles codebase runCommands
model: gpt-4.1
---

Scaffold a new TypeScript/Node.js project with a production-ready baseline.

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
   The script creates the directory, copies templates, patches `package.json` for the project type,
   runs `npm install`, and initializes a git repository.

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

5. **Next steps:** set up code quality with `setup-prettier-eslint-husky`, add CI with `create-node-workflow`

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
- Always use `"type": "module"` (ESM) — avoid CJS `require()`
- Library projects: include `exports`, `types`, and `files` fields in `package.json`
- CLI projects: include `bin` field and `#!/usr/bin/env node` shebang
- Solution must build and test cleanly before task is complete

## Tips
> **Use the `task` tool** for scaffolding — it's mechanical.
> Example: `#task pwsh scripts/New-NodeProject.ps1 -ProjectName "my-cli" -ProjectType cli`
