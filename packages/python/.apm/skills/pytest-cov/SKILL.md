---
name: pytest-cov
description: >
  Run pytest with coverage, identify uncovered lines, and write additional tests
  to achieve full (or target) coverage. Use this skill when the user asks to
  improve test coverage, add missing tests, or fix coverage gaps in a Python
  project, even if the user only says "add tests" or "improve coverage" without
  mentioning pytest.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: claude-sonnet-4.6
---

Improve pytest test coverage for Python code.

## Stack
- **uv run pytest** — run tests inside the uv-managed environment
- **pytest-cov** — coverage plugin (`uv add --dev pytest-cov` to install)
- **coverage** — coverage reporting CLI (`coverage report`, `coverage html`)

## What this skill does
Runs the test suite with coverage, identifies uncovered lines, and writes focused tests to close coverage gaps.

## Steps

### 1. Generate coverage report
```powershell
uv run --frozen pytest --cov=<source-dir> --cov-report=term-missing
```
Optional — generate HTML report for browser review:
```powershell
uv run --frozen pytest --cov=<source-dir> --cov-report=term-missing --cov-report=html
```

### 2. Analyze gaps
- Review the `term-missing` output for files and line numbers not covered
- Prioritize: uncovered branches > uncovered error handlers > uncovered happy paths

### 3. Write missing tests
For each uncovered line/branch:
- Identify what condition or code path is not exercised
- Write a focused pytest test that exercises exactly that path
- Use `pytest.raises` for exception paths
- Use `@pytest.mark.parametrize` for multiple inputs

### 4. Verify
```powershell
uv run --frozen pytest --cov=<source-dir> --cov-report=term-missing --cov-fail-under=<target>
```

## Conventions
- Test file: `test_<module>.py` mirroring the source structure
- Test function: `test_<function>_<scenario>`
- Use fixtures for shared setup — avoid copy-paste between tests
- Keep each test focused on one scenario

## Constraints
- Do not mock internal implementation details — test the public interface
- Do not write tests that trivially pass without actually exercising the logic
- If coverage cannot reach 100% due to platform-specific code, use `# pragma: no cover` with a comment

## Gotchas
- `uv` must be installed and configured for the project (`uv sync` before running tests).
- `pytest-cov` must be a dev dependency (`uv add --dev pytest-cov` if missing).
- Choose `--cov-fail-under` based on the project's target — default to 80 if unspecified.
- `--cov-report=html` writes to `htmlcov/` and is optional; omit it if only gap analysis is needed.
- **Repeated runs:** Use `--frozen` to skip the lockfile check (faster); use `--no-sync` to also skip the venv sync entirely when the environment is already up-to-date.
- **CI:** Prefer `--locked` instead of `--frozen` — it asserts the lockfile is unchanged and fails fast if it drifted.

## Tips
> **Use the `task` tool** for coverage runs.
> Example: `#task uv run pytest --cov=src --cov-report=term-missing --cov-fail-under=80`

> 💡 **Model hint:** Writing targeted tests requires understanding code logic and edge cases — `claude-sonnet-4.6` is recommended. Use `/model` to switch.
