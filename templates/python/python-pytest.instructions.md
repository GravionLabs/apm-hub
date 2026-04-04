---
description: 'Guidelines for Python testing with pytest'
applyTo: '**/tests/**/*.py, **/test_*.py'
---

# Python Testing with pytest

These instructions apply to all Python test files, typically located in `tests/` directories.

## Testing Stack
- **Framework:** pytest
- **Mocking:** `unittest.mock` or `pytest-mock`
- **Async Testing:** `pytest-asyncio`
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

## Implementation Guidelines
- **No AAA Comments:** Do not use "Arrange", "Act", or "Assert" comments (as per general Python instructions).
- **Assertions:** Use standard `assert` statements (pytest provides rich failure introspection).
- **Fixtures:** Prefer fixtures over `setup`/`teardown` methods. Use scopes (`function`, `module`, `session`) appropriately.
- **Async Tests:**
    - Prefer using `pytest-asyncio` in **auto mode** (`asyncio_mode = auto` in `pytest.ini`).
    - If not in auto mode, mark async tests with `@pytest.mark.asyncio`.
    - Asynchronous fixtures should be defined using `async def`.
- **Markers:** 
    - Use `@pytest.mark.unit`, `@pytest.mark.integration`, etc., to categorize tests.
    - **Unit Tests:** Mark with `@pytest.mark.unit`.
    - **Integration Tests:** Mark with `@pytest.mark.integration`.
    - **Manual Tests:** All tests in the `manual/` directory **must** be marked with `@pytest.mark.manual`. These tests must be skipped by default using `@pytest.mark.skipif` or handled via custom command-line arguments to ensure they only run explicitly.

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

@pytest.mark.asyncio
async def test_fetch_should_return_data(async_data):
    # Note: @pytest.mark.asyncio is only needed if asyncio_mode != auto
    assert async_data is not None
```
