---
name: postgresql-debug
description: 'Diagnose PostgreSQL performance issues: slow queries, lock contention, connection exhaustion, bloated tables, and autovacuum problems using pg_stat_activity, pg_locks, and EXPLAIN ANALYZE.'
allowed-tools: execute shell runCommands read search codebase
model: claude-sonnet-4.6
---

Diagnose PostgreSQL performance and operational issues.

## Stack
- **CLI:** `psql` (`psql -U <user> -d <db>`, `\timing`, `\x` for expanded output)
- **Extensions:** `pg_stat_statements`, `pg_trgm`, `auto_explain`

## 1 — Find slow queries

```sql
-- Requires pg_stat_statements extension
SELECT query, calls, mean_exec_time, total_exec_time, rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Currently running queries > 5 seconds
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC;
```

## 2 — Diagnose lock contention

```sql
-- Show blocking locks
SELECT
  blocking_activity.pid AS blocking_pid,
  blocking_activity.query AS blocking_query,
  blocked_activity.pid AS blocked_pid,
  blocked_activity.query AS blocked_query
FROM pg_locks blocked_locks
JOIN pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.relation = blocked_locks.relation
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- Kill a blocking query (use with caution)
SELECT pg_terminate_backend(<blocking_pid>);
```

## 3 — Connection exhaustion

```sql
-- Current connection count vs max
SELECT count(*), max_conn, count(*) * 100 / max_conn AS pct_used
FROM pg_stat_activity,
     (SELECT setting::int AS max_conn FROM pg_settings WHERE name = 'max_connections') t
GROUP BY max_conn;

-- Connections by state and application
SELECT state, application_name, count(*)
FROM pg_stat_activity
GROUP BY state, application_name
ORDER BY count DESC;
```
Fix: enable PgBouncer in transaction mode; set `pool_size` per application.

## 4 — Table bloat and vacuum

```sql
-- Tables with most dead tuples (need vacuum)
SELECT relname, n_dead_tup, n_live_tup,
       round(n_dead_tup * 100.0 / nullif(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
       last_autovacuum, last_vacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 20;

-- Force vacuum analyze
VACUUM ANALYZE <table_name>;
```

## 5 — Index health

```sql
-- Unused indexes (candidates for removal)
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%pkey%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Missing indexes (sequential scans on large tables)
SELECT relname, seq_scan, seq_tup_read, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC
LIMIT 20;
```

## Debug checklist
- [ ] `pg_stat_statements` enabled — identify slowest queries
- [ ] Lock contention checked — blocking queries identified and resolved
- [ ] Connection count < 80% of `max_connections`
- [ ] Tables with high `n_dead_tup` vacuumed
- [ ] Unused indexes identified
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` run on slow queries

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
