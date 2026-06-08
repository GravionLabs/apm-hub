---
name: py-test
description: >
  Python test rules using pytest with pytest-asyncio. Covers test structure,
  async tests, fixtures, mocking, and coverage. Use this skill when writing
  or running tests in a Python project.
allowed-tools: execute shell runCommands read search codebase
compatibility: opencode, github-copilot
---

## Prerequisites

- Python 3.14+, uv installed
- Project root with `pyproject.toml`

## Test Runner

- **Framework**: pytest + pytest-asyncio
- **Config**: in `pyproject.toml` under `[tool.pytest.ini_options]`
- **Run all**: `uv run pytest`
- **Run single file**: `uv run pytest tests/test_file.py`

## File Naming

- Test files: `test_*.py` in `tests/` directory
- Fixtures in `tests/conftest.py`

## Async Tests

```python
import pytest

@pytest.mark.asyncio
async def test_my_function():
    result = await my_function()
    assert result == expected
```

## Coverage

```powershell
uv run pytest --cov=src --cov-report=xml --cov-report=term
```

- Output: `coverage.xml` (Cobertura format)
- CI publishes coverage summary

## Mocking

- Use `unittest.mock` or `pytest-monkeypatch`
- Prefer `monkeypatch` for simple overrides
- Use `AsyncMock` for async callables

## Gotchas

- Async tests require `pytest-asyncio` and `@pytest.mark.asyncio`
- Fixtures in `conftest.py` are auto-discovered
- Tests go in `tests/`, co-located with `src/` layout
