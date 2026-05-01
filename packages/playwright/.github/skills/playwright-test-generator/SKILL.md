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

## Code Generation Examples

### TypeScript (Angular)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://app.example.com/login');
  });

  test('should log in with valid credentials', async ({ page }) => {
    // Use data-testid for Angular components
    await page.fill('[data-testid="username"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    
    await page.click('[data-testid="login-button"]');
    
    // Wait for navigation
    await page.waitForURL('**/dashboard');
    
    // Verify logged-in state
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });
});
```

**File placement:** `e2e/login.spec.ts` or `src/tests/login.spec.ts`

**Run with:** `npx playwright test e2e/login.spec.ts`

### .NET

```csharp
using Microsoft.Playwright;
using NUnit.Framework;

namespace Tests.Playwright;

[TestFixture]
public class LoginTests
{
    private IBrowser _browser;
    private IPage _page;

    [SetUp]
    public async Task Setup()
    {
        var playwright = await Playwright.CreateAsync();
        _browser = await playwright.Chromium.LaunchAsync();
        var context = await _browser.NewContextAsync();
        _page = await context.NewPageAsync();
        await _page.GotoAsync("https://app.example.com/login");
    }

    [TearDown]
    public async Task Teardown()
    {
        await _browser?.CloseAsync();
    }

    [Test]
    public async Task LoginTest_ValidCredentials_LogsInSuccessfully()
    {
        await _page.FillAsync("[data-testid='username']", "user@example.com");
        await _page.FillAsync("[data-testid='password']", "password123");
        
        await _page.ClickAsync("[data-testid='login-button']");
        
        await _page.WaitForURLAsync("**/dashboard");
        
        await Assertions.Expect(_page.Locator("[data-testid='user-menu']")).ToBeVisibleAsync();
    }
}
```

**File placement:** `Tests/Playwright/LoginTests.cs`

**Run with:** `dotnet test Tests/Playwright/LoginTests.cs`

### Python

```python
import pytest
from playwright.async_api import async_playwright, expect

@pytest.fixture
async def page():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()
        await page.goto("https://app.example.com/login")
        yield page
        await context.close()
        await browser.close()

@pytest.mark.asyncio
async def test_login_with_valid_credentials(page):
    await page.fill('[data-testid="username"]', 'user@example.com')
    await page.fill('[data-testid="password"]', 'password123')
    
    await page.click('[data-testid="login-button"]')
    
    await page.wait_for_url('**/dashboard')
    
    await expect(page.locator('[data-testid="user-menu"]')).to_be_visible()
```

**File placement:** `tests/test_login.py`

**Run with:** `pytest tests/test_login.py`

## Codegen → Test Conversion Workflow

1. **Explore the app using `playwright-cli`** to understand structure and find stable selectors:
   ```bash
   playwright-cli open https://app.example.com/login
   playwright-cli snapshot           # Get accessibility tree
   playwright-cli screenshot         # Visual verification
   ```

2. **Record test code** using `npx playwright codegen` (`@playwright/test`):
   ```bash
   npx playwright codegen https://app.example.com/login
   # Browser opens → click, type, verify → Playwright records code
   ```

3. **Copy generated code** into test file and adapt for language:
   - **TypeScript:** Wrap in `test()` block, add `@playwright/test` imports
   - **.NET:** Convert JavaScript syntax to C# (async Task, GetByRole, etc.)
   - **Python:** Convert to pytest fixture pattern, use snake_case locators

4. **Run tests** via language-specific runner:
   ```bash
   npx playwright test e2e/login.spec.ts   # TypeScript/Angular
   dotnet test Tests/Playwright/           # .NET
   pytest tests/test_login.py              # Python
   ```

## Language-Specific Tips

### TypeScript (Angular)

- Use `data-testid` attributes in your Angular templates for stable selectors
- Import fixtures from `@playwright/test` for setup/teardown
- Use `test.describe()` for test groups
- Async/await is native to TypeScript
- Run `npm install -D @playwright/test` first

### .NET

- Follow `async Task` pattern (not sync methods)
- Use `await using var browser` for proper cleanup
- Test naming: `TestName_Scenario_ExpectedResult` (csharp-nunit convention)
- Use `Assertions.Expect(locator).ToBeVisibleAsync()` (not `Assert`)
- Add `NUnit` or MSTest framework reference in `.csproj`

### Python

- Use pytest fixtures for setup/teardown (not class-based)
- Import `async_playwright` if using async
- Use `await` for all browser operations (even in sync tests with pytest-asyncio)
- Use `@pytest.mark.asyncio` decorator
- Use `pytest.ini` or `pyproject.toml` for configuration

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
- Always run `npx playwright install` after dependency changes (`@playwright/test` projects)
