---
name: go-code-review
description: 'Perform a structured Go code review with priority ratings: 🔴 critical bugs/security, 🟡 important improvements, 🟢 suggestions for idiomatic style.'
allowed-tools: codebase
model: claude-sonnet-4.6
---

Review Go code for correctness, idiomatic patterns, and maintainability.

## What this skill does
Provides a structured, prioritized code review. Does not modify code — outputs findings only.

## Priority ratings
- 🔴 **Critical** — bugs, security vulnerabilities, goroutine leaks, data races
- 🟡 **Important** — error handling gaps, non-idiomatic patterns, performance issues
- 🟢 **Suggestion** — naming, style, minor refactors

## Review checklist

### Error handling
- All errors must be checked — never `_` for error returns unless explicitly justified
- Wrap errors with context: `fmt.Errorf("loading user: %w", err)`
- Sentinel errors via `errors.Is` / `errors.As`, not string comparison

### Concurrency
- Goroutines must have clear ownership and a way to be stopped
- Mutexes must protect all reads and writes to shared state
- Use `context.Context` for cancellation propagation

### Interfaces
- Define interfaces at the point of use (consumer), not the point of implementation
- Keep interfaces small — prefer single-method interfaces

### Naming and style
- Unexported names for internal types; exported for public API
- Error variables: `ErrSomething` pattern
- Receiver names: short and consistent (not `self` or `this`)

### Modules
- `go.sum` must be committed; `go.mod` must be tidy (`go mod tidy`)

## Output format
Group by file. For each finding: priority emoji, location, explanation, suggested fix.

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
