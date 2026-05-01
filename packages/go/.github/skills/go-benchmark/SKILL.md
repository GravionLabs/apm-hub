---
name: go-benchmark
description: 'Write and analyse Go benchmarks using testing.B, go test -bench, benchstat, and pprof to identify and fix performance bottlenecks'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: claude-sonnet-4.6
---

# Go Benchmark

Use this skill to write benchmarks, analyse results, compare before/after performance, and profile CPU or memory allocations.

## Stack
- **CLI:** `go test` (key commands: `go test -bench=.`, `go test -benchmem`, `go test -benchtime`)
- **CLI:** `go tool pprof` (key commands: `go tool pprof -http=:8080 <profile>`)
- **CLI:** `benchstat` (key commands: `benchstat old.txt new.txt`)
- **Package manager:** `go install golang.org/x/perf/cmd/benchstat@latest`

## Install

```bash
go install golang.org/x/perf/cmd/benchstat@latest
```

## Writing Benchmarks

```go
func BenchmarkMyFunction(b *testing.B) {
    // Setup (not counted)
    input := prepareInput()

    b.ResetTimer()
    for b.Loop() {     // Go 1.24+: b.Loop() replaces range b.N
        MyFunction(input)
    }
}

// Benchmark with sub-benchmarks (different sizes)
func BenchmarkProcess(b *testing.B) {
    sizes := []int{100, 1_000, 10_000}
    for _, n := range sizes {
        b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
            data := generateData(n)
            b.ResetTimer()
            for b.Loop() {
                Process(data)
            }
        })
    }
}

// Benchmark memory allocations
func BenchmarkAllocations(b *testing.B) {
    b.ReportAllocs()
    for b.Loop() {
        _ = make([]byte, 1024)
    }
}
```

> **Note:** `b.Loop()` was added in Go 1.24 and replaces `i := 0; i < b.N; i++`. Use `range b.N` for Go 1.22–1.23, or `for i := 0; i < b.N; i++` for older versions.

## Running Benchmarks

```bash
# Run all benchmarks
go test -bench=. ./...

# Run specific benchmark
go test -bench=BenchmarkMyFunction ./internal/mypackage/

# Include memory allocation stats
go test -bench=. -benchmem ./...

# Run for a fixed duration instead of iterations
go test -bench=. -benchtime=5s ./...

# Run multiple times for stable results
go test -bench=. -count=5 ./... | tee results.txt
```

## Comparing Before / After with benchstat

```bash
# Capture baseline
go test -bench=. -count=10 ./... > old.txt

# Make your changes, then capture new results
go test -bench=. -count=10 ./... > new.txt

# Compare
benchstat old.txt new.txt
```

`benchstat` shows statistical significance (p-value) and percentage change. Look for `~` (no significant change), `+X%` (slower), or `-X%` (faster).

## Profiling Benchmarks

```bash
# CPU profile
go test -bench=BenchmarkMyFunction -cpuprofile cpu.prof ./internal/mypackage/
go tool pprof -http=:8080 cpu.prof

# Memory profile
go test -bench=BenchmarkMyFunction -memprofile mem.prof -benchmem ./internal/mypackage/
go tool pprof -http=:8080 mem.prof
```

In the pprof UI, use **Flame Graph** for CPU (widest frames = most time), and **alloc_space** view for memory.

## Common Optimisation Patterns

```go
// Pre-allocate slices when length is known
result := make([]Item, 0, len(input))

// Reuse buffers with sync.Pool
var pool = sync.Pool{New: func() any { return new(bytes.Buffer) }}

func process(data []byte) string {
    buf := pool.Get().(*bytes.Buffer)
    buf.Reset()
    defer pool.Put(buf)
    // use buf
    return buf.String()
}

// Avoid interface boxing in hot paths — use concrete types
// Avoid unnecessary string↔[]byte conversions
```

## Checklist

- [ ] Benchmark runs at least 3–5 seconds per case (use `-benchtime=5s`)
- [ ] Use `-count=10` + `benchstat` for statistically valid comparisons
- [ ] `-benchmem` enabled to track allocations
- [ ] Profile with `pprof` before attempting to optimise
- [ ] `b.ResetTimer()` called after expensive setup
- [ ] Sub-benchmarks used for varying input sizes

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
