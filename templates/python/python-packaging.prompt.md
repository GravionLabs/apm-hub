---
name: Python Project Packaging Setup
description: Guided workflow to set up or migrate a Python project to modern packaging with pyproject.toml and uv
mode: ask
tools: ['codebase', 'editFiles', 'runCommands']
---

You are helping to set up or modernize Python project packaging. Work through the following questions to determine the right configuration.

## Step 1 — Assess Current State

Check what already exists:
- Is there a `pyproject.toml`? What `[build-system]` is configured?
- Is there a `setup.py` or `setup.cfg` to migrate from?
- Is there a `requirements.txt` / `requirements-dev.txt`?
- Which package manager is currently used (pip, poetry, pipenv)?

## Step 2 — Determine Target Configuration

Ask the user:
1. **Python version**: Minimum supported version? (Recommend ≥3.11)
2. **Project type**: Library (will be published to PyPI) or Application (deployed, not published)?
3. **Build backend**: Recommend `hatchling` for new projects. Others: `flit`, `setuptools`
4. **Package manager**: Recommend `uv` for all new projects

## Step 3 — Set Up pyproject.toml

Create or update `pyproject.toml` with:

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "<package-name>"
version = "0.1.0"
description = "<description>"
readme = "README.md"
requires-python = ">=3.11"
license = { text = "MIT" }
dependencies = []

[project.optional-dependencies]
dev = [
    "pytest>=8",
    "pytest-cov",
    "mypy>=1.10",
    "ruff>=0.4",
]
```

Add tool configuration sections:
```toml
[tool.mypy]
strict = true
python_version = "3.12"

[tool.ruff.lint]
select = ["E", "F", "I", "UP"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

## Step 4 — Initialize uv Environment

```bash
uv venv                          # create .venv
uv sync --all-extras             # install all dependencies
uv add <package>                 # add new dependency
uv add --dev <package>           # add dev dependency
```

Create `.python-version` for reproducibility:
```bash
uv python pin 3.12
```

## Step 5 — Migration (if applicable)

### From requirements.txt
```bash
uv add $(cat requirements.txt | grep -v '^#' | grep -v '^$' | tr '\n' ' ')
```

### From setup.py / setup.cfg
- Copy `install_requires` → `[project] dependencies`
- Copy `extras_require` → `[project.optional-dependencies]`
- Remove `setup.py` after verifying `pyproject.toml` is complete

### From Poetry
- `tool.poetry.dependencies` → `[project] dependencies`
- `tool.poetry.dev-dependencies` → `[project.optional-dependencies] dev`
- Replace `poetry.lock` with `uv.lock` via `uv sync`

## Step 6 — Verify

```bash
uv run python -c "import <package>; print(<package>.__version__)"
uv run pytest
uv build                         # test build artifacts
```

## Step 7 — CI Integration

For GitHub Actions with uv:
```yaml
- uses: astral-sh/setup-uv@v4
  with:
    version: "latest"
- run: uv sync --all-extras
- run: uv run pytest
```
