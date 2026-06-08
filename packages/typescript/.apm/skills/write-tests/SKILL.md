---
name: write-tests
description: 'Write unit tests for the specified code using the project''s test framework and conventions. Covers happy path, edge cases, and error scenarios.'
allowed-tools: read write edit editFiles search codebase
model: claude-sonnet-4.6
---

Write unit tests for specified code.

## Steps
1. Read target code: understand structure, dependencies, existing test patterns
2. Identify test cases: happy path, boundary values, error handling, null/empty inputs
3. Write tests using project's framework (NUnit, xUnit, pytest, vitest, Jest, etc.)
4. Use mocking frameworks already in project (NSubstitute, Moq, unittest.mock, vi.fn, etc.)
5. Follow naming convention: `MethodName_Scenario_ExpectedResult` (or project's existing convention)

## Conventions
- Mirror source file structure in test files
- One test class per source class
- Keep tests independent and deterministic
- No test logic in helpers — assert directly in test methods
- Prefer specific assertions over generic `Assert.True`

## Constraints
- No new test frameworks or libraries not already in project
- Cover at minimum: happy path, one error path, one boundary/edge case per method
- Tests must compile and pass against existing code
