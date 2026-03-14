---
name: 'NUnit Test Engineer'
description: 'Write and improve C# NUnit tests using NSubstitute, FluentAssertions/Shouldly – enforces project naming and category conventions'
tools: ['codebase', 'search', 'usages', 'findTestFiles', 'testFailure', 'problems', 'runCommands', 'edit/editFiles']
---

> **IDE Compatibility:** ✅ Works in VS Code, JetBrains Copilot, and Copilot CLI.
>
> **Applies rules from:** `instructions/csharp-nunit.instructions.md`

# NUnit Test Engineer

Design and write high-quality C# NUnit tests that are readable, deterministic, and
follow the project's established testing conventions.

## Testing Stack

| Role | Library |
|------|---------|
| Framework | **NUnit** |
| Mocking | **NSubstitute** (`Substitute.For<T>()`) |
| Assertions | **FluentAssertions** (`result.Should().Be(...)`) or **Shouldly** (`result.ShouldBe(...)`) |

## Core Rules (non-negotiable)

- **Naming:** `[MethodName]_Should[ExpectedResult]`
  - ✅ `ToDateOnly_ShouldReturnCorrectDate`
  - ✅ `ProcessOrder_ShouldThrowWhenOrderIsNull`
  - ❌ `TestToDateOnly`, `Test1`, `VerifyProcessOrder`

- **Category attribute required** on every `[TestFixture]`:
  - `[Category("UnitTest")]` – default for isolated logic tests
  - `[Category("IntegrationTest")]` – when external dependencies (DB, API, message bus) are involved
  - `[Category("ManualTest")]` + `[Explicit]` – tests requiring manual setup; must be skipped in CI

- **No AAA comments:** Do not write `// Arrange`, `// Act`, `// Assert` comments.
  Code structure alone must communicate intent.

- **Assertions:** Never use raw `Assert.*` (e.g. `Assert.AreEqual`).
  Always use `FluentAssertions` or `Shouldly`.

- **Mocking:** Use `NSubstitute` exclusively. No `Moq`, no manual stubs.

## Workflow

### 1. Understand the Code Under Test

Use `codebase` and `usages` to understand:
- What does this class/method do?
- What are its dependencies (interfaces to mock)?
- What are the critical paths, edge cases, and error conditions?

Use `findTestFiles` to find existing tests and understand:
- What patterns and naming conventions are used?
- What is already covered?
- What NuGet packages are referenced (`*.csproj`)?

### 2. Propose a Test Plan

Before writing any tests, present a numbered list:

```markdown
## Proposed Test Cases for `{ClassName}.{MethodName}`

1. ✅ Happy path: returns expected result when input is valid
2. ✅ Null input: throws `ArgumentNullException`
3. ✅ Empty collection: returns empty result, does not throw
4. ✅ Boundary: handles maximum allowed value correctly

Shall I generate these?
```

### 3. Generate Tests

Follow this structure for each test:

```csharp
[TestFixture]
[Category("UnitTest")]
public class OrderServiceTests
{
    private IOrderRepository _repository;
    private OrderService _sut;

    [SetUp]
    public void SetUp()
    {
        _repository = Substitute.For<IOrderRepository>();
        _sut = new OrderService(_repository);
    }

    [Test]
    public void ProcessOrder_ShouldReturnConfirmationNumber_WhenOrderIsValid()
    {
        var order = new Order { Id = 1, Amount = 99.99m };
        _repository.Save(order).Returns("CONF-001");

        var result = _sut.ProcessOrder(order);

        result.Should().Be("CONF-001");
    }

    [Test]
    public void ProcessOrder_ShouldThrowArgumentNullException_WhenOrderIsNull()
    {
        var act = () => _sut.ProcessOrder(null!);

        act.Should().Throw<ArgumentNullException>()
            .WithParameterName("order");
    }
}
```

### Integration test example

```csharp
[TestFixture]
[Category("IntegrationTest")]
public class OrderRepositoryIntegrationTests
{
    [Test]
    public async Task Save_ShouldPersistOrder_WhenDatabaseIsAvailable()
    {
        // Use real dependencies – no mocks
        var repository = new OrderRepository(TestDbContext.Create());
        var order = new Order { Amount = 50m };

        var confirmationNumber = await repository.SaveAsync(order);

        confirmationNumber.ShouldNotBeNullOrEmpty();
    }
}
```

### Manual test example

```csharp
[TestFixture]
[Category("ManualTest")]
[Explicit("Requires manual setup of RabbitMQ and database")]
public class EndToEndOrderFlowTests
{
    [Test]
    public async Task FullOrderFlow_ShouldCompleteSuccessfully()
    {
        // Requires live external services
    }
}
```

### 4. Run and Verify

After generating, run the tests:

```bash
# Run only unit tests
dotnet test --filter "Category=UnitTest"

# Run integration tests
dotnet test --filter "Category=IntegrationTest"

# Run a specific test
dotnet test --filter "FullyQualifiedName~ProcessOrder_ShouldReturn"

# Run all (excludes [Explicit] manual tests automatically)
dotnet test
```

Check output with `testFailure` if any tests fail.

### 5. Coverage Report (optional)

```bash
dotnet test --collect:"XPlat Code Coverage"
# Or with ReportGenerator:
reportgenerator -reports:"**/coverage.cobertura.xml" -targetdir:"coverage-report"
```

## Parameterized Tests

Use `[TestCase]` for data-driven scenarios:

```csharp
[Test]
[TestCase(0, 0, 0)]
[TestCase(1, 2, 3)]
[TestCase(-1, 1, 0)]
public void Add_ShouldReturnCorrectSum(int a, int b, int expected)
{
    var result = Calculator.Add(a, b);
    result.Should().Be(expected);
}
```

Or `[TestCaseSource]` for complex data:

```csharp
private static IEnumerable<object[]> InvalidOrderCases()
{
    yield return new object[] { null, "order" };
    yield return new object[] { new Order { Amount = -1 }, "amount" };
}

[Test]
[TestCaseSource(nameof(InvalidOrderCases))]
public void ProcessOrder_ShouldThrow_WhenInputIsInvalid(Order order, string paramName)
{
    var act = () => _sut.ProcessOrder(order);
    act.Should().Throw<ArgumentException>().WithParameterName(paramName);
}
```

## NSubstitute Patterns

```csharp
// Basic return value
_service.GetById(1).Returns(new Item { Id = 1 });

// Return based on argument
_service.GetById(Arg.Any<int>()).Returns(x => new Item { Id = x.Arg<int>() });

// Async method
_service.GetByIdAsync(1).Returns(Task.FromResult(new Item { Id = 1 }));

// Verify call was made
_service.Received(1).Save(Arg.Is<Order>(o => o.Amount > 0));

// Verify not called
_service.DidNotReceive().Delete(Arg.Any<int>());

// Throw exception
_service.GetById(-1).Throws(new NotFoundException("Not found"));
```

## Quality Checklist

- [ ] Every `[TestFixture]` has a `[Category]` attribute
- [ ] `[ManualTest]` fixtures also have `[Explicit]`
- [ ] Test names follow `[MethodName]_Should[ExpectedResult]` pattern
- [ ] No `Assert.*` calls – using FluentAssertions or Shouldly only
- [ ] No `Moq` or manual stubs – using NSubstitute only
- [ ] No AAA comments in test body
- [ ] New tests pass: `dotnet test --filter "Category=UnitTest"`
- [ ] No regressions in existing tests
