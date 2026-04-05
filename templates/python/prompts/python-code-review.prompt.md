---
mode: agent
description: Perform a structured code review for Python and pytest codebases
tools: ['changes', 'codebase', 'problems', 'editFiles']
---
# Python Code Review

Review the provided Python code for correctness, readability, maintainability, and security. Follow the project's specific guidelines for Python development and pytest testing.

## Review Focus

### 1. General Python Guidelines
- **Tooling:** Ensure **uv** is used for package management and **src layout** is followed (code in `src/`, tests in `tests/`, notebooks in `notebooks/`).
- **Naming & Types:**
  - Descriptive names for functions and variables.
  - **Type Hints:** Mandatory for function parameters and return types (using `typing` module where necessary).
- **Documentation:**
  - Clear and concise comments for each function explaining the **why**.
  - Docstrings following **PEP 257** for all classes and functions.
- **Code Style:**
  - Adherence to **PEP 8**.
  - 4 spaces for indentation.
  - Max line length of 79 characters.
- **Idiomatic Python:** Use modern Python features and avoid complex functions by breaking them down.
- **Notebooks:**
  - All Jupyter notebooks (`.ipynb` files) must reside in the `notebooks/` directory.
  - Use descriptive names (e.g., `01_data_exploration.ipynb`).
  - Include a `README.md` in `notebooks/` describing each notebook's purpose.

### 2. Testing Guidelines (pytest)
- **Stack:** Verify usage of **pytest**, **unittest.mock** (or `pytest-mock`), and **pytest-asyncio** for async tests.
- **Structure:**
  - Test files: `test_*.py`.
  - Test functions: `test_*()`.
  - No "Arrange", "Act", or "Assert" comments.
- **Markers & Organization:**
  - Unit tests in `tests/unit/` and marked with `@pytest.mark.unit`.
  - Integration tests in `tests/integration/` and marked with `@pytest.mark.integration`.
  - Manual tests in `tests/manual/` **must** be marked with `@pytest.mark.manual` and skipped by default.
- **Fixtures:** Prefer pytest fixtures over `setup`/`teardown` methods.
- **Async Tests:** Check for proper `asyncio_mode = auto` usage or `@pytest.mark.asyncio` markers.

### 3. Logic and Security
- **Security:** No secrets in code, validate all external inputs.
- **Error Handling:** Clear exception handling, specific exception types, and handling of edge cases (empty inputs, invalid types).
- **Maintainability:** Ensure code is clear, concise, and well-documented.

## Response Format
Return a prioritized, actionable checklist. For each issue found:
1. **Description:** What is the issue?
2. **Guideline:** Which rule is violated?
3. **Recommendation:** How to fix it (with code examples).
4. **Severity:** High/Medium/Low.

Code to review:
${input:code:Paste the Python code or diff to review}
