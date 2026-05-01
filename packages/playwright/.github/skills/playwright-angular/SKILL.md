---
name: playwright-angular
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

**Start by adding `data-testid` to your Angular templates:**

```html
<!-- app.component.html -->
<button data-testid="save-button" (click)="save()">Save</button>

<mat-select data-testid="priority-select" [(value)]="selectedPriority">
  <mat-option value="high">High</mat-option>
  <mat-option value="medium">Medium</mat-option>
</mat-select>

<mat-dialog-container data-testid="confirm-dialog">
  <button data-testid="confirm-btn" (click)="onConfirm()">Confirm</button>
  <button data-testid="cancel-btn" (click)="onCancel()">Cancel</button>
</mat-dialog-container>
```

Then query using `getByTestId()` in tests:

```typescript
// ✅ Stable: using data-testid
await page.getByTestId('save-button').click();
await page.getByTestId('priority-select').click();
await page.getByTestId('confirm-btn').click();

// ✅ Semantic fallback: role-based
await page.getByRole('button', { name: 'Save' }).click();
await page.getByRole('combobox', { name: 'Priority' }).click();

// ❌ Avoid: class-based (breaks on Material upgrades)
await page.locator('.mat-mdc-button').click();
```

### Material Components Testing Patterns

**Dialogs** — Use data-testid + modal detection:
```typescript
// Open dialog
await page.getByTestId('open-dialog-btn').click();

// Verify dialog is visible
await expect(page.getByTestId('confirm-dialog')).toBeVisible();

// Click confirm in dialog
await page.getByTestId('confirm-btn').click();

// Verify dialog closed
await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();
```

**Material Selects/Dropdowns** — Combine data-testid with role queries:
```typescript
// Click select to open dropdown
await page.getByTestId('priority-select').click();

// Select option by role (options appear in overlay)
await page.getByRole('option', { name: 'High' }).click();

// Verify selection
await expect(page.getByTestId('priority-select')).toContainText('High');
```

**Material Tables** — Use data-testid on table + rows:
```html
<table data-testid="users-table">
  <tr *ngFor="let user of users" data-testid="user-row-{{user.id}}">
    <td>{{ user.name }}</td>
    <td><button data-testid="user-edit-{{user.id}}">Edit</button></td>
  </tr>
</table>
```

```typescript
// Find and edit specific user
await page.getByTestId('user-row-123').getByTestId('user-edit-123').click();
```

**Date Pickers** — Use input field or picker widget:
```typescript
// Via input with data-testid
await page.getByTestId('birth-date-input').fill('12/25/1990');

// Via picker widget
await page.getByTestId('date-picker-btn').click();
await page.getByRole('button', { name: '15' }).click();
```

### Component Template Reference with data-testid

Use Angular template references (`#ref`) alongside `data-testid`:

```html
<!-- Angular template with template reference + data-testid -->
<div #contentArea data-testid="content-area">
  <form #loginForm data-testid="login-form">
    <input #emailInput data-testid="email-input" type="email" />
    <input #passwordInput data-testid="password-input" type="password" />
  </form>
</div>
```

In tests, query by `data-testid`:

```typescript
test('login form submission', async ({ page }) => {
  // Always use data-testid in Playwright (not template refs)
  await page.getByTestId('email-input').fill('user@example.com');
  await page.getByTestId('password-input').fill('password123');
  await page.getByTestId('login-form').locator('button[type="submit"]').click();
});
```

**Why data-testid is standard for E2E testing:**
- Template refs (`#ref`) are Angular runtime objects — not accessible from Playwright
- Playwright runs outside the Angular app context
- Always use `data-testid` for Playwright tests
- `data-testid` makes intent explicit: "this element is for testing"

## Angular Routing & Navigation

Test navigation flows correctly by handling Angular's routing lifecycle:

```typescript
test('navigate to detail page', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'User #123' }).click();
  
  // Wait for route change + content load
  await page.waitForURL('/users/123');
  await expect(page.getByRole('heading', { name: /user details/i })).toBeVisible();
});
```

### Lazy-Loaded Modules

Ensure lazy-loaded module content is visible before interaction:

