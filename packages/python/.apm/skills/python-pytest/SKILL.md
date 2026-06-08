---
name: python-pytest
description: 'Write pytest tests: structure, marks, naming, mocking. Load when user asks to write/add/improve Python tests.'
allowed-tools: read write edit editFiles search codebase
compatibility: opencode, github-copilot
model: claude-sonnet-4.6
---

Write pytest tests following project conventions.

## Steps

1. Read target code — understand public interface, dependencies, existing test patterns
2. Identify test cases — happy path, boundary values, error handling, missing/null inputs
3. Choose test type — unit (no I/O) → `tests/unit/`, integration (DB/HTTP) → `tests/integration/`
4. Write tests — one scenario per function, one mark per function, mirror source structure
5. Verify — `uv run --frozen pytest tests/unit/`

## Reference files

- Load `references/marks-and-naming.md` for directory structure, mark annotations, naming patterns
- Load `references/mocking-python.md` for mocking examples (pytest-mock / unittest.mock / specialised)

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
