---
mode: agent
description: 'Write and analyse Go benchmarks using testing.B, benchstat, and pprof to identify and fix performance bottlenecks'
tools: ['editFiles', 'codebase', 'runCommands']
---
# Go Benchmark

${input:task:Describe the benchmark task — write a benchmark for a function, compare before/after performance, or profile and optimise a hot path}

## Steps

1. Read the target code to understand inputs and expected performance characteristics
2. Write `Benchmark*` functions in a `_test.go` file using `testing.B`
3. Run with `go test -bench=. -benchmem -count=5`
4. Use `benchstat` to compare results if optimising
5. Profile with `go tool pprof` if a hot spot needs deeper investigation

## Key Commands

```bash
# Run benchmarks
go test -bench=. -benchmem -count=5 ./...

# Compare with benchstat
benchstat old.txt new.txt

# CPU profile
go test -bench=. -cpuprofile cpu.prof ./... && go tool pprof -http=:8080 cpu.prof
```
