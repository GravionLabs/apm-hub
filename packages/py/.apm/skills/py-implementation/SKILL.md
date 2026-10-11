---
name: py-implementation
description: 'Python implementation and test rules (pytest) extending `implementation`. Loaded when `implementation` dispatches to py-implementation.'
---

## Framework

- **Test runner**: pytest + pytest-asyncio (`asyncio_mode = "auto"`)
- **Config**: `[tool.pytest.ini_options]` in `pyproject.toml`
- **Format/Lint**: ruff
- **Type checker**: mypy (optional, in `pyproject.toml`)
- **uv flags** (`--frozen` / `--locked` / `--no-sync`, dependency groups, CI env vars): read `references/uv-cli.md` (relative to this skill's directory)

## Imports

- Standard library first, then third-party, then local
- Avoid `from module import *`
- Type imports: `from collections.abc import Sequence`

## Conventions

- Naming: `snake_case` for functions/variables, `PascalCase` for classes
- Types: always annotate public function signatures
- Async: `async def` + `await`, use `asyncio` or `anyio`
- Mocking: `pytest-mock` (`mocker.create_autospec`); `monkeypatch` only for env vars and attributes — see `py-test`
- File naming: `snake_case.py`, test files: `test_snake_case.py`

## Tests

Runner config, marks, naming, mocking and coverage live in `py-test` (pytest, `test_<condition>_<expected>`, `pytest-mock`).

## Review rules

- Type annotations on public function parameters and return values
- No mutable default arguments; no bare `except:`
- Context managers (`with`) for files, connections, locks
- No `eval()`/`exec()` on untrusted input; parameterized SQL; no hardcoded secrets
- `pathlib.Path` over `os.path`; `dataclass`/`NamedTuple` for structured data
- Tests use `pytest.raises` and `@pytest.mark.parametrize`
