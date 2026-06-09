---
name: dotnet-test
description: >
  .NET / C# test rules using NUnit with NSubstitute and Shouldly. Covers
  test structure, mocking, assertions, coverage, and test-writing methodology.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
compatibility: opencode, github-copilot
---

## Prerequisites

- .NET SDK
- Test project with NUnit, NSubstitute, Shouldly NuGet packages

## Workflow A — Test Runner

- **Framework**: NUnit
- **Mocking**: NSubstitute
- **Assertions**: Shouldly
- **Run all**: `dotnet test`
- **Run single**: `dotnet test --filter "FullyQualifiedName~Namespace.Tests.ClassName"`

### Test Structure

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

### Conventions

- File naming: `{ClassName}Tests.cs` in `tests/` project
- Namespace matches the source project with `.Tests` suffix
- Test method naming: `MethodName_Scenario_ExpectedResult`
- Categories for slow/integration tests: `[Category("Integration")]`

### Mocking with NSubstitute

```csharp
var mock = Substitute.For<IDependency>();
mock.Method().Returns(expectedValue);
```

### Assertions with Shouldly

```csharp
result.ShouldBe(expectedValue);
result.ShouldNotBeNull();
collection.ShouldContain(item);
```

### Coverage

```powershell
dotnet test --collect:"XPlat Code Coverage"
```

- Output: `coverage.cobertura.xml` in `TestResults/`
- Use `reportgenerator` to convert formats

## Workflow B — Writing Tests

1. Read target code to understand dependencies and behaviour
2. Identify test cases: happy path, boundary values, null inputs, error paths
3. One test class per source class; one test method per scenario
4. Keep tests independent and deterministic — no shared mutable state

### Reference files
- Load `references/aaa-test-example.md` for a complete AAA test example

## Gotchas

- Tests in separate test project, mirroring `src/` structure
- Use `[SetUp]` for shared arrangement, `[TearDown]` for cleanup
- Avoid `async void` — use `async Task` for async tests
- Use `[Category("Unit")]` or `[Category("Integration")]` explicitly for consistent test filtering
- Put test project under `test/<ProjectName>.Tests`, not alongside source project
