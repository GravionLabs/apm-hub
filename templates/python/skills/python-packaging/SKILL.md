---
name: python-packaging
description: 'Set up or modernize Python project packaging using pyproject.toml, uv, and hatch — covers dependencies, build backends, and publishing.'
allowed-tools: codebase editFiles runCommands
---

Set up or modernize a Python project's packaging configuration using `pyproject.toml` and modern tooling.

## Stack
- **uv** — fast package manager and environment tool (`uv init`, `uv add`, `uv sync`, `uv run`)
- **hatch** — build backend and project management (`hatch build`, `hatch publish`)
- **twine** — alternative PyPI publisher (`twine upload dist/*`)
- **pyproject.toml** — PEP 517/518 project metadata standard (replaces `setup.py`/`setup.cfg`)

## Steps

### 1. Initialize project structure (new projects)
```bash
uv init <project-name>
cd <project-name>
```

Generated structure:
```
<project-name>/
  src/<package>/
    __init__.py
  tests/
  pyproject.toml
  README.md
  .python-version
```

### 2. pyproject.toml structure
```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "my-package"
version = "0.1.0"
description = "Short description"
readme = "README.md"
requires-python = ">=3.11"
license = { text = "MIT" }
dependencies = [
    "httpx>=0.27",
]

[project.optional-dependencies]
dev = [
    "pytest>=8",
    "pytest-cov",
    "mypy",
    "ruff",
]

[tool.hatch.build.targets.wheel]
packages = ["src/my_package"]
```

### 3. Manage dependencies with uv
```bash
uv add httpx                     # add production dependency
uv add --dev pytest pytest-cov   # add dev dependency
uv remove <package>              # remove package
uv sync                          # install all deps from lockfile
uv lock --upgrade                # upgrade lockfile
uv run pytest                    # run in managed env
```

### 4. Migrate from requirements.txt
```bash
# Convert to uv project
uv init --no-readme
uv add $(cat requirements.txt | grep -v '#' | tr '\n' ' ')
```

### 5. Build and publish
```bash
uv build                         # creates dist/ with .whl and .tar.gz
uv publish                       # publish to PyPI (requires PYPI_TOKEN)
# or
twine upload dist/*
```

### 6. Configure tools in pyproject.toml
```toml
[tool.mypy]
strict = true
python_version = "3.12"

[tool.ruff]
line-length = 88
target-version = "py312"

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "--strict-markers"
```

## Checklist
- [ ] `pyproject.toml` has `[build-system]` and `[project]` sections
- [ ] `requires-python` pinned to minimum supported version
- [ ] Dev dependencies in `[project.optional-dependencies] dev` or `[dependency-groups] dev`
- [ ] `uv.lock` committed to version control
- [ ] `.python-version` file present for reproducible environments
- [ ] `src/` layout used to prevent accidental imports from repo root
