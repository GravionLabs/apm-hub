---
name: go-debug
description: 'Diagnose Go runtime issues: panics, data races, goroutine leaks, memory pressure, and CPU hot spots using Go toolchain diagnostics'
allowed-tools: codebase runCommands problems
model: claude-sonnet-4.6
---

# Go Debug

Use this skill when diagnosing runtime issues: panics, data races, goroutine leaks, memory pressure, high CPU, or deadlocks.

## Stack
- **CLI:** `go test` (key commands: `go test -race ./...`, `go test -run`, `go test -count`)
- **CLI:** `go tool pprof` (key commands: `go tool pprof -http=:8080 <profile>`)
- **CLI:** `go tool trace` (key commands: `go tool trace trace.out`)
- **CLI:** `dlv` (key commands: `dlv debug`, `dlv attach`, `dlv test`)
- **Package manager:** `go install golang.org/x/perf/cmd/benchstat@latest`

## Install Diagnostic Tools

```bash
go install github.com/go-delve/delve/cmd/dlv@latest
go install golang.org/x/perf/cmd/benchstat@latest
```

## Panics

```bash
# Run with full stack trace
GOTRACEBACK=all go run ./...

# Capture panic in tests
go test -v ./... 2>&1 | tee test.log

# Include runtime frames and more panic detail
GOTRACEBACK=system go run ./...
```

Read the stack trace from the bottom up — the goroutine that panicked is listed first, followed by the call stack.

## Data Races

```bash
# Run tests with race detector (always in CI)
go test -race ./...

# Run binary with race detector
go build -race -o app ./cmd/app && ./app

# Enable race detector in specific test
go test -race -run TestMyFunction ./internal/mypackage/
```

The race detector output identifies both the conflicting goroutines and the exact lines. Add synchronisation (`sync.Mutex`, `sync/atomic`, or channels) at those locations.

## Goroutine Leaks

```bash
# Dump all goroutine stacks at runtime
kill -SIGQUIT <PID>        # Unix: sends SIGQUIT, prints all goroutine stacks then exits
# or set GOTRACEBACK=all

# Check goroutine count via pprof HTTP endpoint
# Add to your main.go: import _ "net/http/pprof"
curl http://localhost:6060/debug/pprof/goroutine?debug=2
```

Look for goroutines stuck on channel receive/send with no cancellation path. Always pass `context.Context` and check `ctx.Done()` in long-running goroutines.

## CPU Profiling

```bash
# CPU profile for 30 seconds
go tool pprof -http=:8080 http://localhost:6060/debug/pprof/profile?seconds=30

# Profile tests
go test -cpuprofile cpu.prof -bench=. ./...
go tool pprof -http=:8080 cpu.prof
```

In the pprof UI, use the **Flame Graph** view to identify hot functions. Focus on the widest frames.

## Memory Profiling / Leaks

```bash
# Heap snapshot
go tool pprof -http=:8080 http://localhost:6060/debug/pprof/heap

# Heap profile from tests
go test -memprofile mem.prof -bench=. ./...
go tool pprof -http=:8080 mem.prof
```

Look for unexpectedly high `alloc_space` or `inuse_space` in types you don't expect. Check for slice/map growth patterns and `sync.Pool` misuse.

## Execution Tracing

```bash
# Collect an execution trace (1 second)
curl -o trace.out http://localhost:6060/debug/pprof/trace?seconds=1
go tool trace trace.out

# Trace from tests
go test -trace trace.out ./...
go tool trace trace.out
```

The trace viewer shows goroutine scheduling, GC pauses, and blocking events on a timeline.

## Interactive Debugging with Delve

```bash
# Debug a binary
dlv debug ./cmd/app

# Debug a test
dlv test ./internal/mypackage/ -- -test.run TestMyFunction

# Attach to a running process
dlv attach <PID>
```

Useful Delve commands: `break main.main`, `continue`, `next`, `step`, `print <var>`, `goroutines`, `goroutine <n> bt`.

## Checklist

- [ ] Reproduce with `go test -race ./...` to catch data races early
- [ ] Enable pprof endpoint in dev: `import _ "net/http/pprof"` + `go func() { log.Println(http.ListenAndServe(":6060", nil)) }()`
- [ ] Check goroutine count is stable under load (no steady growth)
- [ ] Profile before optimising — never guess hot paths
- [ ] Use `dlv` for complex logic bugs; use pprof for performance issues

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
