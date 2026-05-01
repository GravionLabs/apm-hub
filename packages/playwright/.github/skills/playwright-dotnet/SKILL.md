---
name: playwright-dotnet
description: >
  Use this skill when creating, modifying, or debugging Playwright tests for .NET/NUnit projects.
  This includes NUnit test setup, async Task patterns, strongly typed locators, fixture management,
  and page object patterns. Tests are executed via `dotnet test` and Playwright CLI for recording,
  debugging, and trace analysis.

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

This skill focuses on .NET/NUnit Playwright testing patterns. It ensures proper use of NUnit
attributes, async/await with `async Task`, strongly typed locators, page objects, fixture
isolation, and deterministic test flows. Tests follow csharp-nunit conventions and are
executed via the Playwright CLI or `dotnet test`.

## When to Use This Skill

Trigger this skill when the user asks to:
- create Playwright tests in a .NET/NUnit project
- set up Playwright with NUnit base classes
- write async test methods (`async Task`)
- use `Page` and `BrowserContext` fixtures
- test .NET web apps (ASP.NET Core, Blazor)
- debug .NET-specific timing or async issues
- create page objects for Playwright tests
- integrate Playwright into existing NUnit test suites

## Project Detection & Setup

Detect .NET/NUnit projects via:
- `.csproj` containing `Microsoft.Playwright.NUnit` package
- `[Test]` attributes in test classes
- `test/` directory structure with `*.Tests` project naming

### 1. Add Playwright NUnit Package

```bash
# In test project directory
dotnet add package Microsoft.Playwright.NUnit
```

### 2. Install Browsers

```bash
dotnet build
# For .NET 8.0 (adjust version as needed)
pwsh bin/Debug/net8.0/playwright.ps1 install
```

### 3. Project Structure

```
src/
  MyApp/
    Services/
      UserService.cs
    Pages/
      LoginPage.cs

test/
  MyApp.Tests/
    Services/
      UserServiceTests.cs
    Pages/
      LoginPageTests.cs
```

## Test Conventions (Following csharp-nunit)

### Test Naming

Use `MethodName_Scenario_ExpectedResult` naming for test methods:

```csharp
[Test]
public async Task LoginWithValidCredentials_WhenCorrectPasswordProvided_LogsInSuccessfully()
{
    // Test code
}

[Test]
public async Task LoginWithInvalidCredentials_WhenWrongPasswordProvided_ShowsErrorMessage()
{
    // Test code
}
```

### Test Structure (AAA Pattern)

```csharp
[Test]
public async Task LoginWithValidCredentials_WhenCorrectPasswordProvided_LogsInSuccessfully()
{
    // Arrange - set up test data and page
    var page = await Browser.NewPageAsync();
    await page.GotoAsync("https://example.com/login");
    
    // Act - perform the action being tested
    await page.GetByLabel("Email").FillAsync("user@example.com");
    await page.GetByLabel("Password").FillAsync("password123");
    await page.GetByRole(AriaRole.Button, new() { Name = "Sign In" }).ClickAsync();
    
    // Assert - verify the result
    await Expect(page).ToHaveTitleAsync(new Regex("Dashboard"));
    await Expect(page.GetByText("Welcome, User")).ToBeVisibleAsync();
}
```

### Test Categories

Use NUnit `[Category]` attribute:

```csharp
[Category("E2E")]
[Test]
public async Task LoginFlow_WithValidCredentials_RedirectsToDashboard()
{
    // Test code
}

[Category("E2E")]
[Category("Slow")]
[Test]
public async Task FullUserJourney_FromSignupToProfile_CompletesSuccessfully()
{
    // Test code
}
```

## Base Test Class

Use `PageTest` base class from `Microsoft.Playwright.NUnit`:

```csharp
using NUnit.Framework;
using Microsoft.Playwright.NUnit;

[Parallelizable(ParallelScope.Self)]
public class LoginPageTests : PageTest
{
    [SetUp]
    public async Task Setup()
    {
        // Called before each test
        // Page fixture is initialized automatically by base class
        await Page.GotoAsync("https://example.com/login");
    }
    
    [TearDown]
    public async Task Cleanup()
    {
        // Called after each test
        // Browser/Context auto-closed by base class
    }
    
    [Test]
    [Category("E2E")]
    public async Task LoginWithValidCredentials_WhenCorrectPasswordProvided_LogsInSuccessfully()
    {
        // Use Page fixture directly
        await Page.GetByLabel("Email").FillAsync("user@example.com");
        await Page.GetByLabel("Password").FillAsync("password123");
        await Page.GetByRole(AriaRole.Button, new() { Name = "Sign In" }).ClickAsync();
        
        await Expect(Page).ToHaveTitleAsync("Dashboard");
    }
}
```

