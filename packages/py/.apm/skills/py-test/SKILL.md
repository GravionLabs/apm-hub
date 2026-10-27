---
name: py-test
description: >
  Python test rules using pytest with pytest-asyncio (runner config, marks, mocking,
  coverage). Use when writing or running tests in a Python project.
---

## Prerequisites

- Python 3.14+, uv installed (`uv sync` before running tests)
- Project root with `pyproject.toml`

## Test Runner

- **Framework**: pytest + pytest-asyncio (`asyncio_mode = "auto"`)
- **Config**: `[tool.pytest.ini_options]` in `pyproject.toml`
- **Run all**: `uv run pytest`
- **Run single file**: `uv run pytest tests/test_file.py`
- **Targeted run** (per commit): `uv run pytest <path>` (plain `pytest <path>` without uv) for the test files of the changed code; unknown mapping: `uv run pytest -m unit`
- **Coverage**: `uv run pytest --cov=src --cov-report=term-missing` (needs `pytest-cov` as a dev dependency)
- uv flags for CI vs. local runs: see `py-implementation/references/uv-cli.md`

### File Naming

- Test files: `test_*.py` under `tests/`, mirroring the `src/` layout
- Fixtures in `tests/conftest.py`

## Writing Tests

- Unit (no I/O) in `tests/unit/`, integration (DB/HTTP) in `tests/integration/`; name `test_<condition>_<expected>`
- Exactly one type mark per test function: `@pytest.mark.unit`, `.integration` or `.manual`

Reference files (load when needed):
- `references/marks-and-naming.md` — directory structure, marks, naming and parametrize patterns
- `references/mocking-python.md` — `pytest-mock`, `unittest.mock`, respx, freezegun examples

## Improving Coverage

1. Run the coverage command above and review the `term-missing` output
2. Prioritise uncovered branches > error handlers > happy paths
3. Write a focused test per uncovered line or branch (`pytest.raises` for errors, `@pytest.mark.parametrize` for multiple inputs)
4. Re-run with `--cov-fail-under=<target>`; details and HTML reports in `references/coverage.md`

## Gotchas

- `asyncio_mode = "auto"` is set by `py-create-project`, so `async def test_*` needs no marker; add `@pytest.mark.asyncio` only in projects without auto mode
- Mock with `pytest-mock` (`mocker.create_autospec`); `monkeypatch` only for env vars and attributes
- Never mock internal implementation details — test the public interface only
- Never write tests that pass trivially without exercising logic
- `# pragma: no cover` only for platform-specific branches, with a comment
