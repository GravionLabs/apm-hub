---
name: playwright-generate-test
description: 'Generate a Playwright TypeScript test for a given scenario using the Playwright MCP. Explores the page live, identifies locators, writes and runs the test until it passes.'
allowed-tools: editFiles runCommands playwright
model: claude-sonnet-4.6
---

Generate a passing Playwright TypeScript test for a user scenario.

## Stack
- **CLI:** `npx playwright test`, `npx playwright show-report`, `npx playwright codegen`
- **Package manager:** npm / pnpm
- **MCP:** Playwright MCP (live browser interaction)

## Steps
1. Ask for the scenario if not provided
2. Navigate to the target URL using Playwright MCP
3. Identify correct locators from live page snapshot — prefer `data-testid`, roles, accessible names
4. Write the test using `@playwright/test` with `async/await`
5. Save to `tests/` directory using `.spec.ts` naming
6. Run: `npx playwright test <file> --headed` — iterate until passing

## Locator priority
1. `getByRole()` — semantic, resilient to UI changes
2. `getByTestId()` — explicit test hooks (`data-testid`)
3. `getByLabel()` / `getByText()` — visible content
4. CSS/XPath — last resort only

## Test structure
```typescript
import { test, expect } from '@playwright/test';

test('scenario description', async ({ page }) => {
  await page.goto('/path');
  await expect(page.getByRole('heading', { name: 'Title' })).toBeVisible();
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page).toHaveURL(/success/);
});
```

## Rules
- One scenario per test — keep tests independent and isolated
- Use `expect` assertions — never silent clicks with no verification
- Await all Playwright actions — never `.then()` chains

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
