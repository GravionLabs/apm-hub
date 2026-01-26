---
agent: 'agent'
tools: ['changes', 'search/codebase', 'edit/editFiles', 'problems', 'search']
description: 'Get best practices for NUnit unit testing, including data-driven tests'
---

# NUnit Best Practices

Your goal is to help me write effective unit tests with NUnit, covering both standard and data-driven testing approaches.

## Project Setup

- Use a separate test project with naming convention `[ProjectName].Test`
- Projects should be located under the `test/` directory
- Reference Microsoft.NET.Test.Sdk, NUnit, NSubstitute, FluentAssertions or Shouldly, and NUnit3TestAdapter packages
- Create test classes that match the classes being tested (e.g., `CalculatorTests` for `Calculator`)
- Use .NET SDK test commands: `dotnet test` for running tests

## Test Structure

- Apply `[TestFixture]` attribute to test classes
- Use `[Test]` attribute for test methods
- Follow the Arrange-Act-Assert (AAA) pattern but **do not** include "Arrange", "Act", or "Assert" comments
- Name tests using the pattern `[MethodName]_Should[ExpectedResult]` (e.g., `ToDateOnly_ShouldReturnCorrectDate`)
- Use `[SetUp]` and `[TearDown]` for per-test setup and teardown
- Use `[OneTimeSetUp]` and `[OneTimeTearDown]` for per-class setup and teardown
- Use `[SetUpFixture]` for assembly-level setup and teardown

## Test Categories and Organization

- Every `[TestFixture]` or test class **must** define a category using the `[Category]` attribute
- Available categories:
  - `"UnitTest"` (Default): For isolated logic tests
  - `"IntegrationTest"`: For tests involving external dependencies (DB, API, etc.)
  - `"ManualTest"`: For tests that require manual setup or intervention
- **Manual Tests:** Any test or fixture marked with `[Category("ManualTest")]` **must** also be marked with the `[Explicit]` attribute

## Standard Tests

- Keep tests focused on a single behavior
- Avoid testing multiple behaviors in one test method
- Use clear assertions that express intent
- Include only the assertions needed to verify the test case
- Make tests independent and idempotent (can run in any order)
- Avoid test interdependencies

## Data-Driven Tests

- Use `[TestCase]` for inline test data
- Use `[TestCaseSource]` for programmatically generated test data
- Use `[Values]` for simple parameter combinations
- Use `[ValueSource]` for property or method-based data sources
- Use `[Random]` for random numeric test values
- Use `[Range]` for sequential numeric test values
- Use `[Combinatorial]` or `[Pairwise]` for combining multiple parameters

## Assertions

- Use **FluentAssertions** or **Shouldly** for all assertions (preferred):
  - **FluentAssertions:** `result.Should().Be(expected)`
  - **Shouldly:** `result.ShouldBe(expected)`
- Use `Assert.That` with constraint model (NUnit style) only if FluentAssertions or Shouldly is not available
- Use constraints like `Is.EqualTo`, `Is.SameAs`, `Contains.Item`
- Use `Assert.Throws<T>` or `Assert.ThrowsAsync<T>` to test exceptions (or `action.Should().Throw<T>()` for FluentAssertions, `Should.Throw<T>(action)` for Shouldly)
- Use descriptive messages in assertions for clarity on failure

## Mocking and Isolation

- Use **NSubstitute** for creating mocks: `Substitute.For<IMyService>()`
- Mock dependencies to isolate units under test
- Use interfaces to facilitate mocking
- Consider using a DI container for complex test setups

## Test Organization

- Group tests by feature or component
- Use `[Order]` to control test execution order when necessary
- Use `[Author("DeveloperName")]` to indicate ownership
- Use `[Description]` to provide additional test information
- Use `[Ignore("Reason")]` to temporarily skip tests
