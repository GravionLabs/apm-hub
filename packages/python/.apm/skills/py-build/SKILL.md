---
name: py-build
description: >
  Python build and format rules using uv and ruff. Covers uv sync, ruff
  lint/format, and type checking with mypy. Use this skill during the
  build/verify phase of a Python project.
allowed-tools: execute shell runCommands read search codebase
compatibility: opencode, github-copilot
---

## Prerequisites

- Python 3.14+, uv installed
- Project root with `pyproject.toml`

## Sync Dependencies

```powershell
uv sync
```

- Installs dependencies from `pyproject.toml` / `uv.lock`
- Creates/updates virtual environment in `.venv/`

## Lint & Format

```powershell
uv run ruff check .
uv run ruff format --check .
```

## Type Check

```powershell
uv run mypy src/
```

## Build

```powershell
uv build
```

- Builds source distribution and wheel into `dist/`

## Gotchas

- `uv sync` respects locked versions from `uv.lock`
- CI uses `uv sync --frozen` to verify lockfile matches
- ruff replaces flake8, isort, and black in one tool
