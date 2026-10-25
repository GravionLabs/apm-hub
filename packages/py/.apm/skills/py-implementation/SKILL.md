---
name: py-implementation
description: 'Python implementation and test rules (pytest) extending `implementation`. Loaded when `implementation` dispatches to py-implementation.'
---

## Framework

- **Format/Lint**: ruff — see `## Format`
- **Type checker**: mypy (optional, in `pyproject.toml`)
- **uv flags** (`--frozen` / `--locked` / `--no-sync`, dependency groups, CI env vars): read `references/uv-cli.md` (relative to this skill's directory)

## Format

- Extensions: `.py .pyi`
- Format: `uv run ruff format {files}` then `uv run ruff check --fix {files}`
- Check (read-only): `uv run ruff format --check {files}` and `uv run ruff check {files}`
- Not configured: no ruff in the project — skip, note it in the report
- Run each format command after green tests, before the commit: `pwsh <implementation dir>/scripts/Format-Changed.ps1 -Extensions .py,.pyi -Command 'uv run ruff format {files}'` (`-Check` for the check commands; see `implementation` `references/format.md`)

## Imports

- Standard library first, then third-party, then local
- Avoid `from module import *`
- Type imports: `from collections.abc import Sequence`

## Conventions

- Naming: `snake_case` for functions/variables, `PascalCase` for classes
- Types: always annotate public function signatures
- Async: `async def` + `await`, use `asyncio` or `anyio`
- File naming: `snake_case.py`

## Tests

Load `py-test` for runner config, marks, naming, mocking and coverage.

## Review rules

- Type annotations on public function parameters and return values
- No mutable default arguments; no bare `except:`
- Context managers (`with`) for files, connections, locks
- No `eval()`/`exec()` on untrusted input; parameterized SQL; no hardcoded secrets
- `pathlib.Path` over `os.path`; `dataclass`/`NamedTuple` for structured data
- Tests follow `py-test`
