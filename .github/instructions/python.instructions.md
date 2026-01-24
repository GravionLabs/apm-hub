---
description: 'Python coding conventions and guidelines'
applyTo: '**/*.py'
---

# Python Coding Conventions

## Project Structure and Tooling

- Use **uv** as the default package manager and for environment management.
- Follow the **src layout**:
  - Application code resides in the `src/` directory.
  - Tests reside in the `tests/` directory.
- Use **pytest** as the primary testing framework.
- Test directory structure:
  - `tests/unit/`: Pure unit tests.
  - `tests/integration/`: Integration tests.
  - `tests/manual/`: Manual tests (must be marked or handled to run only explicitly).

## Python Instructions

- Write clear and concise comments for each function.
- Ensure functions have descriptive names and include type hints.
- Provide docstrings following PEP 257 conventions.
- Use the `typing` module for type annotations (e.g., `List[str]`, `Dict[str, int]`).
- Break down complex functions into smaller, more manageable functions.

## General Instructions

- Always prioritize readability and clarity.
- For algorithm-related code, include explanations of the approach used.
- Write code with good maintainability practices, including comments on why certain design decisions were made.
- Handle edge cases and write clear exception handling.
- For libraries or external dependencies, mention their usage and purpose in comments.
- Use consistent naming conventions and follow language-specific best practices.
- Write concise, efficient, and idiomatic code that is also easily understandable.

## Code Style and Formatting

- Follow the **PEP 8** style guide for Python.
- Maintain proper indentation (use 4 spaces for each level of indentation).
- Ensure lines do not exceed 79 characters.
- Place function and class docstrings immediately after the `def` or `class` keyword.
- Use blank lines to separate functions, classes, and code blocks where appropriate.

## Edge Cases and Testing

- Always include test cases for critical paths of the application.
- Account for common edge cases like empty inputs, invalid data types, and large datasets.
- Include comments for edge cases and the expected behavior in those cases.
- **Naming Conventions for Tests**:
  - Test files must follow the pattern `test_*.py`.
  - Test functions must follow the pattern `test_*()`.
- Use `pytest` features like fixtures and markers where appropriate.
- Manual tests in `tests/manual/` should be skipped by default or require explicit execution.

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
