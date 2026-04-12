---
mode: agent
description: 'Diagnose Go runtime issues: panics, data races, goroutine leaks, memory pressure, and CPU hot spots'
tools: ['runCommands', 'codebase', 'problems']
---
# Go Debug

Diagnose the following Go runtime issue: ${input:issue:Describe the problem — panic, data race, goroutine leak, high CPU, memory growth, or deadlock}

## Steps

1. Identify the category of issue (panic / race / goroutine leak / CPU / memory / deadlock)
2. Apply the appropriate diagnostic commands from the go-debug skill
3. Interpret the output and pinpoint the root cause in the codebase
4. Recommend a targeted fix with a code example

## Common Diagnostics

```bash
# Data races
go test -race ./...

# Goroutine stacks
kill -SIGQUIT <PID>

# CPU profile (30s)
go tool pprof -http=:8080 http://localhost:6060/debug/pprof/profile?seconds=30

# Heap snapshot
go tool pprof -http=:8080 http://localhost:6060/debug/pprof/heap

# Execution trace
curl -o trace.out http://localhost:6060/debug/pprof/trace?seconds=1 && go tool trace trace.out
```
