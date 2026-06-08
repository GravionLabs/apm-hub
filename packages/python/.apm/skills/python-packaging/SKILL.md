---
name: python-packaging
description: 'Set up or modernize Python project packaging using pyproject.toml, uv, and hatch — covers dependencies, build backends, and publishing.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: gpt-4.1
---

Set up or modernize Python project packaging configuration using `pyproject.toml` and modern tooling.

## Stack
- **uv** — package manager and environment tool (`uv init`, `uv add`, `uv sync`, `uv run`)
- **uv_build** / **hatchling** — build backends for PEP 517/518
- **twine** — alternative PyPI publisher (`twine upload dist/*`)

## Steps

### 1. Initialize (new projects)
```bash
uv init <project-name> && cd <project-name>
```

### 2. pyproject.toml structure
```toml
[build-system]
requires = ["uv_build>=0.9,<0.10"]
build-backend = "uv_build"

[project]
name = "my-package"
version = "0.1.0"
requires-python = ">=3.14"
dependencies = ["httpx>=0.27"]

[dependency-groups]
dev = ["pytest>=8", "pytest-cov", "ruff"]
```

### 3. Manage dependencies
```bash
uv add httpx                    # production dep
uv add --dev pytest ruff        # dev dep
uv sync                         # install from lockfile
uv lock --upgrade               # upgrade all
uv run pytest                   # run in managed env
```

### 4. Migrate from requirements.txt
```bash
uv init --no-readme
uv add $(grep -v '#' requirements.txt | tr '\n' ' ')
```

### 5. Build and publish
```bash
uv build             # dist/ with .whl and .tar.gz
uv publish           # PyPI (requires PYPI_TOKEN)
```

### 6. Tool configuration
```toml
[tool.ruff]
line-length = 120
target-version = "py314"
fix = true

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
addopts = "--strict-markers"
```

## Checklist
- [ ] `[build-system]` and `[project]` sections present
- [ ] `requires-python` set to minimum supported version
- [ ] Dev deps in `[dependency-groups] dev` (uv) or `[project.optional-dependencies] dev`
- [ ] `uv.lock` committed to version control
- [ ] `.python-version` file present for reproducible environments
- [ ] `src/` layout prevents accidental imports from repo root

## Tips
> **Use `task` tool** for setup commands — they are mechanical.
> Example: `#task uv init my-package && cd my-package && uv add --dev pytest ruff`
