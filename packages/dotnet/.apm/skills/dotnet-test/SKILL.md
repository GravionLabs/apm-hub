---
name: dotnet-test
description: >
  .NET / C# test rules using NUnit with NSubstitute and Shouldly. Covers
  test structure, mocking, assertions, coverage, and test-writing methodology.
---

## Prerequisites

- .NET SDK
- Test project with NUnit, NSubstitute, Shouldly NuGet packages

## Test Runner

- **Framework**: NUnit · **Mocking**: NSubstitute · **Assertions**: Shouldly
- **Run all**: `dotnet test`
- **Run single**: `dotnet test --filter "FullyQualifiedName~Namespace.Tests.ClassName"`
- **Coverage**: `dotnet test --collect:"XPlat Code Coverage"` writes `coverage.cobertura.xml` to `TestResults/`; convert with `reportgenerator`

## Conventions

- File naming: `{ClassName}Tests.cs` in the `test/<Project>.Tests` project, mirroring `src/`
- Namespace matches the source project with `.Tests` suffix
- Test method naming: `Should_<expected>_when_<condition>`
- Categories: `[Category("UnitTest")]` for unit, `[Category("IntegrationTest")]` for integration, `[Category("ManualTest")]` + `[Explicit]` for manual
- One test class per source class; one test method per scenario; AAA structure

## Test structure

```csharp
using NUnit.Framework;
using NSubstitute;
using Shouldly;

[TestFixture]
public class UserServiceTests
{
    [Test]
    [Category("UnitTest")]
    public async Task Should_return_user_when_valid_id()
    {
        var repo = Substitute.For<IUserRepository>();
        repo.GetByIdAsync("123", Arg.Any<CancellationToken>()).Returns(new User { Id = "123" });
        var sut = new UserService(repo);

        var result = await sut.GetUserAsync("123");

        result.ShouldNotBeNull();
        result.Id.ShouldBe("123");
    }
}
```

## Writing Tests

1. Read target code to understand dependencies and behaviour
2. Identify test cases: happy path, boundary values, null inputs, error paths
3. Keep tests independent and deterministic — no shared mutable state

## Gotchas

- Use `[SetUp]` for shared arrangement, `[TearDown]` for cleanup
- Avoid `async void` — use `async Task` for async tests
- Always set a `[Category(...)]` so test filtering stays consistent
- Put the test project under `test/<ProjectName>.Tests`, not alongside the source project
