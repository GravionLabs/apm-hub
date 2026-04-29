---
name: playwright-test-generator
description: >
  Use this skill to generate Playwright test code for TypeScript (Angular), .NET, or Python.
  This skill does not run browsers itself; it generates test files that are executed via the
  Playwright CLI. It automatically detects the project language and produces idiomatic,
  framework‑correct test code for each environment.

allowed-tools:
  - read
  - write
  - editFiles
  - search
  - codebase

license: MIT
---

## Overview

This skill generates Playwright test code in the correct language and structure for the project:
- Angular / TypeScript → @playwright/test
- .NET → Microsoft.Playwright
- Python → pytest + Playwright

The Playwright CLI is always used for execution, recording, debugging, and trace viewing.
This skill only generates code; it does not run tests.

## When to Use This Skill

Trigger this skill when the user asks to:
- create a new Playwright test
- convert a recorded CLI session into test code
- migrate tests between languages
- scaffold test folders
- generate selectors or test fixtures
- create login flows or reusable helpers
- add tests to Angular, .NET, or Python projects

## Project Detection

1. **Angular / TypeScript**
   - Detect via: `angular.json`, `package.json`, `src/app`
   - Test folder: `e2e/` or `src/tests/`
   - Test extension: `.spec.ts`

2. **.NET**
   - Detect via: `.csproj`, `Program.cs`
   - Test folder: `Tests/Playwright/`
   - Test extension: `.cs`

3. **Python**
   - Detect via: `requirements.txt`, `.py` files
   - Test folder: `tests/`
   - Test extension: `.py`

## Code Generation Rules

### TypeScript (Angular)
- Use `@playwright/test`
- Use fixtures: `test.beforeEach(async ({ page }) => {})`
- Prefer `getByRole`, `getByLabel`, `getByTestId`
- Use async/await everywhere
- Use `expect(locator).toBeVisible()`

### .NET
- Use `using Microsoft.Playwright;`
- Use async test methods: `public async Task TestName()`
- Use `await using var browser = playwright.Chromium.LaunchAsync(...)`
- Use strongly typed locators: `page.GetByRole(...)`

### Python
- Use pytest with the Playwright plugin
- Use async mode when needed
- Use fixtures: `def test_example(page):`
- Use `page.get_by_role(...)`

## Test Placement Rules

- Never place tests inside Angular’s build pipeline (`src/app`)
- Never place tests inside .NET production projects
- Never place tests inside Python package folders

## Best Practices

- Always generate selectors using the CLI (`codegen`) instead of guessing
- Prefer role‑based selectors over CSS
- Use fixtures for login flows
- Use environment variables for credentials
- Use `expect` assertions instead of manual waits
- Keep tests deterministic and idempotent

## Gotchas

- Do not mix languages inside a single test suite
- Do not use CSS selectors for Angular Material components
- Do not store browser contexts in global variables
- Do not use `waitForTimeout` unless unavoidable
- Always run `npx playwright install` after dependency changes
