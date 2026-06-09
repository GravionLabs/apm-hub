---
name: dotnet-nunit
description: >
  Use this skill when creating, extending, or fixing NUnit tests for C# code
  with NSubstitute and Shouldly, following the project's naming and category
  conventions.
allowed-tools: read write edit editFiles search codebase
compatibility: opencode, github-copilot
---

Write NUnit tests for C# code using NSubstitute and Shouldly.

## Scope

Also covers general test-writing conventions for projects using any test framework. For framework-specific details, load the appropriate language skill.

## Conventions

### Project structure
- Test project: `<ProjectName>.Tests` in `test/` directory
- Mirrors source file structure: `src/MyApp/Services/UserService.cs` → `test/MyApp.Tests/Services/UserServiceTests.cs`

### Test naming
```
MethodName_Scenario_ExpectedResult
// e.g.: GetUser_WithValidId_ReturnsUser
//       GetUser_WithNullId_ThrowsArgumentNullException
```

### Test structure (AAA)
See [aaa-test-example.md](references/aaa-test-example.md) for example.

### Categories
- Use `[Category("Unit")]` for unit tests, `[Category("Integration")]` for integration tests

## Steps
1. Read target code to understand dependencies and behaviour
2. Identify test cases: happy path, boundary values, null inputs, error paths
3. One test class per source class; one test method per scenario
4. Keep tests independent and deterministic — no shared mutable state

## Gotchas
- Put test project under `test/<ProjectName>.Tests`, not alongside source project.
- Add `[Category("Unit")]` or `[Category("Integration")]` explicitly for consistent test filtering.