## Locator & Assertion Patterns

### Strongly Typed Locators

```csharp
// ✅ Preferred: role-based (semantic, resilient)
var submitBtn = Page.GetByRole(AriaRole.Button, new() { Name = "Submit" });
await submitBtn.ClickAsync();

// ✅ Stable: data-testid
var saveBtn = Page.GetByTestId("save-button");
await saveBtn.ClickAsync();

// ✅ Accessible: labels & text
var emailInput = Page.GetByLabel("Email");
await emailInput.FillAsync("user@example.com");

// ❌ Fragile: CSS selectors (avoid)
var btn = Page.Locator(".btn-primary");
```

### Web-First Assertions

```csharp
// Visibility assertions
await Expect(Page.GetByRole(AriaRole.Heading, new() { Name = "Welcome" }))
    .ToBeVisibleAsync();

// Text assertions
await Expect(Page.GetByTestId("message"))
    .ToContainTextAsync("Success");

// URL assertions
await Expect(Page)
    .ToHaveTitleAsync(new Regex("Dashboard|Home"));

// State assertions
await Expect(Page.GetByRole(AriaRole.Checkbox, new() { Name = "Accept" }))
    .ToBeCheckedAsync();
```

## Page Object Pattern

Encapsulate page interactions in page object classes:

```csharp
// test/MyApp.Tests/Pages/LoginPage.cs
using Microsoft.Playwright;

namespace MyApp.Tests.Pages
{
    public class LoginPage
    {
        private readonly IPage _page;
        
        // Locators
        private ILocator EmailInput => _page.GetByLabel("Email");
        private ILocator PasswordInput => _page.GetByLabel("Password");
        private ILocator SignInButton => _page.GetByRole(AriaRole.Button, new() { Name = "Sign In" });
        private ILocator ErrorMessage => _page.GetByTestId("error-message");
        
        public LoginPage(IPage page)
        {
            _page = page;
        }
        
        public async Task GotoAsync()
        {
            await _page.GotoAsync("https://example.com/login");
        }
        
        public async Task LoginAsync(string email, string password)
        {
            await EmailInput.FillAsync(email);
            await PasswordInput.FillAsync(password);
            await SignInButton.ClickAsync();
        }
        
        public async Task<bool> IsErrorVisibleAsync()
        {
            return await ErrorMessage.IsVisibleAsync();
        }
    }
}
```

### Using Page Objects in Tests

```csharp
[Parallelizable(ParallelScope.Self)]
public class LoginPageTests : PageTest
{
    private LoginPage _loginPage;
    
    [SetUp]
    public async Task Setup()
    {
        _loginPage = new LoginPage(Page);
        await _loginPage.GotoAsync();
    }
    
    [Test]
    [Category("E2E")]
    public async Task LoginWithValidCredentials_WhenCorrectPasswordProvided_LogsInSuccessfully()
    {
        // Act
        await _loginPage.LoginAsync("user@example.com", "password123");
        
        // Assert
        await Expect(Page).ToHaveTitleAsync("Dashboard");
    }
    
    [Test]
    [Category("E2E")]
    public async Task LoginWithInvalidCredentials_WhenWrongPasswordProvided_ShowsErrorMessage()
    {
        // Act
        await _loginPage.LoginAsync("user@example.com", "wrongpassword");
        
        // Assert
        var isErrorVisible = await _loginPage.IsErrorVisibleAsync();
        isErrorVisible.Should().BeTrue();  // Using Shouldly for assertions
    }
}
```

## Async/Await Patterns

All Playwright actions return `Task`. Always use `await`:

```csharp
[Test]
public async Task NavigateAndVerify()
{
    // Goto returns Task
    await Page.GotoAsync("https://example.com");
    
    // Click returns Task
    await Page.GetByRole(AriaRole.Button, new() { Name = "Submit" }).ClickAsync();
    
    // Wait for navigation
    await Page.WaitForURLAsync(new Regex("/success"));
    
    // Assertion returns Task
    await Expect(Page).ToHaveTitleAsync("Success");
}
```

### Parallel Async Operations

```csharp
[Test]
public async Task ParallelWaitForNavigation()
{
    var navigationTask = Page.WaitForURLAsync("/dashboard");
    var clickTask = Page.GetByRole(AriaRole.Button, new() { Name = "Login" }).ClickAsync();
    
    // Both complete in parallel
    await Task.WhenAll(navigationTask, clickTask);
    
    await Expect(Page).ToHaveTitleAsync("Dashboard");
}
```

## Common Test Scenarios

### Form Filling

```csharp
[Test]
[Category("E2E")]
public async Task FillUserRegistrationForm_WithValidData_CreatesAccount()
{
    // Arrange
    var page = Page;
    
    // Act
    await page.GotoAsync("https://example.com/register");
    await page.GetByLabel("Full Name").FillAsync("John Doe");
    await page.GetByLabel("Email").FillAsync("john@example.com");
    await page.GetByLabel("Country").SelectOptionAsync("US");
    await page.GetByRole(AriaRole.Checkbox, new() { Name = "Accept Terms" }).CheckAsync();
    await page.GetByRole(AriaRole.Button, new() { Name = "Register" }).ClickAsync();
    
    // Assert
    await Expect(page).ToHaveTitleAsync("Registration Successful");
}
```

### File Upload

```csharp
[Test]
[Category("E2E")]
public async Task UploadFile_WithValidFile_UploadsSuccessfully()
{
    // Arrange
    var filePath = Path.Combine(Path.GetTempPath(), "test-file.txt");
    await File.WriteAllTextAsync(filePath, "test content");
    
    // Act
    await Page.GotoAsync("https://example.com/upload");
    await Page.GetByLabel("Upload file").SetInputFilesAsync(filePath);
    await Page.GetByRole(AriaRole.Button, new() { Name = "Upload" }).ClickAsync();
    
    // Assert
    await Expect(Page.GetByText("File uploaded successfully")).ToBeVisibleAsync();
    
    // Cleanup
    File.Delete(filePath);
}
```

### Authentication Reuse

```csharp
[Parallelizable(ParallelScope.Self)]
public class AuthenticatedUserTests : PageTest
{
    private static string _authFile = "auth.json";
    
    [OneTimeSetUp]
    public static async Task AuthenticateOnce()
    {
        // Run once for all tests in this class
        var pw = await Playwright.CreateAsync();
        var browser = await pw.Chromium.LaunchAsync();
        var authPage = await browser.NewPageAsync();
        
        // Perform login
        await authPage.GotoAsync("https://example.com/login");
        await authPage.GetByLabel("Email").FillAsync("user@example.com");
        await authPage.GetByLabel("Password").FillAsync("password");
        await authPage.GetByRole(AriaRole.Button, new() { Name = "Sign In" }).ClickAsync();
        await authPage.WaitForURLAsync("/dashboard");
        
        // Save session
        await authPage.Context.StorageStateAsync(new() { Path = _authFile });
        await browser.CloseAsync();
        await pw.DisposeAsync();
    }
    
    [SetUp]
    public async Task ReloadAuthenticationState()
    {
        // Before each test, load saved session
        var context = await Browser.NewContextAsync(new()
        {
            StorageStatePath = _authFile
        });
        
        // Create a new page in the authenticated context
        // (Note: PageTest base class initializes Page, so this is custom setup)
    }
    
    [Test]
    [Category("E2E")]
    public async Task AccessDashboard_WithAuthenticatedUser_ShowsUserContent()
    {
        // Session is already authenticated (no login needed)
        await Page.GotoAsync("https://example.com/dashboard");
        await Expect(Page.GetByText("Welcome, User")).ToBeVisibleAsync();
    }
}
```

## Running Tests

### Command Line

```bash
# Run all tests
dotnet test

# Run tests in specific category
dotnet test --filter "Category=E2E"

# Run specific test class
dotnet test --filter "ClassName=LoginPageTests"

# Run with verbose output
dotnet test -v detailed

# Parallel execution
dotnet test -p:ParallelizeTestCollections=true
```

### Headed Mode (Debugging)

```bash
# Set environment variable
$env:HEADED = "true"
dotnet test

# Or inline
HEADED=true dotnet test  # Linux/macOS
```

## Best Practices

1. **Always use `async Task`** — All Playwright actions are async
2. **Use page objects** — Encapsulate page interactions; follow single responsibility
3. **Prefer role-based selectors** — `GetByRole()` is resilient across UI changes
4. **Wait for state, not time** — Use `Expect().ToBeVisibleAsync()`, not `Task.Delay()`
5. **Follow AAA pattern** — Arrange, Act, Assert structure
6. **Use `[Parallelizable(ParallelScope.Self)]`** — Safe parallel test execution
7. **Store secrets in environment variables** — Never hardcode credentials
8. **Use fixtures for login** — Reuse authentication state across tests
9. **Follow csharp-nunit naming conventions** — `MethodName_Scenario_ExpectedResult`
10. **Use Playwright CLI for codegen** — Generate selectors with CLI tools

## Gotchas

- Do not use blocking `.Wait()` or `.Result` — always use `await`
- Do not hardcode credentials — use environment variables or auth files
- Do not mix blocking and async code — causes deadlocks
- Page fixture is recreated for each test (automatic isolation)
- Always await Playwright actions — missing `await` causes race conditions
- Do not rely on test execution order — tests should be independent
- Material overlays render outside the app root — use `hidden: false` in queries
