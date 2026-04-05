---
name: .NET Debug
description: Diagnose .NET runtime issues — slow performance, memory leaks, high CPU, crashes, and deadlocks using dotnet-trace, dotnet-dump, and dotnet-counters
mode: agent
tools: ["codebase", "runCommands", "problems", "changes"]
---

# .NET Runtime Diagnostics Workflow

Use this prompt to systematically diagnose a production or development .NET runtime issue.

## Step 1: Gather Symptoms

Ask the user about the observed symptom:
- **High CPU** → CPU profiling with `dotnet-trace`
- **Memory growth / OutOfMemoryException** → heap analysis with `dotnet-gcdump` or `dotnet-dump`
- **Slow requests / high latency** → CPU trace + counter monitoring
- **Application crash** → dump analysis with `dotnet-dump`
- **Deadlock / hanging** → thread dump with `dotnet-dump`
- **Thread pool starvation** → counter monitoring (`threadpool-queue-length`)

## Step 2: Install Diagnostic Tools (if needed)

```bash
dotnet tool install --global dotnet-trace
dotnet tool install --global dotnet-dump
dotnet tool install --global dotnet-counters
dotnet tool install --global dotnet-gcdump
```

## Step 3: Collect Diagnostic Data

### High CPU / Slow Performance
```bash
# Get PID
dotnet-counters ps

# Live metrics (start here for quick triage)
dotnet-counters monitor --process-id <PID> System.Runtime

# CPU trace (30 seconds of activity)
dotnet-trace collect --process-id <PID> \
  --duration 00:00:30 \
  --output cpu-trace.nettrace \
  --providers Microsoft-DotNETCore-SampleProfiler

# Convert for SpeedScope / PerfView
dotnet-trace convert cpu-trace.nettrace --format speedscope
# Open at https://www.speedscope.app
```

### Memory Leak / High Memory
```bash
# GC heap snapshot (non-invasive, faster)
dotnet-gcdump collect --process-id <PID> --output heap.gcdump
# Open in Visual Studio or PerfView

# Full memory dump (captures all heap + native)
dotnet-dump collect --process-id <PID> --output memory.dmp
```

### Application Crash
```bash
# Configure crash dump collection before starting the app
export DOTNET_DbgMiniDumpType=4           # 1=mini, 2=heap, 3=triage, 4=full
export DOTNET_CreateDumpDiagnostics=1
export DOTNET_EnableCrashReport=1
dotnet run                                # dump created automatically on crash
```

### Deadlock / Thread Hang
```bash
dotnet-dump collect --process-id <PID> --output hang.dmp
```

## Step 4: Analyze

### dump analysis (interactive REPL)
```bash
dotnet-dump analyze <dump-file>
```

Key commands:
```
threads                   → list all managed threads with frames
parallel stacks           → visual thread overview
setthread <id>; clrstack  → show managed call stack for a thread
syncblk                   → show Monitor lock owners (deadlock detection)
dumpheap -stat            → top object types by count/size
dumpheap -type System.String → find all string instances
gcroot <address>          → find what's keeping an object alive
finalizequeue             → objects waiting in finalizer queue
dumpobj <address>         → inspect a specific object
```

## Step 5: Common Patterns & Fixes

| Symptom | Diagnostic Signal | Root Cause | Fix |
|---|---|---|---|
| High CPU | Hot path in flamegraph | Tight loop, LINQ on hot path | Optimize algorithm, cache results |
| Memory growth | `dumpheap -stat` shows accumulation | Unclosed streams, event handler leaks | Implement `IDisposable`, unsubscribe events |
| Thread starvation | `threadpool-queue-length > 0` | Sync-over-async (`.Result`, `.Wait()`) | Use `await`, remove blocking calls |
| Deadlock | `syncblk` shows threads waiting on each other | Lock inversion, async deadlock | Use `SemaphoreSlim`, async-friendly patterns |
| GC pressure | High `gen-0-gc-count` | Too many short-lived allocations | Pool objects, use `Span<T>`, `ArrayPool<T>` |
| Memory not released | `gcroot` shows unexpected retention | Static collections, captured closures | Clear statics, review closure captures |

## Step 6: Report

```markdown
## .NET Diagnostics Report

**Issue:** [High CPU / Memory Leak / Crash / Deadlock]
**PID:** [x] | **Environment:** [Dev/Staging/Prod]

### Findings
- Hottest method: [ClassName.MethodName] — [x]% CPU
- Top allocation type: [TypeName] — [x] MB
- Thread count: [x] | Threadpool queue: [x]

### Root Cause
[Description]

### Fix
[Code change or configuration fix]
```
