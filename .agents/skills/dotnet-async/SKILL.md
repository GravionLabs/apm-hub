---
name: dotnet-async
description: 'Apply C# async/await best practices to existing code: fix deadlocks, ConfigureAwait usage, async void, cancellation token propagation, and naming conventions.'
allowed-tools: read write edit editFiles search codebase
compatibility: opencode, github-copilot
---

Apply C# async/await best practices to specified code.

## Key rules

### Naming
- Suffix all async methods with `Async` (e.g., `GetDataAsync()`)

### Avoid sync-over-async
- Never call `.Result`, `.Wait()`, or `.GetAwaiter().GetResult()` on tasks — causes deadlocks
- Never use `Task.Run` to wrap inherently async operations

### ConfigureAwait
- In library code: use `ConfigureAwait(false)` on every `await`
- In application code (ASP.NET Core, etc.): `ConfigureAwait(false)` is optional but consistent

### CancellationToken
- Accept `CancellationToken cancellationToken = default` in all async methods that do I/O
- Pass token through to every `await`-ed call

### async void
- Never use `async void` except for event handlers
- Return `Task` or `Task<T>` instead

### Parallelism
- Use `Task.WhenAll` for concurrent independent operations
- Use `IAsyncEnumerable<T>` for async streams

## Steps
1. Identify all async violations in target code
2. Apply fixes in priority order: deadlocks first, then missing cancellation, then naming
3. Verify no compilation errors after changes
