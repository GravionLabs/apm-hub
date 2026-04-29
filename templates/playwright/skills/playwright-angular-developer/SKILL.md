---
name: playwright-angular-developer
description: >
  Use this skill when creating, modifying, or debugging Playwright tests specifically for Angular
  applications. This includes Angular Material components, routing, SSR, hydration, test IDs,
  change detection timing, and component-driven UI patterns. The skill always uses the Playwright CLI
  for recording, debugging, and selector generation.

allowed-tools:
  - read
  - write
  - editFiles
  - search
  - codebase
  - execute
  - runCommands

license: MIT
---

## Overview

This skill focuses on Angular-specific Playwright testing patterns. It ensures stable selectors,
correct handling of Angular Material, proper routing behavior, SSR/hydration awareness, and
deterministic test flows. It always uses the Playwright CLI for recording, debugging, and trace
analysis.

## When to Use This Skill

Trigger this skill when the user asks to:
- write Playwright tests for Angular components or pages
- test Angular Material components (mat-select, mat-dialog, mat-menu, mat-table)
- test Angular routing, guards, lazy-loaded modules
- test SSR or hydration behavior
- generate stable Angular selectors
- debug Angular-specific timing issues
- test forms, reactive forms, validation, or change detection
- test Angular animations or transitions
- test Angular CDK overlays (menus, dialogs, tooltips)

## Angular Detection

Detect Angular projects via:
- `angular.json`
- `src/app/`
- `package.json` containing `@angular/*`
- presence of Angular Material (`@angular/material`)

## Selector Rules (Critical)

Angular apps require stable selectors. Always:
- Prefer `getByTestId()` using `data-testid`
- Prefer `getByRole()` for Material components
- Avoid CSS selectors for dynamic components
- Avoid selecting by Angular-generated attributes (e.g., `_ngcontent-*`)
- Avoid selecting by Material internals (e.g., `.mat-mdc-*`)

### Recommended TestID Pattern
Use this in Angular templates:

```html
<button data-testid="save-button">Save</button>
```

Then in Playwright:

```typescript
await page.getByTestId('save-button').click();
```

## Angular Material Testing
TODO:
