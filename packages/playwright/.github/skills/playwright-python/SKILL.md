---
name: playwright-python
description: >
  Use this skill when creating, modifying, or debugging Playwright tests for Python projects.
  This includes pytest setup with Playwright fixtures, sync API patterns, async patterns when needed,
  and page object models. Tests are executed via `pytest` and Playwright CLI for recording,
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

This skill focuses on Python Playwright testing patterns using pytest. It ensures proper use of
pytest fixtures, sync API by default, async patterns for advanced scenarios, page objects,
and deterministic test flows. Tests are executed via `pytest` command and Playwright CLI for
recording, debugging, and trace analysis.

## When to Use This Skill

Trigger this skill when the user asks to:
- create Playwright tests in a Python project
- set up Playwright with pytest
- write sync test functions (`def test_*()`)
- write async tests (`async def test_*()`)
- use pytest fixtures for browser/page isolation
- test Python web apps or external sites
- debug test flakiness or timing issues
- create page objects for Playwright tests
- integrate Playwright into existing pytest suites

## Project Detection & Setup

Detect Python/pytest projects via:
- `requirements.txt` or `pyproject.toml` containing `playwright` and `pytest-playwright`
- `tests/` directory structure
- `conftest.py` file
- `pytest.ini` or `[tool.pytest]` in `pyproject.toml`

### 1. Install Dependencies

```bash
pip install pytest pytest-playwright playwright
```

### 2. Install Browsers

```bash
playwright install
```

### 3. Project Structure

```
src/
  my_app/
    services/
      user_service.py
    pages/
      login_page.py

tests/
  conftest.py
  test_login.py
  pages/
    login_page.py
```

## Test Conventions & Structure

### Test File Naming

Use `test_<feature>.py` naming convention:
- `test_login.py` — Login flow tests
- `test_user_profile.py` — User profile tests
- `test_checkout.py` — E2E checkout flow

### Test Function Naming

Use descriptive names for clarity:

```python
def test_login_with_valid_credentials():
    """User can log in with correct email and password."""
    pass

def test_login_with_invalid_password_shows_error():
    """Login form displays error message on wrong password."""
    pass

def test_logout_removes_session():
    """Logout clears user session and redirects to login."""
    pass
```

### Test Structure (AAA Pattern)

```python
def test_login_with_valid_credentials(page):
    """User can log in with correct email and password."""
    # Arrange
    page.goto("https://example.com/login")
    
    # Act
    page.get_by_label("Email").fill("user@example.com")
    page.get_by_label("Password").fill("password123")
    page.get_by_role("button", name="Sign In").click()
    
    # Assert
    expect(page).to_have_title("Dashboard")
    expect(page.get_by_text("Welcome, User")).to_be_visible()
```

## Pytest Fixtures

### Built-in Fixtures from pytest-playwright

```python
# conftest.py
import pytest
from playwright.sync_api import expect

# Fixtures are available automatically:
# - page: BrowserContext Page (fresh for each test)
# - context: BrowserContext (fresh for each test)
# - browser: Browser instance
# - browser_name: str (chromium, firefox, webkit)
# - is_mobile: bool

@pytest.fixture
def base_url():
    """Override base URL for all tests."""
    return "https://example.com"
```

### Custom Fixtures

```python
# conftest.py
import pytest
from playwright.sync_api import Page, expect

@pytest.fixture
def login_page(page: Page):
    """Fixture for logged-in user."""
    page.goto("https://example.com/login")
    page.get_by_label("Email").fill("user@example.com")
    page.get_by_label("Password").fill("password123")
    page.get_by_role("button", name="Sign In").click()
    page.wait_for_url("**/dashboard")
    yield page
    # Cleanup (page auto-closed by pytest-playwright)

def test_dashboard_with_logged_in_user(login_page: Page):
    """User sees dashboard after login."""
    expect(login_page.get_by_text("Welcome, User")).to_be_visible()
```

### Fixture Scope

```python
import pytest

@pytest.fixture(scope="session")
def browser_config():
    """Shared across all tests in session."""
    return {
        "headless": False,
        "slow_mo": 500,
    }

@pytest.fixture(scope="module")
def auth_token(page):
    """Shared across all tests in module."""
    page.goto("https://example.com/login")
    # ... perform login ...
    return page.context.storage_state()["cookies"]

@pytest.fixture  # Default: function scope
def fresh_page(page):
    """Fresh page for each test."""
    return page
```

## Locator & Assertion Patterns

### Sync API (Default)

