---
name: setup-prettier-eslint-husky
description: 'Set up ESLint, Prettier with import organizer, Husky pre-commit hooks, and auto-format on save for VSCode and WebStorm'
---

# Set Up Prettier, ESLint, and Husky

Set up a complete code quality pipeline for an Angular project:
- **ESLint** (flat config) with Angular and TypeScript rules
- **Prettier** with `prettier-plugin-organize-imports` for automatic import sorting
- **Husky** + **lint-staged** for pre-commit hooks (formats/lints staged files only)
- **VSCode** and **WebStorm** auto-format on save

## Step 1 — Gather information

Ask the user:
- **Project type**: Angular workspace, Angular library, or plain TypeScript?
- **Selector prefix** (for Angular): what prefix do components use? (e.g., `app`, `gv`)
- **IDE**: VSCode, WebStorm, or both?
- **Existing config**: Are there existing `.eslintrc`, `.prettierrc`, or Husky files?

## Step 2 — Install packages

```bash
npm install --save-dev \
  eslint \
  @angular-eslint/eslint-plugin \
  @angular-eslint/eslint-plugin-template \
  @angular-eslint/template-parser \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  eslint-config-prettier \
  prettier-plugin-organize-imports \
  husky \
  lint-staged
```

> If Prettier is not yet installed: `npm install --save-dev prettier`

## Step 3 — Create `eslint.config.js`

Create `eslint.config.js` in the project root (ESLint 9 flat config format):

```js
// @ts-check
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const angular = require('@angular-eslint/eslint-plugin');
const angularTemplate = require('@angular-eslint/eslint-plugin-template');
const templateParser = require('@angular-eslint/template-parser');
const prettierConfig = require('eslint-config-prettier');

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', '.angular/**', 'coverage/**', '**/*.js', '**/*.mjs'],
  },

  // TypeScript – shared base
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
    },
    plugins: { '@typescript-eslint': tseslint, '@angular-eslint': angular },
    rules: {
      ...tseslint.configs['recommended'].rules,
      ...angular.configs.recommended.rules,
      '@angular-eslint/component-class-suffix': 'off',
      '@angular-eslint/directive-class-suffix': 'off',
      '@angular-eslint/no-empty-lifecycle-method': 'warn',
      '@angular-eslint/prefer-inject': 'warn',
      '@angular-eslint/component-selector': [
        'error',
        { type: ['element', 'attribute'], prefix: '<PREFIX>', style: 'kebab-case' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      ...prettierConfig.rules,
    },
  },

  // Angular HTML templates
  {
    files: ['**/*.html'],
    languageOptions: { parser: templateParser },
    plugins: { '@angular-eslint/template': angularTemplate },
    rules: { ...angularTemplate.configs.recommended.rules },
  },
];
```

Replace `<PREFIX>` with the actual component selector prefix (e.g., `app` or `gv`).

> **Multiple projects in one workspace?** Add separate config blocks with `files: ['projects/lib/**/*.ts']` and `files: ['projects/demo/**/*.ts']` to apply different prefix rules.

## Step 4 — Update `.prettierrc`

Add `prettier-plugin-organize-imports`. The plugin uses TypeScript's API to sort imports on every format.

```json
{
  "printWidth": 100,
  "singleQuote": true,
  "plugins": ["prettier-plugin-organize-imports"],
  "overrides": [
    {
      "files": "*.html",
      "options": {
        "parser": "angular",
        "plugins": []
      }
    }
  ]
}
```

> The `"plugins": []` override for HTML prevents the import organizer from running on templates (it only applies to TypeScript files).

## Step 5 — Create `.prettierignore`

```
dist/
node_modules/
.angular/
coverage/
*.min.js
*.min.css
```

## Step 6 — Set up Husky + lint-staged

### Initialize Husky

```bash
npx husky init
```

This creates `.husky/` and a `prepare` script in `package.json`.

### Create `.husky/pre-commit`

```bash
npx lint-staged
```

Make the file executable: `chmod +x .husky/pre-commit`

### Configure `lint-staged` in `package.json`

```json
{
  "lint-staged": {
    "**/*.{ts,html}": ["eslint --fix", "prettier --write"],
    "**/*.scss": ["prettier --write"]
  }
}
```

### Add scripts to `package.json`

```json
{
  "scripts": {
    "lint": "eslint \"**/*.ts\" \"**/*.html\"",
    "lint:fix": "eslint \"**/*.ts\" \"**/*.html\" --fix",
    "format": "prettier --write \"**/*.{ts,html,scss}\"",
    "format:check": "prettier --check \"**/*.{ts,html,scss}\"",
    "prepare": "husky"
  }
}
```

## Step 7 — Configure VSCode

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.validate": ["typescript", "html"],
  "eslint.useFlatConfig": true,
  "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[html]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[scss]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "prettier.requireConfig": true
}
```

Create/update `.vscode/extensions.json` to recommend:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "EditorConfig.EditorConfig"
  ]
}
```

## Step 8 — Configure WebStorm

Create `.idea/prettier.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="PrettierConfiguration">
    <option name="myConfigurationMode" value="AUTOMATIC" />
    <option name="myRunOnSave" value="true" />
    <option name="myRunOnReformat" value="true" />
  </component>
</project>
```

WebStorm auto-detects `eslint.config.js` when ESLint is installed. Verify in **Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint** that "Automatic ESLint configuration" is selected and "Run eslint --fix on save" is checked.

## Step 9 — Run initial format pass

Format all existing sources once to establish a clean baseline:

```bash
npm run format
```

Then verify the build still passes:

```bash
npm run build   # or ng build
```

## Verification

Test the pre-commit hook works:

```bash
git add .
git commit -m "test: verify pre-commit hook"
# Should run lint-staged automatically
```

Run a full lint check:

```bash
npm run lint
```
