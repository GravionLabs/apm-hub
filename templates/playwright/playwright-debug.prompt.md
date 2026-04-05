---
name: playwright-debug
description: "Step-by-step workflow to diagnose and fix failing or flaky Playwright tests: timeouts, selector issues, race conditions, trace analysis, and browser-specific failures."
mode: ask
tools: [codebase, runCommands, problems]
---

# Playwright Test Debugger

Use this prompt when a Playwright test is failing, flaky, or timing out.

## Step 1 — Reproduce and capture the failure

```bash
# Run with debug mode (opens Playwright Inspector, pauses at each step)
npx playwright test <spec-file> --debug

# Run headed (see the browser)
npx playwright test <spec-file> --headed

# Run with trace (capture full timeline for analysis)
npx playwright test <spec-file> --trace on
```

Share the error message — it usually specifies: timeout, element not found, assertion failed.

## Step 2 — Analyze the trace

```bash
# Open trace viewer (after --trace on run)
npx playwright show-trace test-results/<test>/trace.zip
```

The trace shows: timeline, network requests, DOM snapshots at each step, console errors.
Look for: what was visible on screen when the failure occurred?

## Step 3 — Fix selector issues

Fragile selectors are the #1 cause of flaky tests. Replace with resilient locators:

```typescript
// ❌ Fragile — breaks when CSS classes change
page.locator('.submit-btn.active')

// ✅ Resilient — semantic, stable
page.getByRole('button', { name: 'Submit' })
page.getByTestId('submit-btn')       // requires data-testid="submit-btn"
page.getByLabel('Email address')
page.getByText('Confirm order')
```

If `data-testid` is missing: ask the dev team to add it to the component.

## Step 4 — Fix timing issues

```typescript
// Wait for element to appear before interacting
await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();

// Wait for loading indicator to disappear
await page.getByTestId('spinner').waitFor({ state: 'hidden' });

// Wait for network requests after action
await page.waitForLoadState('networkidle');

// Pause during debug (opens Inspector at this point)
await page.pause();
```

## Step 5 — Fix race conditions in async flows

```typescript
// ❌ Don't fire-and-forget navigation
page.click('a[href="/next"]');
await page.waitForURL('/next');   // may miss the navigation

// ✅ Await both
await Promise.all([
  page.waitForURL('/next'),
  page.click('a[href="/next"]'),
]);
```

## Step 6 — Test browser-specific failures

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

Browsers handle: CSS animations, focus management, and date inputs differently.

## Step 7 — Re-run flaky tests with retry

```bash
# Run with retries to confirm true flakiness
npx playwright test --retries=3
```

A test that passes on retry is flaky — find and fix the root cause.

## Checklist

- [ ] Failure message identified and error type classified (timeout / assertion / network)
- [ ] Trace analyzed — DOM state at failure captured
- [ ] Fragile selectors replaced with `getByRole` / `getByTestId`
- [ ] Explicit waits added before interactions
- [ ] Race conditions fixed with `Promise.all` or `waitFor`
- [ ] All configured browsers tested
- [ ] Test passes consistently without `--retries`
