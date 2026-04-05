---
name: playwright-debug
description: 'Debug flaky Playwright tests: diagnose timeout errors, selector failures, race conditions, and browser-specific issues using --debug, --trace, and Playwright Inspector.'
allowed-tools: codebase runCommands
model: claude-sonnet-4.6
---

Diagnose and fix failing or flaky Playwright tests.

## Stack
- **CLI:** `npx playwright test`, `npx playwright show-trace`, `npx playwright open`
- **Debug modes:** `--debug`, `--trace on`, `--headed`, `page.pause()`

## Common failure causes & fixes

### 1 — Timeout / element not found
```bash
npx playwright test --debug         # opens Playwright Inspector, step through
npx playwright test --headed        # see the browser visually
```
Fix: use `waitFor` or assert element visibility before interaction:
```typescript
await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
await page.getByRole('button', { name: 'Submit' }).click();
```

### 2 — Flaky test (passes sometimes, fails sometimes)
Likely causes: animation delay, network latency, race condition.
```typescript
// Wait for network idle after navigation
await page.goto('/app', { waitUntil: 'networkidle' });

// Wait for specific element state
await page.getByTestId('loader').waitFor({ state: 'hidden' });
```

### 3 — Capture a trace for CI failures
```bash
npx playwright test --trace on      # record trace on every run
npx playwright show-trace trace.zip # analyze in visual trace viewer
```
Trace shows: timeline, network, DOM snapshots, console logs.

### 4 — Selector too fragile
Replace CSS selectors with resilient locators:
```typescript
// ❌ Fragile
page.locator('.btn-primary-7a3f')

// ✅ Resilient
page.getByRole('button', { name: 'Save' })
page.getByTestId('save-btn')
```

### 5 — Browser-specific failures
```bash
npx playwright test --project=firefox    # test specific browser
npx playwright test --project=webkit
```

## Debug checklist
- [ ] Run with `--debug` to step through — identify exact failure point
- [ ] Record trace with `--trace on` — review DOM at each step
- [ ] Replace fragile CSS/XPath selectors with `getByRole` / `getByTestId`
- [ ] Add explicit `expect` waits before interaction
- [ ] Check `page.waitForLoadState` after navigation
- [ ] Test all configured browsers (`npx playwright test` without `--project`)
