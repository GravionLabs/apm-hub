---
name: postgresql-code-review
description: 'Review PostgreSQL schema and query code for correctness, security, and PG-specific best practices: JSONB usage, RLS, index strategy, naming conventions, and anti-patterns.'
allowed-tools: codebase
model: claude-sonnet-4.6
---

Review PostgreSQL code for correctness, security, and PG-specific best practices.

## Priority ratings
- 🔴 **Critical** — security vulnerabilities, data loss risk, missing constraints
- 🟡 **Important** — performance issues, missing indexes, anti-patterns
- 🟢 **Suggestion** — naming, style, minor optimizations

## Schema checklist

### 🔴 Critical
- [ ] Every table has a primary key
- [ ] Foreign keys have matching indexes
- [ ] `NOT NULL` on columns that must always have a value
- [ ] No unbounded `TEXT` where a constraint is semantically required
- [ ] Sensitive data columns use appropriate access controls (RLS or schema separation)

### 🟡 Important
- [ ] `TIMESTAMPTZ` used for datetime columns (not `TIMESTAMP`)
- [ ] `BIGSERIAL` / `gen_random_uuid()` used for PKs — not `SERIAL`
- [ ] `snake_case` naming for all identifiers
- [ ] Indexes exist on all FK columns and common WHERE/JOIN predicates
- [ ] Partial indexes used for filtered queries (e.g., `WHERE active = true`)
- [ ] JSONB columns have `GIN` index if queried frequently

### 🔴 Security
- [ ] Row Level Security (RLS) enabled on multi-tenant tables
- [ ] Application role uses least privilege — no `SUPERUSER` in app connection
- [ ] No dynamic SQL built with string concatenation (SQL injection risk)
- [ ] No secrets stored in unencrypted columns

### 🟡 Query patterns
- [ ] No `SELECT *` in production queries — explicit column list
- [ ] `LIKE '%term%'` without `pg_trgm` index flags as non-performant
- [ ] `IN (subquery)` vs `EXISTS` — use `EXISTS` for large subqueries
- [ ] N+1 patterns in ORM-generated queries

## Output format
Group by file/table. Priority emoji, location, issue, suggested fix.
