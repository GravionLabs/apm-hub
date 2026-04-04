---
name: python-code-review
description: 'Perform a structured Python code review with priority ratings: 🔴 critical bugs/security, 🟡 important improvements, 🟢 style suggestions.'
allowed-tools: codebase
---

Review Python code for correctness, readability, maintainability, and security.

## What this skill does
Provides a structured, prioritized code review. Does not modify code — outputs findings only.

## Priority ratings
- 🔴 **Critical** — bugs, security vulnerabilities, data corruption risk, broken tests
- 🟡 **Important** — performance issues, missing error handling, type annotation gaps
- 🟢 **Suggestion** — style, naming, minor refactors

## Review checklist

### Correctness
- No mutable default arguments: `def f(x=[])` → use `None` and initialize inside
- Context managers for resources: files, connections, locks (`with` statement)
- Exception handling: not bare `except:`, no silenced exceptions

### Type safety
- Functions should have type annotations on parameters and return values
- Use `Optional[T]` or `T | None` for nullable values
- Use `TypeVar` and generics appropriately

### Security
- No `eval()` or `exec()` on untrusted input
- No SQL string formatting — use parameterized queries
- No hardcoded secrets; use environment variables or secret managers

### Python idioms
- Use list/dict/set comprehensions over `for` + `.append()`
- Use `enumerate()` instead of manual index counters
- Use `dataclass` or `NamedTuple` for structured data
- `pathlib.Path` over `os.path` string manipulation

### pytest conventions
- Test functions: `test_<function>_<scenario>`
- Use `pytest.raises` for exception assertions
- Use `@pytest.mark.parametrize` for data-driven tests

## Output format
Group by file. Priority emoji, location, explanation, suggested fix.
