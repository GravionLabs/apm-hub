---
name: setup-prettier-eslint-husky
description: 'Set up ESLint (flat config), Prettier with import organizer, and Husky pre-commit hooks in a JS/TS project. Configures auto-format on save for VSCode and WebStorm.'
allowed-tools: editFiles codebase runCommands
model: gpt-4.1
---

Set up a complete code quality pipeline for a JS/TS or Angular project.

## Stack
- **ESLint** — flat config (`eslint.config.mjs`), `@typescript-eslint`, `angular-eslint` for Angular
- **Prettier** — formatter + `prettier-plugin-organize-imports`
- **Husky** — git hooks manager (`npx husky init`)
- **lint-staged** — run linters on staged files only

## Steps
1. Ask: project type (Angular / plain TS), selector prefix (Angular only), IDE (VSCode / WebStorm / both / none)
2. **Run the setup script** (recommended):
   ```powershell
   pwsh scripts/Setup-CodeQuality.ps1 -ProjectType <angular|ts> [-SelectorPrefix app] [-IDE vscode]
   ```
   The script installs packages, copies templates, inits Husky, and patches `package.json`.
3. **Alternatively — manual steps:**
   ```bash
   npm install --save-dev eslint prettier prettier-plugin-organize-imports \
     husky lint-staged eslint-config-prettier \
     @typescript-eslint/eslint-plugin @typescript-eslint/parser
   # Angular: also add @angular-eslint/eslint-plugin @angular-eslint/eslint-plugin-template @angular-eslint/template-parser
   npx husky init
   echo "npx lint-staged" > .husky/pre-commit
   ```
4. Copy template files from `templates/` (see `## Template Files` below)
5. Add to `package.json`:
   ```json
   "lint-staged": {
     "src/**/*.{ts,html}": ["eslint --fix", "prettier --write"],
     "src/**/*.scss": ["prettier --write"]
   }
   ```

## Template Files
| File | Purpose |
|---|---|
| `.prettierrc` | Print width 100, single quotes, organize-imports plugin, Angular HTML override |
| `.prettierignore` | Ignores `dist/`, `node_modules/`, `.angular/`, `coverage/`, `*.min.*` |
| `.husky/pre-commit` | Runs `npx lint-staged` on commit |
| `angular/eslint.config.mjs` | ESM flat config: TypeScript + Angular ESLint + Prettier rules |
| `plain-ts/eslint.config.mjs` | ESM flat config: TypeScript + Prettier rules (no Angular deps) |

## Scripts
- **`scripts/Setup-CodeQuality.ps1`** — Full setup automation. Params: `-ProjectType`, `-SelectorPrefix`, `-IDE`

## Constraints
- Use flat config (`eslint.config.mjs`) — not legacy `.eslintrc`
- For Angular: update `SelectorPrefix` to match the project's component/directive prefix
- Do not override existing configs without confirmation

## Tips
> **Use the `task` tool** for the setup script — it's mechanical. Example:
> `#task pwsh scripts/Setup-CodeQuality.ps1 -ProjectType angular -SelectorPrefix app`
