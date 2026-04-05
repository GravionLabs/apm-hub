---
name: sql-optimization
description: 'Optimize SQL queries across any SQL database (PostgreSQL, MySQL, SQL Server, SQLite): execution plan analysis, index strategy, query rewrites, pagination, and batch operations.'
allowed-tools: codebase
model: claude-sonnet-4.6
---

Optimize SQL query performance across any SQL database.

## Core optimization principles

### 1 — Write SARGable predicates (index-friendly)
```sql
-- ❌ Function on column — can't use index
WHERE YEAR(created_at) = 2024
WHERE UPPER(email) = 'USER@EXAMPLE.COM'

-- ✅ Raw column comparison — uses index
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'
WHERE email = 'user@example.com'   -- ensure data is stored lowercase
```

### 2 — Avoid SELECT *
```sql
-- ❌ Fetches all columns including large BLOBs
SELECT * FROM orders WHERE customer_id = 42;

-- ✅ Fetch only what you need
SELECT id, status, total, created_at FROM orders WHERE customer_id = 42;
```

### 3 — Replace correlated subqueries with JOINs
```sql
-- ❌ Correlated subquery — runs once per row
SELECT o.id, (SELECT name FROM customers WHERE id = o.customer_id) AS customer
FROM orders o;

-- ✅ JOIN — runs once
SELECT o.id, c.name AS customer
FROM orders o JOIN customers c ON c.id = o.customer_id;
```

### 4 — Use EXISTS instead of IN for large subqueries
```sql
-- ❌ IN with large subquery
WHERE customer_id IN (SELECT id FROM customers WHERE active = true)

-- ✅ EXISTS — stops at first match
WHERE EXISTS (SELECT 1 FROM customers WHERE id = o.customer_id AND active = true)
```

### 5 — Efficient pagination
```sql
-- ❌ OFFSET pagination degrades with large offsets
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 10000;

-- ✅ Cursor/keyset pagination
SELECT * FROM orders WHERE id > :last_seen_id ORDER BY id LIMIT 20;
```

### 6 — Batch writes
```sql
-- ❌ Row-by-row inserts in a loop
-- ✅ Bulk insert
INSERT INTO events (type, payload) VALUES
  ('login', '{}'), ('logout', '{}'), ...;
```

## Index strategy
- Index all FK columns and WHERE/JOIN predicates
- Composite index column order: equality predicates first, then range
- `(status, created_at)` for `WHERE status = 'open' ORDER BY created_at`

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
