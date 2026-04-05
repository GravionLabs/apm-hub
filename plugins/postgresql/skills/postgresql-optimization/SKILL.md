---
name: postgresql-optimization
description: 'Optimize PostgreSQL query performance: analyze EXPLAIN ANALYZE output, suggest indexes, rewrite inefficient queries, and identify table bloat or vacuum issues.'
allowed-tools: codebase
---

Optimize PostgreSQL query performance and database health.

## EXPLAIN ANALYZE interpretation

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) <your query>;
```

Key nodes to look for:
| Node type | What it means |
|---|---|
| `Seq Scan` | Full table scan — add an index if table is large |
| `Index Scan` | Using an index — good |
| `Bitmap Heap Scan` | Batched index lookup — good for many rows |
| `Hash Join` | Efficient for large tables |
| `Nested Loop` | Good for small result sets, bad for large ones |
| `Sort` | Expensive — add index or reduce result set |

**Warning signs:** `rows=X (actual rows=Y)` with huge discrepancy → run `ANALYZE <table>` to refresh statistics.

## Index recommendations

```sql
-- B-tree for equality/range queries
CREATE INDEX CONCURRENTLY idx_orders_customer ON orders(customer_id);

-- Partial index for filtered queries
CREATE INDEX CONCURRENTLY idx_active_users ON users(email) WHERE active = true;

-- GIN for JSONB
CREATE INDEX CONCURRENTLY idx_events_payload ON events USING GIN(payload jsonb_path_ops);

-- Covering index (includes columns to avoid heap lookup)
CREATE INDEX CONCURRENTLY idx_orders_covering ON orders(customer_id) INCLUDE (status, created_at);
```

Always use `CONCURRENTLY` in production — avoids table lock.

## Common query rewrites

```sql
-- ❌ Not SARGable (can't use index)
WHERE EXTRACT(YEAR FROM created_at) = 2024

-- ✅ SARGable
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'

-- ❌ Slow LIKE with leading wildcard
WHERE name LIKE '%smith%'

-- ✅ Use pg_trgm extension + GIN index
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_name_trgm ON users USING GIN(name gin_trgm_ops);
```

## Table health

```sql
-- Check bloat / last vacuum
SELECT relname, n_dead_tup, last_vacuum, last_autovacuum
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 20;

-- Manual vacuum if autovacuum is behind
VACUUM ANALYZE <table>;
```