```typescript
test('access lazy-loaded feature', async ({ page }) => {
  await page.goto('/admin/reports');
  
  // Wait for module to load + render
  await expect(page.getByTestId('report-list')).toBeVisible();
  
  // Then interact
  await page.getByRole('button', { name: 'Generate Report' }).click();
});
```

### Route Guards

Test routes protected by guards (auth, permissions):

```typescript
test('redirect to login for unauthorized access', async ({ page }) => {
  await page.goto('/admin');  // Protected route
  
  // Should redirect to login
  await page.waitForURL('/login');
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
});
```

## SSR & Hydration Testing

For Angular Universal apps, test both server-rendered and hydrated states:

```typescript
test('hydrate correctly', async ({ page }) => {
  // Navigate to SSR page
  await page.goto('/product/123');
  
  // Verify server-rendered content
  await expect(page.getByRole('heading', { name: 'Product Name' })).toBeVisible();
  
  // Trigger hydration (interact)
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  
  // Verify client-side state after hydration
  await expect(page.getByText('1 item in cart')).toBeVisible();
});
```

## Change Detection & Timing

Angular's change detection can cause flaky tests. Always wait for state, not time:

```typescript
// ❌ Flaky — arbitrary wait
await page.waitForTimeout(500);
await page.getByText('Loading complete').click();

// ✅ Deterministic — wait for state
await expect(page.getByTestId('loader')).not.toBeVisible();
await page.getByRole('button', { name: 'Continue' }).click();
```

**OnPush Change Detection** — If component uses `ChangeDetectionStrategy.OnPush`, Playwright actions may not trigger change detection. Always verify state after action:

```typescript
await page.getByRole('button', { name: 'Update' }).click();
await expect(page.getByText('Updated')).toBeVisible();  // Wait for observable update
```

## Angular Signals Testing

For components using Angular Signals:

```typescript
test('signal-based counter', async ({ page }) => {
  await page.goto('/signals-demo');
  
  // Signal updates are reactive (no zone.js delays)
  await page.getByRole('button', { name: 'Increment' }).click();
  await expect(page.getByText('Count: 1')).toBeVisible();
  
  // No artificial waits needed — Signals are synchronous
  await page.getByRole('button', { name: 'Increment' }).click();
  await expect(page.getByText('Count: 2')).toBeVisible();
});
```

## Animation Testing

Skip animations in tests for deterministic results. Update `playwright.config.ts`:

```typescript
use: {
  reducedMotion: 'reduce',  // Skip animations in tests
},
```

Or disable in specific tests:

```typescript
test('skip animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  
  // Navigation animates instantly
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Step 2' })).toBeVisible();
});
```

## Angular CDK Testing

For CDK components (overlays, virtual scrolling, focus management):

```typescript
test('cdk overlay dialog', async ({ page }) => {
  await page.goto('/cdk-dialog');
  
  // Open overlay
  await page.getByRole('button', { name: 'Open' }).click();
  
  // Query overlay content (rendered outside app root)
  await expect(page.getByRole('dialog', { hidden: false })).toBeVisible();
  
  // Close overlay
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
```

## Best Practices

1. **Add `data-testid` to Angular templates** — Mark testable elements explicitly
2. **Prefer `getByRole()` for Material** — More resilient than class selectors
3. **Wait for state, not time** — Use `expect().toBeVisible()` instead of `waitForTimeout()`
4. **Avoid `_ngcontent-*` selectors** — Angular-generated; changes on rebuilds
5. **Test via UI, not internals** — Don't test Angular properties directly
6. **Use fixtures for login** — Avoid re-authenticating in every test
7. **Store credentials in env vars** — Never hardcode in test files
8. **Use `playwright-cli` for codegen and debugging** — See `playwright-cli` skill for CLI commands

## Gotchas

- Do not mix `test.beforeEach` with Angular dependency injection — use Playwright fixtures
- Do not rely on Angular testing utilities (TestBed) in Playwright — test via UI only
- Do not use `.toBeTruthy()` for Material — use `.toBeVisible()` instead
- Always run `ng serve` before testing — Playwright connects to running app
- Do not use CSS selectors with dynamically generated classes — prefer `getByRole()` or `data-testid`
- Angular Material components render overlays outside the app root — use `hidden: false` to query them
