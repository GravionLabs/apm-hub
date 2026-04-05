---
name: create-python-project
description: 'Scaffold a new Python 3.14 project using uv with src layout, ruff, pytest, and asyncio support.'
allowed-tools: editFiles codebase runCommands
model: gpt-4.1
---

Scaffold a new Python project with a production-ready baseline using `uv`.

## Stack
- **uv** — package manager and environment tool (`uv init`, `uv add`, `uv sync`, `uv run`)
- **ruff** — linter + formatter (replaces flake8/black/isort)
- **pytest + pytest-asyncio** — testing with async support
- **Python 3.14** — current target version

## Steps
1. **Ask first:**
   - Project name
   - Project type: **library** (publishable package), **app** (application), or **workspace** (uv monorepo with `libs/` + `apps/`)?

2. **Run the scaffold script** (recommended):
   ```powershell
   pwsh scripts/New-PythonProject.ps1 -ProjectName <Name> -ProjectType <library|app|workspace>
   ```
   The script runs `uv init`, applies template `pyproject.toml` (ruff + pytest config), creates `src/<package>/__init__.py` and `tests/conftest.py`, then runs `uv sync`.

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

5. **Next steps:** add dependencies with `uv add <package>`, add CI with `create-python-workflow`

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

## Tips
> **Use the `task` tool** for scaffolding — it's mechanical.
> Example: `#task pwsh scripts/New-PythonProject.ps1 -ProjectName "my-lib" -ProjectType library`

> 💡 **Model hint:** This is a mechanical task — a fast model like `gpt-4.1` is sufficient. Use `/model` to switch.
