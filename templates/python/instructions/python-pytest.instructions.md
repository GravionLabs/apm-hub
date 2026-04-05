---
description: 'Guidelines for Python testing with pytest'
applyTo: '**/tests/**/*.py, **/test_*.py'
---

# Python Testing with pytest

These instructions apply to all Python test files, typically located in `tests/` directories.

## Testing Stack
- **Framework:** pytest 8.x
- **Mocking:** `unittest.mock` or `pytest-mock`
- **Async Testing:** `pytest-asyncio` 0.21+ (auto mode)
- **Coverage:** `pytest-cov`
- **Fixtures:** Use pytest fixtures for setup and teardown.

## Naming Conventions
- **Test Files:** Must follow the pattern `test_*.py`.
- **Test Functions:** Must follow the pattern `test_*()`.
- **Test Classes:** (If used) Must follow the pattern `Test*`.

## Test Directory Structure
Tests should be organized by type:
- `unit/`: Isolated logic tests with mocked dependencies.
- `integration/`: Tests involving multiple components or external systems.
- `manual/`: Tests requiring manual intervention or specific environments.

## pytest Configuration (pyproject.toml)

pytest 8 reads configuration natively from `[tool.pytest.ini_options]` in `pyproject.toml`. Prefer this over separate `pytest.ini` or `setup.cfg` files.

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"           # pytest-asyncio 0.21+: no need for @pytest.mark.asyncio
addopts = "--no-header --tb=short --strict-markers"
testpaths = ["tests"]
filterwarnings = [
    "error",                    # treat warnings as errors
    "ignore::DeprecationWarning:somelib",  # suppress known third-party warnings
]
markers = [
    "unit: isolated unit tests",
    "integration: multi-component or external-system tests",
    "manual: requires manual intervention; skipped by default",
]
```

### Coverage (`pytest-cov`)

Run coverage via `pytest --cov=src --cov-report=term-missing --cov-fail-under=80`. The `--cov-fail-under` flag fails the test run if coverage drops below the threshold.

```toml
[tool.coverage.run]
source = ["src"]
omit = ["tests/*", "*/__init__.py"]

[tool.coverage.report]
fail_under = 80
show_missing = true
```

## Implementation Guidelines
- **No AAA Comments:** Do not use "Arrange", "Act", or "Assert" comments (as per general Python instructions).
- **Assertions:** Use standard `assert` statements (pytest provides rich failure introspection).
- **Fixtures:** Prefer fixtures over `setup`/`teardown` methods. Use scopes (`function`, `module`, `session`) appropriately. Place shared fixtures in `conftest.py` at the appropriate directory level — a `conftest.py` in `tests/` is available to all tests; one in `tests/unit/` is scoped to unit tests only.
- **Async Tests:**
    - With `asyncio_mode = "auto"` set in `pyproject.toml`, all `async def test_*` functions are automatically treated as asyncio tests — no `@pytest.mark.asyncio` decorator needed.
    - Asynchronous fixtures should be defined using `async def`.
- **Markers:** 
    - Use `@pytest.mark.unit`, `@pytest.mark.integration`, etc., to categorize tests.
    - **Unit Tests:** Mark with `@pytest.mark.unit`.
    - **Integration Tests:** Mark with `@pytest.mark.integration`.
    - **Manual Tests:** All tests in the `manual/` directory **must** be marked with `@pytest.mark.manual`. These tests must be skipped by default using `@pytest.mark.skipif` or handled via custom command-line arguments to ensure they only run explicitly.
    - Register all custom markers in `[tool.pytest.ini_options]` to avoid `PytestUnknownMarkWarning` (enforced by `--strict-markers`).

## Example
```python
import pytest
from src.calculator import add, fetch_data_async

@pytest.fixture
def base_value():
    return 10

@pytest.fixture
async def async_data():
    return await fetch_data_async()

def test_add_should_return_sum(base_value):
    result = add(base_value, 5)
    assert result == 15

# asyncio_mode = "auto" means no @pytest.mark.asyncio needed
async def test_fetch_should_return_data(async_data):
    assert async_data is not None

@pytest.mark.parametrize("a,b,expected", [(1, 2, 3), (0, 0, 0), (-1, 1, 0)])
def test_add_parametrized(a, b, expected):
    assert add(a, b) == expected
```
