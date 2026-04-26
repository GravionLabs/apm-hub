---
name: pytest-coverage
description: 'Run pytest with coverage, identify uncovered lines, and write additional tests to achieve full (or target) coverage.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: gpt-4.1
---

Improve pytest test coverage for Python code.

## Stack
- **uv run pytest** — run tests inside the uv-managed environment
- **pytest-cov** — coverage plugin (`pip install pytest-cov` or add to `dev` dependencies)
- **coverage** — coverage reporting CLI (`coverage report`, `coverage html`)

## What this skill does
Runs the test suite with coverage, identifies uncovered lines, and writes focused tests to close coverage gaps.

## Steps

### 1. Generate coverage report
```bash
pytest --cov=<source-dir> --cov-report=term-missing --cov-report=html
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
```bash
pytest --cov=<source-dir> --cov-report=term-missing --cov-fail-under=<target>
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

## Tips
> **Use the `task` tool** for coverage runs — they are mechanical.
> Example: `#task uv run pytest --cov=src --cov-report=term-missing --cov-fail-under=80`

> 💡 **Model hint:** This is a mechanical task — a fast model like `gpt-4.1` is sufficient. Use `/model` to switch.
