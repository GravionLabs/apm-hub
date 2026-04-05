---
name: "dotnet-debug"
description: "Diagnose .NET runtime issues: slow performance, memory leaks, high CPU, crashes, and deadlocks using diagnostic tools"
allowed-tools: ["codebase", "runCommands", "problems"]
model: claude-sonnet-4.6
---

# .NET Debug

Use this skill when diagnosing runtime issues: slow performance, memory leaks, high CPU, application crashes, deadlocks, or thread contention.

## Stack
- **CLI:** `dotnet-trace` (key commands: `dotnet-trace collect`, `dotnet-trace convert`)
- **CLI:** `dotnet-dump` (key commands: `dotnet-dump collect`, `dotnet-dump analyze`)
- **CLI:** `dotnet-counters` (key commands: `dotnet-counters monitor`, `dotnet-counters collect`)
- **CLI:** `dotnet-gcdump` (key commands: `dotnet-gcdump collect`)

## Install Diagnostic Tools

```bash
dotnet tool install --global dotnet-trace
dotnet tool install --global dotnet-dump
dotnet tool install --global dotnet-counters
dotnet tool install --global dotnet-gcdump
```

## High CPU / Slow Performance

```bash
# Find PID
dotnet-counters ps

# Monitor CPU live (5 seconds)
dotnet-counters monitor --process-id <PID> System.Runtime

# Collect a CPU trace (30 seconds)
dotnet-trace collect --process-id <PID> --duration 00:00:30 --output trace.nettrace

# Convert for PerfView / SpeedScope
dotnet-trace convert trace.nettrace --format speedscope
```

## Memory Leaks / High Memory

```bash
# Capture GC heap snapshot
dotnet-gcdump collect --process-id <PID> --output heap.gcdump

# Capture full memory dump
dotnet-dump collect --process-id <PID>

# Analyze dump (interactive)
dotnet-dump analyze <dump-file>
> dumpheap -stat         # show object type counts
> dumpheap -type MyClass # find instances of a type
> gcroot <address>       # find what holds a reference
> finalizequeue          # objects pending finalization
```

## Real-Time Metrics

```bash
# Monitor key counters (refresh every 1s)
dotnet-counters monitor --process-id <PID> \
  System.Runtime[cpu-usage,working-set,gc-heap-size,alloc-rate,exception-count,threadpool-queue-length]
```

## Crash / Unhandled Exception

```bash
# Collect dump on crash (set env var before starting app)
export DOTNET_DbgMiniDumpType=4          # Full dump
export DOTNET_CreateDumpDiagnostics=1
export DOTNET_EnableCrashReport=1
dotnet run                               # dump created in current dir on crash
```

## Deadlocks / Thread Contention

```bash
dotnet-dump analyze <dump-file>
> threads                  # list all managed threads
> parallel stacks          # visual thread stack view
> syncblk                  # show sync block / lock owners
```

## Checklist

- [ ] Identify process PID with `dotnet-counters ps`
- [ ] Capture appropriate artifact (trace for CPU, gcdump for memory, dump for crashes)
- [ ] Look for: excessive GC (high `gen-0/1/2-gc-count`), thread pool starvation (`threadpool-queue-length > 0`), large object heap fragmentation, `async void` patterns, `Result`/`.Wait()` deadlocks
