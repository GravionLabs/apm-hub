---
description: 'Guidelines for C# testing with NUnit, NSubstitute, FluentAssertions, or Shouldly'
---

# C# Testing with NUnit

These instructions apply to all C# test projects located in the `test/` directory.

## Testing Stack
- **Framework:** NUnit
- **Mocking:** NSubstitute
- **Assertions:** FluentAssertions or Shouldly

## Test Naming Convention
Test method names must follow the pattern: `[MethodName]_Should[ExpectedResult]`.
Example: `ToDateOnly_ShouldReturnCorrectDate`

## Test Categories and Organization
Every `[TestFixture]` or test class must define a category using the `[Category]` attribute.

### Available Categories:
1. **"UnitTest"** (Default): Use for isolated logic tests.
2. **"IntegrationTest"**: Use for tests involving external dependencies (DB, API, etc.).
3. **"ManualTest"**: Use for tests that require manual setup or intervention.

### Rules:
- **Default Category:** If not specified otherwise, use `[Category("UnitTest")]`.
- **Manual Tests:** Any test or fixture marked with `[Category("ManualTest")]` must also be marked with the `[Explicit]` attribute so it only runs when explicitly selected.

## Implementation Guidelines
- Use NSubstitute for creating mocks: `Substitute.For<IMyService>()`.
- Use FluentAssertions or Shouldly for all assertions:
  - **FluentAssertions:** `result.Should().Be(expected);`
  - **Shouldly:** `result.ShouldBe(expected);`
- Avoid "Act", "Arrange", or "Assert" comments (as per global C# instructions).
- Keep tests focused and ensure they are easy to read.
