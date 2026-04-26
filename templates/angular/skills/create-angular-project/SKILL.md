---
name: create-angular-project
description: 'Scaffold a new Angular 21+ application or workspace using the Angular CLI with strict TypeScript, Vitest, and ESLint/Prettier.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: gpt-4.1
---

Scaffold a new Angular 21+ project with a production-ready baseline.

## Stack
- **`@angular/cli`** — `ng new` for project generation (standalone by default)
- **TypeScript** — strict mode with Angular compiler options
- **Vitest** — unit testing with jsdom (replaces Karma/Jest)
- **ESLint + Prettier** — via `setup-prettier-eslint-husky` skill

## Steps
1. **Ask first:**
   - Project name
   - Selector prefix (default: `app`)
   - Project type: **app** (application) or **workspace** (monorepo with library)?
   - Include Vitest? (default: yes)
   - Set up ESLint/Prettier? (default: yes)

2. **Run the scaffold script** (recommended):
   ```powershell
   pwsh scripts/New-AngularProject.ps1 -ProjectName <Name> [-SelectorPrefix app] [-UseVitest] [-UseEslint]
   ```
   The script runs `ng new`, replaces the tsconfig with strict settings, and sets up Vitest and ESLint.

3. **Alternatively — manual steps:**
   ```bash
   ng new <Name> --style scss --ssr false --standalone
   cd <Name>
   # Replace tsconfig.json with templates/tsconfig.json
   # If using Vitest: copy vitest.config.ts + vitest.setup.ts
   ```

4. **Verify:**
   ```bash
   ng build      # should complete with no errors
   npm test      # vitest run — all tests pass
   ng serve      # dev server starts at http://localhost:4200
   ```

5. **Next steps:** add components with `angular-component`, state with `angular-signal-store`

## Template Files
| File | Purpose |
|---|---|
| `templates/tsconfig.json` | Strict Angular compiler options: `noImplicitOverride`, `strictTemplates`, `module: preserve`, `target: ES2022` |
| `templates/vitest.config.ts` | Vitest: jsdom environment, globals, setup file, `include: ['**/*.spec.ts']` |
| `templates/vitest.setup.ts` | Empty Vitest setup file (expand as needed) |

## Scripts
- **`scripts/New-AngularProject.ps1`** — Full scaffold automation.
  ```powershell
  pwsh scripts/New-AngularProject.ps1 -ProjectName "my-app" -SelectorPrefix app -UseVitest -UseEslint
  ```
  Parameters: `-ProjectName` (required), `-SelectorPrefix`, `-ProjectType` (app/workspace), `-UseVitest` (switch), `-UseEslint` (switch)

## Constraints
- Angular 21+ only — requires `@angular/cli` ≥ 21 installed globally (`npm install -g @angular/cli`)
- Standalone components by default — do not use `NgModule` for new code
- Always use SCSS for styles
- SSR disabled by default (`--ssr false`) unless explicitly requested

## Tips
> **Use the `task` tool** for scaffolding — it's mechanical.
> Example: `#task pwsh scripts/New-AngularProject.ps1 -ProjectName "my-app" -UseVitest -UseEslint`

> 💡 **Model hint:** This is a mechanical task — a fast model like `gpt-4.1` is sufficient. Use `/model` to switch.
