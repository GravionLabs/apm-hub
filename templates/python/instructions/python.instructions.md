---
description: 'Python coding standards: naming conventions, type hints, error handling, imports, and project structure for modern Python applications'
applyTo: '**/*.py'
---

# Python Coding Conventions

## Project Structure and Tooling

- Use **uv** as the default package manager and for environment management.
- Follow the **src layout**:
  - Application code resides in the `src/` directory.
  - Tests reside in the `tests/` directory.
- **uv Workspaces**: If using workspaces, tests reside in the `tests/` directory within each respective app or library (e.g., `packages/<name>/tests/` or `apps/<name>/tests/`).
- Use **pytest** as the primary testing framework.
- Test directory structure:
  - `unit/`: Pure unit tests.
  - `integration/`: Integration tests.
  - `manual/`: Manual tests (must be marked or handled to run only explicitly).

## Python Instructions

- Write clear and concise comments for each function.
- Ensure functions have descriptive names and include type hints.
- Provide docstrings following PEP 257 conventions.
- Use the `typing` module only where necessary. Prefer **built-in generics** for Python 3.9+ projects:
  - ✅ `list[str]`, `dict[str, int]`, `tuple[int, ...]`, `set[str]`
  - ❌ `typing.List[str]`, `typing.Dict[str, int]` (deprecated since 3.9)
  - Use `Optional[X]` → `X | None`, `Union[X, Y]` → `X | Y` (Python 3.10+)
- Break down complex functions into smaller, more manageable functions.

## General Instructions

- Always prioritize readability and clarity.
- For algorithm-related code, include explanations of the approach used.
- Write code with good maintainability practices, including comments on why certain design decisions were made.
- Handle edge cases and write clear exception handling.
- For libraries or external dependencies, mention their usage and purpose in comments.
- Use consistent naming conventions and follow language-specific best practices.
- Write concise, efficient, and idiomatic code that is also easily understandable.

## Modern Python Features

### Python 3.10 — Pattern Matching
Use `match` statements for complex branching instead of long `if/elif` chains:
```python
match command:
    case "quit":
        quit_game()
    case "go" if direction in valid_directions:
        go(direction)
    case {"action": action, "object": obj}:
        handle_action(action, obj)
    case _:
        print(f"Unknown command: {command}")
```

### Python 3.11 — Exception Groups
Use `ExceptionGroup` and `except*` for concurrent error handling:
```python
try:
    async with asyncio.TaskGroup() as tg:
        tg.create_task(task1())
        tg.create_task(task2())
except* ValueError as eg:
    for exc in eg.exceptions:
        print(f"ValueError: {exc}")
except* TypeError as eg:
    handle_type_errors(eg.exceptions)
```

### Python 3.12 — Type Parameter Syntax
Use the new generic syntax instead of `TypeVar`:
```python
# Old (TypeVar)
T = TypeVar("T")
def first(items: list[T]) -> T: ...

# New (Python 3.12+)
def first[T](items: list[T]) -> T: ...
type Vector = list[float]       # type alias
type Matrix[T] = list[list[T]]  # generic type alias
```

Use `@override` to mark intentional method overrides:
```python
from typing import override

class MyList(list[int]):
    @override
    def append(self, value: int) -> None:
        if value < 0:
            raise ValueError("Only non-negative values allowed")
        super().append(value)
```

### Python 3.13 — Improved Error Messages
- `locals()` now returns a copy (modifications no longer affect local scope)
- `copy.copy()` / `copy.deepcopy()` are faster for built-in types
- Use `PythonFinalizationError` for code running during interpreter shutdown

## Additional Python Conventions

- Follow the **PEP 8** style guide for Python.
- Maintain proper indentation (use 4 spaces for each level of indentation).
- Ensure lines do not exceed 79 characters.
- Place function and class docstrings immediately after the `def` or `class` keyword.
- Use blank lines to separate functions, classes, and code blocks where appropriate.

## Edge Cases and Testing

- Always include test cases for critical paths of the application.
- Account for common edge cases like empty inputs, invalid data types, and large datasets.
- Include comments for edge cases and the expected behavior in those cases.
- Refer to `.github/instructions/python-pytest.instructions.md` for detailed testing guidelines.

## Example of Proper Documentation

```python
def calculate_area(radius: float) -> float:
    """
    Calculate the area of a circle given the radius.
    
    Parameters:
    radius (float): The radius of the circle.
    
    Returns:
    float: The area of the circle, calculated as π * radius^2.
    """
    import math
    return math.pi * radius ** 2
```
