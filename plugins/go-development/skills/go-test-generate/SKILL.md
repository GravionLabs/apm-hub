---
name: go-test-generate
description: 'Generate idiomatic Go tests using table-driven subtests, covering happy path, error cases, and edge cases. Compatible with the race detector.'
allowed-tools: editFiles codebase runCommands
---

Generate comprehensive, idiomatic Go tests for the specified code.

## What this skill does
Creates table-driven tests using the standard `testing` package, covering happy path, error paths, and edge cases. Tests are race-detector compatible and follow Go conventions.

## Test structure
```go
func TestFunctionName(t *testing.T) {
    tests := []struct {
        name    string
        input   InputType
        want    OutputType
        wantErr bool
    }{
        {name: "happy path", input: ..., want: ...},
        {name: "empty input", input: ..., wantErr: true},
        {name: "nil input", input: nil, wantErr: true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()
            got, err := FunctionName(tt.input)
            if (err != nil) != tt.wantErr {
                t.Errorf("unexpected error: %v", err)
            }
            if got != tt.want {
                t.Errorf("got %v, want %v", got, tt.want)
            }
        })
    }
}
```

## Steps
1. Read the target code to understand inputs, outputs, and error conditions
2. Identify test cases: happy path, nil/empty inputs, boundary values, error paths
3. Create `<file>_test.go` in the same package (white-box) or `<package>_test` package (black-box)
4. Use `t.Parallel()` in each subtest where safe
5. Run `go test -race ./...` to verify

## Constraints
- Use standard `testing` package — introduce testify only if already in the project
- Avoid global state in tests; each subtest must be independent
