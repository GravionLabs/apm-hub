---
name: python-pytest
description: >
  Write pytest tests for Python code following project conventions: directory
  structure, mark annotations, naming patterns, and mocking. Use this skill
  when the user asks to write, add, or improve Python tests — even if they only
  say "add tests", "write a unit test", or "mock this dependency".
allowed-tools: read write edit editFiles search codebase
model: claude-sonnet-4.6
---

## Overview

Write pytest tests for Python code, following project conventions for directory structure,
mark annotations, naming patterns, and mocking. Prerequisites: pytest installed, project
configured with `pyproject.toml`. Read the target source file first to understand the
public interface before writing any tests.

## Directory structure

All tests live under `tests/` with three subdirectories:

```
tests/
├── conftest.py          # Shared fixtures for all test types
├── unit/
│   ├── conftest.py      # Unit-specific fixtures
│   └── test_<module>.py
├── integration/
│   ├── conftest.py      # Integration-specific fixtures (DB, HTTP clients)
│   └── test_<module>.py
└── manual/
    └── test_<module>.py # Manual tests — skipped by default
```

Mirror `src/` layout: `src/orders/parser.py` → `tests/unit/test_parser.py`.

## pytest marks

Every test function must carry exactly one type mark:

```python
import pytest

@pytest.mark.unit
def test_parse_order_returns_total():
    ...

@pytest.mark.integration
def test_order_service_saves_to_db():
    ...

@pytest.mark.manual
def test_payment_gateway_live():
    ...
```

Register marks and configure defaults in `pyproject.toml`:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
markers = [
    "unit: Fast tests with no external dependencies",
    "integration: Tests requiring external services, databases, or network",
    "manual: Must be run explicitly; never run in CI",
]
addopts = "--strict-markers -m 'not manual'"
```

This ensures manual tests are never accidentally run in CI.

## Test function naming

Use one of two styles — be consistent within a module:

**Standard style** — for simple, obvious tests:
```python
def test_parse_order_empty_input(): ...
def test_parse_order_valid_json(): ...
def test_parse_order_missing_field(): ...
```

**BDD style** — for conditional logic with explicit outcome:
```python
def test_parse_order_when_input_is_empty_then_raises_value_error(): ...
def test_parse_order_when_field_missing_then_returns_default(): ...
def test_calculate_total_when_discount_applied_then_reduces_price(): ...
```

**Parametrize** — use meaningful IDs, not index numbers:
```python
@pytest.mark.unit
@pytest.mark.parametrize("raw,expected", [
    ("{}",    ValueError),
    ('{"id": 1}', None),
], ids=["empty-object", "valid"])
def test_parse_order_validates_schema(raw, expected):
    ...
```

**Default:** Start with Standard style. Switch to BDD when the condition determines the
test name's meaning and the plain name would be ambiguous.

## Mocking (Python equivalents of NSubstitute)

### Recommended: `pytest-mock`

Install: `uv add --dev pytest-mock`

The `mocker` fixture provides automatic cleanup — no manual `patcher.stop()` needed.

```python
# Create a mock with spec (like Substitute.For<IFoo>())
def test_order_service_calls_repo(mocker):
    repo = mocker.create_autospec(OrderRepository)   # enforces interface
    repo.find_by_id.return_value = Order(id=1)       # .Returns(value)

    service = OrderService(repo)
    result = service.get(1)

    repo.find_by_id.assert_called_once_with(1)       # .Received().FindById(1)
    assert result.id == 1

# Side effect / exception (like .Throws<Ex>())
def test_order_service_raises_when_not_found(mocker):
    repo = mocker.create_autospec(OrderRepository)
    repo.find_by_id.side_effect = NotFoundError("not found")

    with pytest.raises(NotFoundError):
        OrderService(repo).get(99)

# Patch a module-level object
def test_uses_current_time(mocker):
    mocker.patch("myapp.orders.datetime", autospec=True).now.return_value = ...
```

### Stdlib fallback: `unittest.mock`

No install needed. Use when `pytest-mock` is not available.

```python
from unittest.mock import MagicMock, patch, AsyncMock, ANY

repo = MagicMock(spec=OrderRepository)
repo.find_by_id.return_value = Order(id=1)

# Patch via context manager
with patch("myapp.orders.send_email") as mock_email:
    ...
    mock_email.assert_called_once_with(recipient=ANY)
```

### Specialised libraries

| Need                   | Library                   | Install                  |
|------------------------|---------------------------|--------------------------|
| HTTP mocking (`httpx`) | `respx`                   | `uv add --dev respx`     |
| Time/date mocking      | `freezegun`               | `uv add --dev freezegun` |
| Async mocks (stdlib)   | `unittest.mock.AsyncMock` | built-in (Python 3.8+)   |

```python
import respx, httpx

@respx.mock
def test_fetch_order_calls_api():
    respx.get("https://api.example.com/orders/1").mock(return_value=httpx.Response(200, json={"id": 1}))
    result = fetch_order(1)
    assert result["id"] == 1

from freezegun import freeze_time

@freeze_time("2024-06-01")
def test_order_expires_after_30_days():
    ...
```

## Steps

1. **Read target code** — understand public interface, dependencies, and existing test patterns
2. **Identify test cases** — happy path, boundary values, error handling, missing/null inputs
3. **Choose test type** — unit (no I/O) → `tests/unit/`; integration (DB/HTTP) → `tests/integration/`
4. **Write tests** — one scenario per function, one mark per function, mirror source structure
5. **Verify** — tell the user to run `uv run --frozen pytest tests/unit/` (or `tests/integration/`) and confirm tests pass before committing.

## Constraints

- Never mock internal implementation details — test the public interface only
- Never write tests that pass trivially without exercising logic
- Never introduce a new testing library not already in the project without asking first
- `tests/manual/` tests must never be run by CI — enforce via `addopts = "-m 'not manual'"`
- Use `# pragma: no cover` only for platform-specific branches, with a comment explaining why

## Gotchas

- `mocker.create_autospec(Cls)` enforces the real interface — typos in method names fail immediately.
  Prefer this over bare `MagicMock()` to catch interface drift early.
- `mocker.patch` patches the name where it is *used*, not where it is *defined*:
  patch `myapp.orders.datetime`, not `datetime.datetime`.
- `AsyncMock` is needed for async functions — `MagicMock` will not `await` correctly.
- Manual tests in `tests/manual/` must still have `@pytest.mark.manual`; the directory alone
  does not prevent them from running.

> 💡 **Model hint:** Writing tests requires understanding code logic and edge cases — `claude-sonnet-4.6` is recommended. Use `/model` to switch.
