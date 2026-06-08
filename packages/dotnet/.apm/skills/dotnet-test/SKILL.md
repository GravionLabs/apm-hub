---
name: dotnet-test
description: >
  .NET / C# test rules using NUnit with NSubstitute and Shouldly. Covers
  test structure, mocking, assertions, and coverage. Use this skill when
  writing or running tests in a .NET project.
allowed-tools: execute shell runCommands read search codebase
compatibility: opencode, github-copilot
---

## Prerequisites

- .NET SDK
- Test project with NUnit, NSubstitute, Shouldly NuGet packages

## Test Runner

- **Framework**: NUnit
- **Mocking**: NSubstitute
- **Assertions**: Shouldly
- **Run all**: `dotnet test`
- **Run single**: `dotnet test --filter "FullyQualifiedName~Namespace.Tests.ClassName"`

## Test Structure

```csharp
using NUnit.Framework;
using NSubstitute;
using Shouldly;

[TestFixture]
public class MyServiceTests
{
    [Test]
    public void MethodName_StateUnderTest_ExpectedBehavior()
    {
        // Arrange
        // Act
        // Assert
    }
}
```

## Conventions

- File naming: `{ClassName}Tests.cs` in `tests/` project
- Namespace matches the source project with `.Tests` suffix
- Test method naming: `MethodName_Scenario_ExpectedResult`
- Categories for slow/integration tests: `[Category("Integration")]`

## Mocking with NSubstitute

```csharp
var mock = Substitute.For<IDependency>();
mock.Method().Returns(expectedValue);
```

## Assertions with Shouldly

```csharp
result.ShouldBe(expectedValue);
result.ShouldNotBeNull();
collection.ShouldContain(item);
```

## Coverage

```powershell
dotnet test --collect:"XPlat Code Coverage"
```

- Output: `coverage.cobertura.xml` in `TestResults/`
- Use `reportgenerator` to convert formats

## Gotchas

- Tests in separate test project, mirroring `src/` structure
- Use `[SetUp]` for shared arrangement, `[TearDown]` for cleanup
- Avoid `async void` — use `async Task` for async tests
