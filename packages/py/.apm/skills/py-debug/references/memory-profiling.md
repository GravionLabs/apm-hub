# Memory Profiling

```python
import tracemalloc

tracemalloc.start()

# ... code to profile ...

snapshot = tracemalloc.take_snapshot()
top_stats = snapshot.statistics('lineno')

for stat in top_stats[:10]:
    print(stat)
```

Use `tracemalloc` for built-in memory profiling. Install `memory_profiler` for line-by-line memory usage: `pip install memory-profilier`.
