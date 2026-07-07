---
name: py-test
description: >
  Python test rules using pytest with pytest-asyncio. Covers test runner
  config, test-writing methodology, mocking, coverage, and gap analysis.
---

## Prerequisites

- Python 3.14+, uv installed
- Project root with `pyproject.toml`

## Workflow A — Test Runner

- **Framework**: pytest + pytest-asyncio
- **Config**: in `pyproject.toml` under `[tool.pytest.ini_options]`
- **Run all**: `uv run pytest`
- **Run single file**: `uv run pytest tests/test_file.py`

### File Naming

- Test files: `test_*.py` in `tests/` directory
- Fixtures in `tests/conftest.py`

### Coverage

```powershell
uv run pytest --cov=src --cov-report=xml --cov-report=term
```

- Output: `coverage.xml` (Cobertura format)
- CI publishes coverage summary

## Workflow B — Writing Tests

1. Read target code — understand public interface, dependencies, existing test patterns
2. Identify test cases — happy path, boundary values, error handling, missing/null inputs
3. Choose test type — unit (no I/O) → `tests/unit/`, integration (DB/HTTP) → `tests/integration/`
4. Write tests — one scenario per function, one mark per function (`@pytest.mark.unit`, `.integration`, or `.manual`), mirror source structure
5. Verify — `uv run --frozen pytest tests/unit/`

### Reference files
- Load `references/marks-and-naming.md` for directory structure, mark annotations, naming patterns
- Load `references/mocking-python.md` for mocking examples

## Workflow C — Improving Coverage

1. Generate coverage report — `uv run --frozen pytest --cov=<source-dir> --cov-report=term-missing`
2. Analyze gaps — review `term-missing` output, prioritise uncovered branches > error handlers > happy paths
3. Write missing tests — focused test for each uncovered line or branch using `pytest.raises` for errors, `@pytest.mark.parametrize` for multiple inputs
4. Verify — re-run with `--cov-fail-under=<target>`

### Reference files
- Load `references/coverage.md` for detailed coverage commands, CI flags, and gotchas

## Gotchas

- Async tests require `pytest-asyncio` and `@pytest.mark.asyncio`
- Fixtures in `conftest.py` are auto-discovered
- Tests go in `tests/`, co-located with `src/` layout
- `uv` must be installed (`uv sync` before running tests)
- `pytest-cov` must be a dev dependency (`uv add --dev pytest-cov` if missing)
- Use `--frozen` to skip lockfile check; `--no-sync` to skip venv sync
- CI: prefer `--locked` over `--frozen`
- Never mock internal implementation details — test public interface only
- Never write tests that pass trivially without exercising logic
- `# pragma: no cover` only for platform-specific branches with comment
