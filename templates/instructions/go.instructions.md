---
description: 'Go coding standards: idiomatic Go, error handling, package design, interfaces, concurrency patterns, and module conventions'
applyTo: '**/*.go,**/go.mod,**/go.sum'
---

# Go Coding Conventions

## Project Structure & Modules

- Use **Go modules** (`go.mod`). One module per repository is the standard for most projects.
- Follow the [Standard Go Project Layout](https://github.com/golang-standards/project-layout) conventions:

```
cmd/
  <app>/
    main.go           # entry point; thin — just wires and calls internal packages
internal/
  <feature>/          # private packages not importable by external modules
pkg/
  <feature>/          # public packages importable by external modules
api/                  # OpenAPI specs, protobuf files
configs/              # configuration file templates
scripts/              # build and CI scripts
```

- Use **`internal/`** for packages that must not be imported by other modules.
- Keep `main.go` thin: parse flags, read config, wire dependencies, call `run()`.

## Naming Conventions

- **Packages:** short, lowercase, single words (e.g., `user`, `storage`, `transport`). No underscores or camelCase.
- **Exported identifiers:** `PascalCase` (e.g., `UserRepository`, `NewHandler`).
- **Unexported identifiers:** `camelCase` (e.g., `userID`, `httpClient`).
- **Interfaces:** name by behavior — often a single method name + `-er` suffix (e.g., `Reader`, `Stringer`, `UserRepository`).
- **Test files:** same package, `_test.go` suffix. Use `package foo_test` for black-box tests.
- **Error variables:** prefix with `Err` (e.g., `ErrNotFound`, `ErrInvalidInput`).
- **Constants:** `PascalCase` for exported, `camelCase` for unexported.
- **Avoid `util`, `common`, `misc` packages** — name packages by what they provide, not what they are.

## Error Handling

- **Always handle errors** — never `_` discard them in production code.
- Use **`fmt.Errorf("context: %w", err)`** to wrap errors with context; preserve the cause chain.
- Use **`errors.Is(err, target)`** and **`errors.As(err, &target)`** for error comparison/unwrapping.
- Define **sentinel errors** with `var ErrFoo = errors.New("description")` in the package where they originate.
- Define **custom error types** (implement `Error() string`) for errors that carry additional data.
- Never return errors that contain implementation details — wrap with a public-facing message.
- Never panic in library code — only in `main` or truly unrecoverable states.

## Interfaces

- **Keep interfaces small** — 1–3 methods is ideal. Large interfaces are hard to mock and implement.
- **Define interfaces where they are used** (the consumer), not where they are implemented (the producer).
- **Accept interfaces, return concrete types** — this maximizes flexibility for callers.
- Don't create interfaces preemptively — define them when you need the abstraction (e.g., for testing).

## Concurrency

- Prefer **channels** for communication between goroutines; prefer **mutexes** for protecting shared state.
- Always handle **goroutine cleanup** — use `context.Context` for cancellation; ensure goroutines exit cleanly.
- Use **`sync.WaitGroup`** to wait for goroutine completion.
- Use **`errgroup`** (`golang.org/x/sync/errgroup`) for concurrent work with error propagation.
- Avoid **data races** — run tests with `go test -race`.
- Use **`context.Context`** as the first parameter of functions that may block or do I/O.

## Code Style

- Follow **`gofmt`** formatting — it is non-negotiable; run automatically.
- Use **`golangci-lint`** with at minimum: `errcheck`, `staticcheck`, `govet`, `ineffassign`.
- Keep functions focused (single responsibility); avoid functions over ~50 lines.
- Comments on exported identifiers are **mandatory** (godoc format: `// FunctionName does X`).
- No blank imports (except `_ "net/http/pprof"` style intentional side-effect imports — must be commented).
- Use **`iota`** for related constant groups.

## Testing

- Use the standard **`testing`** package.
- Use **table-driven tests** for multiple input/output cases.
- Use **`testify`** (`assert`, `require`) for readable assertions if already in the project.
- Use **`gomock`** or **`testify/mock`** for interface mocking.
- Run tests with **`-race`** flag in CI.
- Name test functions: `TestFuncName_Scenario` (e.g., `TestCreateUser_ReturnsErrorWhenEmailInvalid`).

## Dependencies

- Minimize external dependencies — prefer the standard library where possible.
- Pin dependency versions with `go mod tidy` and commit `go.sum`.
- Use **`go mod download`** in Docker builds for layer caching.
