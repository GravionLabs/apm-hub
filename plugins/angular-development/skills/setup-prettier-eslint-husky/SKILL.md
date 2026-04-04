---
name: setup-prettier-eslint-husky
description: 'Set up ESLint (flat config), Prettier with import organizer, and Husky pre-commit hooks in a JS/TS project. Configures auto-format on save for VSCode and WebStorm.'
allowed-tools: editFiles codebase runCommands
---

Set up a complete code quality pipeline for a JS/TS or Angular project.

## What this skill does
Installs and configures ESLint (flat config), Prettier with `prettier-plugin-organize-imports`, and Husky + lint-staged for pre-commit hooks. Adds IDE settings for auto-format on save.

## Steps
1. Ask: project type (Angular / plain TS), selector prefix (Angular), IDE (VSCode / WebStorm / both), existing config files
2. Install packages:
   ```bash
   npm install --save-dev eslint @eslint/js typescript-eslint prettier prettier-plugin-organize-imports husky lint-staged
   ```
3. Create `eslint.config.mjs` using flat config with TypeScript and (if Angular) `angular-eslint` rules
4. Create `.prettierrc` with `prettier-plugin-organize-imports` and `.prettierignore`
5. Init Husky: `npx husky init` — add `pre-commit` hook running `lint-staged`
6. Configure `lint-staged` in `package.json` to run `eslint --fix` and `prettier --write` on staged files
7. Add VSCode `.vscode/settings.json` with `editor.formatOnSave` and default formatter; add WebStorm `.idea/watcherTasks.xml` if requested

## Constraints
- Use flat config (`eslint.config.mjs`) — not legacy `.eslintrc`
- For Angular: include `@angular-eslint/eslint-plugin` rules and respect the selector prefix
- Do not override existing configs without confirmation
