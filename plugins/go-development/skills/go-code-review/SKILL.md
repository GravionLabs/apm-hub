---
name: go-code-review
description: 'Review Go code for idiomatic patterns, error handling, interface design, concurrency safety, and Go module conventions'
---

# Go Code Review

Review the provided Go code for correctness, idiomatic style, error handling, security, and maintainability.

## Review Focus

### 1. Error Handling
- **Ignored errors:** Flag uses of `_` to discard errors without a comment.
- **Missing context:** Flag errors returned without wrapping — should use `fmt.Errorf("context: %w", err)`.
- **`==` comparison:** Flag direct `err == ErrFoo` comparisons on wrapped errors — use `errors.Is`.
- **Panic in libraries:** Flag `panic()` calls in non-`main` packages.
- **Silent returns:** Flag `if err != nil { return }` without propagating the error.

### 2. Interface Design
- **Large interfaces:** Flag interfaces with more than 3-4 methods — suggest splitting.
- **Producer-defined interfaces:** Flag interfaces defined in the same package as the concrete type — should be defined at the consumer.
- **Return concrete types:** Flag functions returning interfaces when a concrete type would be more appropriate.

### 3. Concurrency
- **Context propagation:** Flag functions doing I/O or blocking work that don't accept `context.Context` as first param.
- **Goroutine leaks:** Flag goroutines without a clear exit condition (no channel close, no context cancellation).
- **Data races:** Flag shared mutable state accessed from multiple goroutines without synchronization.
- **WaitGroup misuse:** Flag `wg.Add` called inside the goroutine it tracks.
- **Channel misuse:** Flag channels used for state synchronization when a mutex is clearer.

### 4. Code Quality
- **Naming:** Package names must be short and lowercase (no `util`, `common`). Exported identifiers `PascalCase`, unexported `camelCase`.
- **godoc comments:** Flag exported types, functions, and methods missing godoc-style comments.
- **`init()` functions:** Flag `init()` in library code — they reduce testability.
- **Global mutable state:** Flag package-level `var` that is mutated — should be passed explicitly.
- **Import grouping:** stdlib first, then external packages, then internal — separated by blank lines.
- **Unused code:** Flag unused variables, imports, and exported functions with no callers.

### 5. Performance
- **Unnecessary allocations:** Flag string concatenation in loops (use `strings.Builder`).
- **Slice pre-allocation:** Flag `append` in loops where the slice length is known — use `make([]T, 0, n)`.
- **Copying large structs:** Flag passing large structs by value in hot paths — use pointers.

### 6. Security
- **SQL injection:** Flag string-interpolated query strings — must use parameterized queries.
- **Hardcoded secrets:** Flag credentials, tokens, or API keys in source code.
- **Input validation:** Flag HTTP handler bodies deserialized directly without validation.
- **`math/rand` for security:** Flag `math/rand` for security-sensitive randomness — use `crypto/rand`.

### 7. Testing
- **Race detector:** Recommend `go test -race` in CI.
- **Table-driven tests:** Suggest for functions with multiple input/output cases.
- **Test helpers:** Flag test setup code duplicated across test functions — extract to helper.

## Response Format

Return a prioritized, actionable checklist. For each issue:
1. **File & line:** Where is the issue?
2. **Description:** What is the issue?
3. **Rule:** Which Go/security rule is violated?
4. **Recommendation:** How to fix it (with Go code example if helpful).
5. **Severity:** 🔴 High / 🟡 Medium / 🟢 Low

Go code to review:
${input:code:Paste the Go code or diff to review}
