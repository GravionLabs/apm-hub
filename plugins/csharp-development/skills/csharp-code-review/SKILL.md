---
name: csharp-code-review
description: 'Perform a structured code review for C# and NUnit codebases'
---

# C# Code Review

Review the provided C# code for correctness, readability, maintainability, and security. Follow the project's specific guidelines for C# development and NUnit testing.

## Review Focus

### 1. General C# Guidelines
- **Latest Features:** Ensure C# 14 features are used where appropriate (e.g., primary constructors, pattern matching, switch expressions).
- **Naming Conventions:**
  - `PascalCase` for components, methods, constants, and public members.
  - `_camelCase` for private fields.
  - `camelCase` for local variables.
  - Interface prefix `I`, Async method suffix `Async`.
- **Formatting:** Check for Allman style braces and max line length of 120 characters.
- **Nullable Reference Types:** Check for proper `null` handling using `is null` or `is not null`.
- **Clean Code:** Verify that `this.` is not used unnecessarily and `nameof` is preferred over string literals.

### 2. Testing Guidelines (NUnit)
- **Stack:** Verify usage of **NUnit**, **NSubstitute** (for mocks), and **FluentAssertions** or **Shouldly**.
- **Naming:** Test methods must follow `[MethodName]_Should[ExpectedResult]`.
- **Categories:**
  - Every `[TestFixture]` must have a `[Category]` attribute.
  - Valid categories: `"UnitTest"`, `"IntegrationTest"`, `"ManualTest"`.
  - `"ManualTest"` must also have the `[Explicit]` attribute.
- **Structure:** 
  - Do **not** use "Arrange", "Act", or "Assert" comments.
  - Use `result.Should().Be(expected)` (FluentAssertions) or `result.ShouldBe(expected)` (Shouldly) for assertions.
  - Use `Substitute.For<T>()` for mocks.

### 3. Logic and Security
- **Security:** No secrets in code, validate all external inputs.
- **Error Handling:** Use clear exception handling and specific exception types.
- **Maintainability:** Ensure code is clear, concise, and well-documented (XML comments for public APIs).

## Response Format
Return a prioritized, actionable checklist. For each issue found:
1. **Description:** What is the issue?
2. **Guideline:** Which rule is violated?
3. **Recommendation:** How to fix it (with code examples).
4. **Severity:** High/Medium/Low.

Code to review:
${input:code:Paste the C# code or diff to review}
