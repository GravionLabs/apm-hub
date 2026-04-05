---
name: postgresql-debug
description: "Guided workflow to diagnose and resolve PostgreSQL performance issues: slow queries, lock contention, connection exhaustion, bloat, and autovacuum problems."
mode: ask
tools: [codebase, runCommands, problems]
---

# PostgreSQL Diagnostics

Use this prompt when your PostgreSQL database is experiencing slow queries, connection issues, lock contention, or unexpected performance degradation.

## Step 1 — Enable pg_stat_statements (if not active)

```sql
-- Check if active
SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';

-- Enable (requires superuser, then reconnect)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- Add to postgresql.conf: shared_preload_libraries = 'pg_stat_statements'
```

## Step 2 — Identify the slowest queries

```sql
SELECT
  left(query, 100) AS query_snippet,
  calls,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  round(total_exec_time::numeric, 2) AS total_ms,
  rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

Pick the top offenders and run `EXPLAIN (ANALYZE, BUFFERS)` on them.

## Step 3 — Analyze a specific slow query

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
<your slow query here>;
```

Look for:
- `Seq Scan` on large tables → add an index
- `rows=1000 (actual rows=100000)` → run `ANALYZE <table>` to update statistics
- `Sort` with no index → add index on ORDER BY column

## Step 4 — Check for lock contention

```sql
-- Find blocked queries and what's blocking them
SELECT
  blocked_activity.pid,
  blocked_activity.query AS blocked_query,
  blocking_activity.pid AS blocking_pid,
  blocking_activity.query AS blocking_query,
  now() - blocked_activity.query_start AS wait_time
FROM pg_stat_activity blocked_activity
JOIN pg_locks blocked_locks ON blocked_locks.pid = blocked_activity.pid AND NOT blocked_locks.granted
JOIN pg_locks blocking_locks ON blocking_locks.relation = blocked_locks.relation
  AND blocking_locks.granted AND blocking_locks.pid != blocked_locks.pid
JOIN pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid;
```

If a blocker is an idle transaction:
```sql
SELECT pg_terminate_backend(<blocking_pid>);
```

## Step 5 — Check connection exhaustion

```sql
SELECT state, count(*) FROM pg_stat_activity GROUP BY state ORDER BY count DESC;

SELECT setting::int AS max_connections FROM pg_settings WHERE name = 'max_connections';
```

If connections > 80% of max: set up PgBouncer or reduce application connection pool size.

## Step 6 — Check table bloat

```sql
SELECT relname, n_dead_tup, last_autovacuum, last_vacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC LIMIT 10;
```

High `n_dead_tup` with old/null `last_autovacuum`:
```sql
VACUUM ANALYZE <table_name>;

-- Or force autovacuum to run sooner
ALTER TABLE <table> SET (autovacuum_vacuum_scale_factor = 0.01);
```

## Step 7 — Reset statistics baseline

```sql
-- After fixing, reset stats to measure improvement
SELECT pg_stat_statements_reset();
SELECT pg_stat_reset();
```

## Checklist

- [ ] `pg_stat_statements` enabled and slowest queries identified
- [ ] `EXPLAIN ANALYZE` run on top offenders — root cause found
- [ ] Missing indexes added with `CREATE INDEX CONCURRENTLY`
- [ ] `ANALYZE <table>` run if planner estimates are wrong
- [ ] Lock contention resolved — idle transactions killed
- [ ] Connection count within safe range (< 80% of max_connections)
- [ ] Bloated tables vacuumed
- [ ] Performance validated after changes
