---
name: playwright
description: >
  Use this skill when creating, modifying, or debugging Playwright tests using the Playwright CLI.
  This skill is language-agnostic and works for Angular (TypeScript), .NET, and Python projects.
  Prefer the Playwright CLI over any MCP server because it is more efficient, avoids large snapshots
  in the LLM context, and provides deterministic browser automation.

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

This skill uses the Playwright CLI for all browser automation, test generation, and debugging tasks.
The CLI is preferred because it:
- stores snapshots on disk instead of sending them to the LLM
- avoids large tool schemas
- is faster and more deterministic
- works across all languages (TS/JS, .NET, Python)

## When to Use This Skill

Trigger this skill when the user asks to:
- create new Playwright tests
- record tests using the CLI
- debug tests
- generate locators
- update selectors
- run tests in CI
- integrate Playwright into Angular, .NET, or Python projects
- migrate tests between languages
- analyze failing tests

## Decision Flow

1. Determine project type:
   - Angular → look for `angular.json`, `src/app`, `package.json`
   - .NET → look for `.csproj`, `Program.cs`, `appsettings.json`
   - Python → look for `.py` files and `requirements.txt`

2. Determine Playwright installation:
   - If `package.json` contains `@playwright/test` → TypeScript/JavaScript mode
   - If `.csproj` contains `Microsoft.Playwright` → .NET mode
   - If `requirements.txt` contains `playwright` → Python mode

3. Always use the Playwright CLI:
   - `npx playwright codegen`
   - `npx playwright test`
   - `npx playwright show-report`
   - `npx playwright install`
   - `npx playwright open`

4. When generating code:
   - Follow the conventions of the detected project type
   - Place tests in the correct folder:
     - Angular: `src/tests/` or `e2e/`
     - .NET: `Tests/Playwright/`
     - Python: `tests/`

5. When debugging:
   - Prefer `npx playwright test --debug`
   - Use CLI trace viewer: `npx playwright show-trace trace.zip`

## Best Practices

- Always generate selectors using the CLI (`codegen`) instead of guessing.
- Prefer `getByRole`, `getByTestId`, and `getByLabel` over CSS selectors.
- Use `await expect(locator).toBeVisible()` instead of manual waits.
- Use test fixtures (`test.beforeEach`) for login flows.
- Store credentials in environment variables, never in test files.
- Use `--project=chromium` when debugging for speed.
- Use `--headed` only when necessary.

## Language-Specific Notes

### Angular (TypeScript)
- Tests should live outside the Angular build pipeline.
- Use `@playwright/test` runner, not Protractor.
- Use Angular test IDs (`data-testid`) for stable selectors.

### .NET
- Use `PlaywrightTest` base class when available.
- Use async test methods (`async Task`).
- Store browser and context in fixtures.

### Python
- Use `pytest` with the Playwright plugin.
- Use async mode (`pytest-asyncio`) for advanced scenarios.

## Gotchas

- Do not mix Playwright MCP with Playwright CLI.
- Do not load snapshots into the LLM context.
- Do not use CSS selectors for dynamic Angular components.
- Always run `npx playwright install` after dependency changes.
- Avoid `page.waitForTimeout()` unless absolutely necessary.
