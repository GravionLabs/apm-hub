# Test Cases

## Steps

1. Read target code: understand structure, dependencies, existing test patterns
2. Identify test cases: happy path, boundary values, error handling, null/empty inputs
3. Write tests using Vitest with `describe`/`it` blocks
4. Use mocking frameworks already in project (`vi.fn()`, `vi.mock()`)
5. Follow project naming conventions

## Conventions

- Mirror source file structure in test files
- One test class per source class
- Keep tests independent and deterministic
- No test logic in helpers — assert directly in test methods
- Prefer specific assertions over generic ones

## Constraints

- No new test frameworks or libraries not already in project
- Cover at minimum: happy path, one error path, one boundary/edge case per method
- Tests must compile and pass against existing code
