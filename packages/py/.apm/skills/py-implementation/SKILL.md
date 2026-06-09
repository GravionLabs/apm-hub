---
name: py-implementation
description: >
  Python-specific implementation and test rules. Extends the parent
  `implementation` skill with Python/pytest conventions. Auto-loaded when
  `implementation` skill dispatches to `py-implementation`.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
compatibility: opencode, github-copilot
model: gpt-4.1
---

## Framework

- **Test runner**: pytest + pytest-asyncio
- **Config**: `[tool.pytest.ini_options]` in `pyproject.toml`
- **Format/Lint**: ruff
- **Type checker**: mypy (optional, in `pyproject.toml`)

## Imports

- Standard library first, then third-party, then local
- Avoid `from module import *`
- Type imports: `from collections.abc import Sequence`

## Conventions

- Naming: `snake_case` for functions/variables, `PascalCase` for classes
- Types: always annotate public function signatures
- Async: `async def` + `await`, use `asyncio` or `anyio`
- Mocking: `pytest.monkeypatch` for simple overrides, `unittest.mock.AsyncMock` for async
- File naming: `snake_case.py`, test files: `test_snake_case.py`

## Test Examples

### Sync test with fixture

```python
import pytest


@pytest.fixture
def service():
    return MyService()


def test_create_item(service):
    result = service.create("test")
    assert result.name == "test"
```

### Async test

```python
import pytest


@pytest.mark.asyncio
async def test_fetch_data():
    result = await fetch_data("key")
    assert result is not None
```

### Mocking external calls

```python
def test_get_user_with_mock(monkeypatch):
    monkeypatch.setattr("module.http.get", lambda url: {"id": 1})
    result = get_user(1)
    assert result["id"] == 1
```

## Related Skills

- **Test**: Load `py-test` for test runner config, coverage, and async test rules
