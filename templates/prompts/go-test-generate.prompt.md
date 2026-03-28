---
agent: agent
description: 'Generate table-driven Go tests with subtests, error cases, mocks, and race detector compatibility'
---

# Generate Go Tests

Generate comprehensive, idiomatic Go tests for the provided code using table-driven tests and the standard `testing` package.

## Code to Test

${input:code:Paste the Go function(s) or package to generate tests for}

## Test Generation Rules

### Structure
- Use **table-driven tests** with `[]struct{ name string; ... }` for all functions with multiple scenarios.
- Use **`t.Run(tc.name, func(t *testing.T) { ... })`** for each test case.
- Name test functions: `TestFuncName_Scenario` or `TestTypeName_MethodName`.
- Place tests in the same package (`package foo`) for white-box tests, or `package foo_test` for black-box tests.

### Test Cases to Include
For each function, generate test cases for:
1. ✅ Happy path: valid inputs, expected output
2. ✅ Error cases: invalid inputs, nil values, empty strings, zero values
3. ✅ Edge cases: boundary values, empty slices/maps, maximum values
4. ✅ Context cancellation (for functions accepting `context.Context`)

### Assertions
- Use standard `if got != want { t.Errorf(...) }` for simple values.
- Use `errors.Is(err, target)` for error type checks.
- If **`testify`** is already used in the project, use `assert.Equal`, `assert.NoError`, `require.NoError`.

### Mocking Interfaces
For functions with interface dependencies, create minimal mock structs:

```go
type mockUserRepo struct {
    findFn func(ctx context.Context, id string) (*User, error)
}

func (m *mockUserRepo) FindByID(ctx context.Context, id string) (*User, error) {
    if m.findFn != nil {
        return m.findFn(ctx, id)
    }
    return nil, nil
}
```

### Example Output Structure

```go
func TestCreateUser(t *testing.T) {
    repo := &mockUserRepo{}

    tests := []struct {
        name    string
        email   string
        setup   func()
        want    *User
        wantErr bool
    }{
        {
            name:  "valid email creates user",
            email: "alice@example.com",
            setup: func() {
                repo.saveFn = func(_ context.Context, u *User) error { return nil }
            },
            wantErr: false,
        },
        {
            name:    "invalid email returns error",
            email:   "not-an-email",
            wantErr: true,
        },
        {
            name:    "empty email returns error",
            email:   "",
            wantErr: true,
        },
    }

    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) {
            if tc.setup != nil {
                tc.setup()
            }
            got, err := CreateUser(context.Background(), repo, tc.email)
            if (err != nil) != tc.wantErr {
                t.Errorf("CreateUser() error = %v, wantErr %v", err, tc.wantErr)
                return
            }
            if !tc.wantErr && got == nil {
                t.Error("CreateUser() returned nil user without error")
            }
        })
    }
}
```

## After Generation

Run tests with the race detector to verify correctness:

```bash
# Run all tests
go test ./...

# Run with race detector
go test -race ./...

# Run with coverage
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out

# Run specific test
go test -run TestCreateUser ./internal/user/
```

## Coverage Goals

- Aim for **>80%** line coverage on business logic.
- 100% coverage of **error paths** — untested error paths are bugs waiting to happen.
- Every public function must have at least one test.
