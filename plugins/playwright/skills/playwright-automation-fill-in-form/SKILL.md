---
name: playwright-automation-fill-in-form
description: 'Automate filling in a web form using Playwright MCP: navigate to the form, fill fields with provided data, validate before submitting.'
allowed-tools: execute shell runCommands write edit editFiles playwright
model: claude-sonnet-4.6
---

Automate filling in a web form using Playwright MCP.

## Stack
- **CLI:** `npx playwright test`, `npx playwright codegen <url>`
- **MCP:** Playwright MCP (live browser interaction)

## Steps
1. Ask for: target URL, field values, and whether to submit
2. Navigate to the form URL using Playwright MCP
3. Take a snapshot — identify all form fields and their locators
4. Fill each field using the appropriate method:

```typescript
// Text inputs
await page.getByLabel('Name').fill('John Doe');

// Dropdowns
await page.getByLabel('Country').selectOption('DE');

// Checkboxes / radio buttons
await page.getByRole('checkbox', { name: 'Accept terms' }).check();

// File upload
await page.getByLabel('Upload').setInputFiles('/path/to/file.png');

// Date pickers (use fill or click+type)
await page.getByLabel('Date').fill('2025-07-15');
```

5. Verify all fields are filled correctly before submission
6. If submission is approved: click submit and verify success state
7. **Never submit without explicit user confirmation**

## Rules
- Always verify the filled state before submitting
- Pause for review if any field fails to fill
- Generate a reusable test script if the automation will be repeated

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
