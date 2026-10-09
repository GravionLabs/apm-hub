---
name: py-create-project
description: 'Scaffold a new Python 3.14 project using uv with src layout, ruff, pytest, and asyncio support.'
---

Scaffold Python project with production-ready baseline using `uv`.

## Stack
- **uv** — package manager and environment tool (`uv init`, `uv add`, `uv sync`, `uv run`)
- **ruff** — linter + formatter (replaces flake8/black/isort)
- **pytest + pytest-asyncio** — testing with async support
- **Python 3.14** — current target version

## Steps
1. **Ask first:**
   - Project name
   - Project type: **library** (publishable package), **app** (application), or **workspace** (uv monorepo with `libs/` + `apps/`)?

2. **Run scaffold script** (recommended):
   ```powershell
   pwsh scripts/New-PythonProject.ps1 -ProjectName <Name> -ProjectType <library|app|workspace>
   ```
   Script runs `uv init`, applies template `pyproject.toml` (ruff + pytest config), creates `src/<package>/__init__.py` and `tests/conftest.py`, then runs `uv sync`.

3. **Alternatively — manual steps:**
   ```bash
   uv init <Name> && cd <Name>
   # Copy templates/pyproject.toml (replace generated one)
   # Copy templates/src/__init__.py → src/<package>/__init__.py
   # Copy templates/tests/conftest.py → tests/conftest.py
   uv add --dev pytest pytest-asyncio pytest-cov ruff
   uv sync
   ```

4. **Verify:**
   ```bash
   uv run ruff check .   # no lint errors
   uv run pytest         # tests pass
   ```

5. **Next steps:** add dependencies with `uv add <package>`, add CI (see `## CI Workflow` below)

## Template Files
| File | Purpose |
|---|---|
| `templates/pyproject.toml` | `uv_build` backend, `ruff` (line-length 120, Python 3.14), `pytest` (asyncio_mode auto) |
| `templates/src/__init__.py` | Minimal package init |
| `templates/tests/conftest.py` | Empty conftest with pytest-asyncio mode |
| `templates/.python-version` | Pins Python 3.14 for reproducible environments |
| `templates/.gitignore` | Python standard ignores (dist/, .venv/, __pycache__/) |

## Scripts
- **`scripts/New-PythonProject.ps1`** — Full scaffold automation.
  ```powershell
  pwsh scripts/New-PythonProject.ps1 -ProjectName "my-lib" -ProjectType library
  pwsh scripts/New-PythonProject.ps1 -ProjectName "my-engine" -ProjectType workspace
  ```
  Parameters: `-ProjectName` (required), `-ProjectType` (library/app/workspace), `-OutputDirectory`, `-Upgrade` (resolve latest compatible versions)

## Constraints
- Always use `src/` layout — prevents accidental imports from repo root
- Use `[dependency-groups] dev` (uv) for dev dependencies — not `optional-dependencies`
- Always use `asyncio_mode = "auto"` in pytest config
- Commit `uv.lock` to version control

## CI Workflow

Create GitHub Actions CI/CD workflow for Python package using GravionLabs/ci reusable workflows.

1. Ask: Python version, whether publish (PyPI / Test PyPI / none)
2. Create `.github/workflows/ci.yml`:
   ```yaml
   name: CI

   on:
     push:
       branches: [main]
     pull_request:

   jobs:
     build:
       uses: GravionLabs/ci/.github/workflows/python.yml@main
       with:
         python-version: '3.14'
       secrets: inherit
   ```
3. Confirm `pyproject.toml` has `test`, `build` scripts
4. If publishing: confirm `PYPI_TOKEN` secret configured

**Constraints:**
- Use `secrets: inherit`
- `pyproject.toml` must define test and build commands
