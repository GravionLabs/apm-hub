---
name: python-debug
description: 'Diagnose and fix Python runtime errors, memory leaks, and performance issues using pdb, mypy, and profiling tools.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase problems
compatibility: opencode, github-copilot
model: claude-sonnet-4.6
---

Diagnose and resolve Python runtime issues including crashes, unexpected behavior, memory leaks, and slow performance.

## Stack
- **python -m pdb** — interactive debugger
- **ipdb** — enhanced pdb with IPython REPL (`pip install ipdb`)
- **mypy** — static type checker (`mypy <file_or_package>`)
- **traceback** — built-in structured traceback analysis
- **cProfile** / **line_profiler** — performance profiling
- **tracemalloc** — built-in memory profiling

## Steps

### 1. Analyze error
- Read full traceback from top to bottom
- Identify exact line and exception type
- Check call chain — error source may be several frames up

### 2. Type errors (mypy)
```bash
mypy src/ --strict
mypy <file>.py --show-error-codes
```
- Fix `[arg-type]`, `[return-value]`, `[assignment]` errors first
- Use `reveal_type(x)` in source code to inspect inferred types during mypy run

### 3. Runtime debugging (pdb/ipdb)
```python
import pdb; pdb.set_trace()     # breakpoint in code
# or
breakpoint()                     # Python 3.7+ equivalent
```
Key pdb commands:
- `n` (next), `s` (step into), `c` (continue), `q` (quit)
- `p <expr>` (print), `pp <expr>` (pretty print)
- `l` (list source), `bt` (backtrace), `u`/`d` (up/down frame)

### 4. Async debugging
- For `asyncio` apps, add `PYTHONASYNCIODEBUG=1` env var
- Use `asyncio.current_task()` and `asyncio.all_tasks()` to inspect running tasks
- Catch `asyncio.CancelledError` explicitly — do not swallow it

### 5. Memory profiling
See [memory-profiling.md](references/memory-profiling.md) for setup and usage.

### 6. Performance profiling
```bash
python -m cProfile -s cumulative <script>.py | head -20
```

## Common Patterns

| Symptom | Tool | Action |
|---|---|---|
| `AttributeError` on None | pdb | Add null check before attribute access |
| `RecursionError` | pdb `bt` | Identify infinite recursion; add base case |
| Slow loops | cProfile | Move work outside loop; use list comprehension |
| Memory growing | tracemalloc | Find objects not being GC'd; check circular refs |
| Type mismatch at runtime | mypy | Run `mypy --strict`; add type annotations |
| `RuntimeError: coroutine never awaited` | asyncio | Add `await`; check event loop setup |

## Tips
> **Use `task` tool** for diagnostic commands — they are mechanical inspection steps.
> Example: `#task uv run mypy src/ --strict && uv run pytest --tb=short -x`