```python
from playwright.sync_api import Page, expect

# ✅ Preferred: role-based (semantic, resilient)
button = page.get_by_role("button", name="Submit")
button.click()

# ✅ Stable: data-testid
save_btn = page.get_by_test_id("save-button")
save_btn.click()

# ✅ Accessible: labels & text
email_input = page.get_by_label("Email")
email_input.fill("user@example.com")

# ❌ Fragile: CSS selectors (avoid)
btn = page.locator(".btn-primary")
```

### Web-First Assertions (Sync)

```python
from playwright.sync_api import expect

# Visibility assertions
expect(page.get_by_role("heading", name="Welcome")).to_be_visible()

# Text assertions
expect(page.get_by_test_id("message")).to_contain_text("Success")

# URL assertions
expect(page).to_have_url("https://example.com/dashboard")

# State assertions
expect(page.get_by_role("checkbox", name="Accept")).to_be_checked()
```

### Async API (Advanced)

```python
import pytest
from playwright.async_api import Page, expect

@pytest.mark.asyncio
async def test_async_navigation(page: Page):
    """Example of async test."""
    await page.goto("https://example.com")
    await page.get_by_role("button", name="Next").click()
    await expect(page).to_have_title("Step 2")
```

## Page Object Pattern

Encapsulate page interactions in page object classes:

```python
# tests/pages/login_page.py
from playwright.sync_api import Page, expect

class LoginPage:
    """Page object for login page."""
    
    def __init__(self, page: Page):
        self.page = page
        # Define locators as properties
        self.email_input = page.get_by_label("Email")
        self.password_input = page.get_by_label("Password")
        self.sign_in_button = page.get_by_role("button", name="Sign In")
        self.error_message = page.get_by_test_id("error-message")
    
    def goto(self):
        """Navigate to login page."""
        self.page.goto("https://example.com/login")
    
    def login(self, email: str, password: str):
        """Fill and submit login form."""
        self.email_input.fill(email)
        self.password_input.fill(password)
        self.sign_in_button.click()
    
    def is_error_visible(self) -> bool:
        """Check if error message is visible."""
        return self.error_message.is_visible()
    
    def wait_for_dashboard(self):
        """Wait for successful login."""
        self.page.wait_for_url("**/dashboard")
```

### Using Page Objects in Tests

```python
# tests/test_login.py
import pytest
from tests.pages.login_page import LoginPage

def test_login_with_valid_credentials(page):
    """User can log in with correct email and password."""
    # Arrange
    login_page = LoginPage(page)
    login_page.goto()
    
    # Act
    login_page.login("user@example.com", "password123")
    
    # Assert
    login_page.wait_for_dashboard()
    assert page.title() == "Dashboard"

def test_login_with_invalid_password_shows_error(page):
    """Login form displays error on wrong password."""
    login_page = LoginPage(page)
    login_page.goto()
    
    login_page.login("user@example.com", "wrongpassword")
    
    assert login_page.is_error_visible()
```

## Common Test Scenarios

### Form Filling

```python
def test_fill_user_registration_form(page):
    """User can fill and submit registration form."""
    # Arrange
    page.goto("https://example.com/register")
    
    # Act
    page.get_by_label("Full Name").fill("John Doe")
    page.get_by_label("Email").fill("john@example.com")
    page.get_by_label("Country").select_option("US")
    page.get_by_role("checkbox", name="Accept Terms").check()
    page.get_by_role("button", name="Register").click()
    
    # Assert
    expect(page).to_have_url("**/registration-success")
```

### File Upload

```python
def test_upload_file(page):
    """User can upload a file."""
    import tempfile
    
    # Arrange
    with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
        f.write("test content")
        temp_file = f.name
    
    # Act
    page.goto("https://example.com/upload")
    page.get_by_label("Upload file").set_input_files(temp_file)
    page.get_by_role("button", name="Upload").click()
    
    # Assert
    expect(page.get_by_text("File uploaded successfully")).to_be_visible()
    
    # Cleanup
    import os
    os.unlink(temp_file)
```

### Authentication Reuse

```python
# conftest.py
import pytest
import json
import os
from playwright.sync_api import Page, sync_playwright

@pytest.fixture(scope="session")
def auth_storage():
    """Authenticate once per test session, save storage state."""
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        
        # Perform login
        page.goto("https://example.com/login")
        page.get_by_label("Email").fill("user@example.com")
        page.get_by_label("Password").fill("password")
        page.get_by_role("button", name="Sign In").click()
        page.wait_for_url("**/dashboard")
        
        # Save session
        storage = page.context.storage_state()
        browser.close()
    
    return storage

@pytest.fixture
def authenticated_page(page: Page, auth_storage):
    """Provide page with authenticated session."""
    page.context.add_cookies(auth_storage["cookies"])
    page.context.add_init_script(f"window.localStorage.setItem('user', '{json.dumps(auth_storage)}')")
    yield page
```

