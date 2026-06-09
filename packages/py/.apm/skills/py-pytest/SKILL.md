---
name: py-pytest
description: >
  Write pytest tests and improve coverage. Covers test structure with marks
  and naming, mocking patterns, and coverage gap analysis. Load reference
  templates for detailed examples.
allowed-tools: read write edit editFiles search codebase execute shell runCommands
compatibility: opencode, github-copilot
---

Write pytest tests following project conventions.

## Workflow A — Write tests

1. Read target code — understand public interface, dependencies, existing test patterns
2. Identify test cases — happy path, boundary values, error handling, missing/null inputs
3. Choose test type — unit (no I/O) → `tests/unit/`, integration (DB/HTTP) → `tests/integration/`
4. Write tests — one scenario per function, one mark per function, mirror source structure
5. Verify — `uv run --frozen pytest tests/unit/`

### Reference files
- Load `references/marks-and-naming.md` for directory structure, mark annotations, naming patterns
- Load `references/mocking-python.md` for mocking examples (pytest-mock / unittest.mock / specialised)

## Workflow B — Improve coverage

1. Generate coverage report — `uv run --frozen pytest --cov=<source-dir> --cov-report=term-missing`
2. Analyze gaps — review `term-missing` output, prioritise uncovered branches > error handlers > happy paths
3. Write missing tests — focused pytest test for each uncovered line or branch
4. Verify — re-run with `--cov-fail-under=<target>`

### Reference files
- Load `references/coverage.md` for detailed coverage commands, CI flags, and gotchas

## Constraints

- Never mock internal implementation details — test public interface only
- Never write tests that pass trivially without exercising logic
- Never add new testing library without asking first
- `tests/manual/` must never run in CI: `addopts = "-m 'not manual'"`
- `# pragma: no cover` only for platform-specific branches with comment

## Gotchas

- `mocker.create_autospec(Cls)` enforces real interface — prefer over bare `MagicMock()`
- `mocker.patch` patches usage site, not definition site
- `AsyncMock` needed for async functions — `MagicMock` won't `await` correctly
- Manual tests need `@pytest.mark.manual` regardless of directory
- `uv` must be installed and configured for project (`uv sync` before running tests)
- `pytest-cov` must be a dev dependency (`uv add --dev pytest-cov` if missing)
- Choose `--cov-fail-under` based on project's target — default to 80 if unspecified
- Use `--frozen` to skip lockfile check; use `--no-sync` to skip venv sync when already up-to-date
- CI: prefer `--locked` over `--frozen` — asserts lockfile unchanged and fails fast if drifted
