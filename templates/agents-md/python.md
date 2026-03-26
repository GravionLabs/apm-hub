# AGENTS.md

<!-- Replace with a one-paragraph description of what this Python repository does. -->

---

## Repo Map

```
src/
  <package_name>/   — Main Python package
test/               — Tests (mirrors src/ structure, pytest)
docs/               — Documentation
scripts/            — Developer tooling and automation
pyproject.toml      — Project metadata, dependencies, tool configuration
```

---

## Technology Stack

- **Runtime:** Python `<version>` (see `pyproject.toml` → `requires-python`)
- **Package Manager:** `uv` (preferred) or `pip`
- **Test Framework:** pytest
- **Linter / Formatter:** <!-- e.g. Ruff, Black, isort -->

---

## Key Conventions

- Module names: `snake_case`
- File names: `snake_case.py`
- All async functions end with `_async` or use `async def` consistently
- Type hints required on all public functions
- Docstrings: Google style
- Do not commit `.venv/`, `__pycache__/`, `*.pyc`, `.pytest_cache/`

---

## Build & Test Commands

```bash
# With uv:
uv sync                  # install dependencies
uv run pytest            # run tests
uv run pytest --cov      # with coverage

# With pip:
pip install -e ".[dev]"  # install with dev extras
pytest                   # run tests
```

---

## Architecture Notes

<!-- Describe key modules, patterns (e.g. dependency injection, repository pattern). -->

---

## Safe Change Checklist

- Run `pytest` — all tests must pass
- Run linter if configured (`ruff check .` / `black --check .`)
- Check `pyproject.toml` for version constraints before adding dependencies
- Type-check with `mypy` if configured
- Do not commit secrets or API keys
