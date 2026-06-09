# Test Cases

## Steps

1. Read target code: understand structure, dependencies, existing test patterns
2. Identify test cases: happy path, boundary values, error handling, null/empty inputs
3. Write tests using Vitest with `describe`/`it` blocks
4. Use mocking frameworks already in project (`vi.fn()`, `vi.mock()`)
5. Follow BDD-style naming in `describe`/`it` blocks

## describe/it convention

```typescript
describe('getUser', () => {
  it('returns user when valid id', () => { ... });
  it('throws when null id', () => { ... });
});
```

### Nesting for categories
```typescript
describe('UserService', () => {
  describe('unit', () => {
    it('returns user when valid id', () => { ... });
  });
  describe('integration', () => {
    it('persists user to database', () => { ... });
  });
});
```

## Conventions

- Mirror source file structure in test files
- One `describe` block per service/module
- Keep tests independent and deterministic
- No test logic in helpers — assert directly in test methods
- Prefer specific assertions over generic ones

## Constraints

- No new test frameworks or libraries not already in project
- Cover at minimum: happy path, one error path, one boundary/edge case per method
- Tests must compile and pass against existing code
