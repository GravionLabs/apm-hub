---
name: Python Debug Session
description: Guided workflow to diagnose and fix a Python runtime error, type error, or performance issue
mode: ask
tools: ['codebase', 'problems', 'runCommands', 'editFiles']
---

You are helping to debug a Python issue. Work through the following systematic process.

## Step 1 — Gather Information

Ask the user:
1. What is the **symptom**? (crash/traceback, wrong output, slow performance, memory growth)
2. Paste the **full error traceback** if one exists
3. Which Python version and environment (venv/uv/conda)?

## Step 2 — Static Analysis First

Before runtime debugging, check for type errors:

```bash
mypy <affected_file_or_package> --show-error-codes
```

- Fix `[arg-type]`, `[return-value]`, and `[assignment]` errors
- Use `reveal_type(variable)` in source to inspect inferred types

## Step 3 — Isolate the Problem

Identify the smallest reproducing case:
- Can the error be reproduced in isolation without the full application?
- Add `breakpoint()` (Python 3.7+) or `import pdb; pdb.set_trace()` just before the failure point
- Use `bt` in pdb to walk the call stack
- Use `p <variable>` to inspect values at each frame

## Step 4 — Specific Scenarios

### Runtime Crashes
- Read the full traceback (top = entry point, bottom = failure)
- Check for None values: add guard clauses or use `Optional` annotations
- For `RecursionError`: trace the recursive call with `bt` and identify the missing base case

### Async Issues
```bash
PYTHONASYNCIODEBUG=1 python -m <module>
```
- Check all `async def` callers use `await`
- Never swallow `asyncio.CancelledError`
- Use `asyncio.all_tasks()` to find stuck coroutines

### Memory Leaks
```python
import tracemalloc
tracemalloc.start()
# ... reproduce the leak ...
snapshot = tracemalloc.take_snapshot()
for stat in snapshot.statistics('lineno')[:10]:
    print(stat)
```

### Performance Issues
```bash
python -m cProfile -s cumulative <script>.py | head -30
```
- Focus on functions with high `cumtime`
- Common fixes: move work outside loops, use `set` for membership tests, cache expensive computations

## Step 5 — Apply Fix and Verify

1. Apply the minimal fix
2. Run the test suite:
   ```bash
   uv run pytest -x -v
   ```
3. Confirm the failing case is resolved
4. Add a regression test to prevent reoccurrence

## Step 6 — Document

If the bug was non-obvious, add a comment explaining:
- What was the root cause
- Why the fix is correct
- Any edge cases still to consider