```python
# test_dashboard.py
def test_access_dashboard_with_authenticated_session(authenticated_page):
    """Authenticated user can access dashboard (no login needed)."""
    authenticated_page.goto("https://example.com/dashboard")
    expect(authenticated_page.get_by_text("Welcome, User")).to_be_visible()
```

## Pytest Configuration

### pytest.ini

```ini
[pytest]
minversion = 7.0
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = 
    -v
    --tb=short
    --strict-markers
markers =
    e2e: E2E tests
    smoke: Smoke tests
    slow: Slow tests (>1s)
```

### pyproject.toml

```toml
[tool.pytest.ini_options]
minversion = "7.0"
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = "-v --tb=short --strict-markers"

[tool.pytest.ini_options.markers]
e2e = "E2E tests"
smoke = "Smoke tests"
slow = "Slow tests (>1s)"

[tool.playwright]
browsers = ["chromium", "firefox", "webkit"]
headless = true
```

### conftest.py (Global Fixtures)

```python
# conftest.py
import pytest
from playwright.sync_api import expect

def pytest_configure(config):
    """Configure pytest."""
    config.addinivalue_line("markers", "e2e: E2E tests")
    config.addinivalue_line("markers", "smoke: Smoke tests")

@pytest.fixture
def base_url():
    """Base URL for all tests."""
    return "https://example.com"

@pytest.fixture
def slow_motion_ms():
    """Slow down actions for debugging."""
    return int(__import__("os").getenv("SLOW_MO", 0))
```

## Running Tests

### Command Line

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_login.py

# Run specific test
pytest tests/test_login.py::test_login_with_valid_credentials

# Run tests by marker
pytest -m e2e
pytest -m "not slow"

# Run with verbose output
pytest -v

# Run with headless=false (headed mode)
HEADED=true pytest

# Run with slow motion
SLOW_MO=500 pytest

# Parallel execution (requires pytest-xdist)
pip install pytest-xdist
pytest -n auto
```

### pytest-playwright Options

```bash
# Specific browser
pytest --browser chromium
pytest --browser firefox
pytest --browser webkit

# Multiple browsers
pytest --browser chromium --browser firefox

# Headed mode
pytest --headed

# Slow motion
pytest --slow-mo 500

# Video recording
pytest --video on
pytest --video on-failure  # Only on failures

# Trace recording
pytest --tracing retain-on-failure

# Screenshot
pytest --screenshot on
pytest --screenshot only-on-failure
```

## Best Practices

1. **Use sync API by default** — Simpler, more intuitive
2. **Use page objects** — Encapsulate page interactions
3. **Prefer role-based selectors** — `get_by_role()` is resilient
4. **Wait for state, not time** — Use `expect()`, not `time.sleep()`
5. **Follow AAA pattern** — Arrange, Act, Assert structure
6. **Use pytest fixtures** — Automatic setup/teardown
7. **Store secrets in env vars** — Never hardcode credentials
8. **Use markers for test categorization** — `@pytest.mark.e2e`
9. **Use pytest-playwright built-in fixtures** — page, context, browser
10. **Use Playwright CLI for codegen** — Generate selectors with CLI tools

## Gotchas

- Do not mix sync and async in same test — pick one
- Do not use `time.sleep()` for waits — use `expect()` assertions
- Do not hardcode credentials — use environment variables
- Do not assume test execution order — tests should be independent
- Page fixture is recreated for each test (automatic isolation)
- Remember snake_case for Python — `get_by_test_id()`, not `getByTestId()`
- Material overlays render outside app root — check visibility carefully

## Troubleshooting

### "Playwright browser binaries not found"
```bash
playwright install
```

### "Connection refused" when testing web app
```bash
# Ensure web app is running before tests
# Update base_url in conftest.py or set BASE_URL env var
BASE_URL=http://localhost:3000 pytest
```

### Tests timeout in CI
```python
# Increase timeout in pytest.ini or conftest.py
@pytest.fixture
def page(browser):
    context = browser.new_context()
    page = context.new_page()
    page.set_default_timeout(30000)  # 30 seconds
    yield page
    context.close()
```
