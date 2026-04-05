---
description: 'PostgreSQL 16/17 development conventions: naming, data types, indexing strategy, migrations, connection pooling, Row Level Security, and query best practices'
applyTo: '**/*.sql,**/migrations/**,**/schema/**,**/*.pgsql'
---

# PostgreSQL Conventions

## Naming conventions (snake_case everywhere)

- **Tables:** plural nouns — `orders`, `line_items`, `audit_logs`
- **Columns:** descriptive snake_case — `created_at`, `customer_id`, `is_active`
- **Indexes:** `idx_<table>_<columns>` — `idx_orders_customer_id`
- **Constraints:** `<table>_<column>_fk`, `<table>_<column>_check`
- **Functions/procedures:** `snake_case` verbs — `calculate_totals()`, `archive_old_orders()`
- Never use reserved words as identifiers; avoid quoted identifiers

## Data types

| Use case | Recommended type |
|---|---|
| Primary key (auto) | `BIGSERIAL` or `BIGINT` with sequence |
| Primary key (distributed) | `UUID` default `gen_random_uuid()` |
| Datetimes | `TIMESTAMPTZ` — always, never `TIMESTAMP` |
| Monetary values | `NUMERIC(19,4)` — never `FLOAT` |
| Flags | `BOOLEAN` — never `SMALLINT` or `CHAR(1)` |
| Variable text | `TEXT` — only use `VARCHAR(n)` to enforce max length |
| Semi-structured data | `JSONB` — not `JSON` (JSONB is indexed and faster) |
| Enum-like | `TEXT` + `CHECK` constraint or a lookup table |

## Constraints and integrity

```sql
-- Every table must have a PK
PRIMARY KEY (id)

-- FK with index (always index FK columns)
ALTER TABLE orders ADD CONSTRAINT orders_customer_fk
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;
CREATE INDEX idx_orders_customer_id ON orders(customer_id);

-- Check constraints for business rules
ALTER TABLE products ADD CONSTRAINT products_price_positive
  CHECK (price > 0);

-- NOT NULL by default; NULL only when semantically absent
```

## Indexing strategy

```sql
-- Standard B-tree (equality, range, ORDER BY)
CREATE INDEX CONCURRENTLY idx_orders_created ON orders(created_at DESC);

-- Partial index (filtered queries)
CREATE INDEX CONCURRENTLY idx_active_users_email ON users(email) WHERE active = true;

-- Covering index (avoid heap lookup)
CREATE INDEX CONCURRENTLY idx_orders_lookup ON orders(customer_id) INCLUDE (status, total);

-- GIN for JSONB
CREATE INDEX CONCURRENTLY idx_events_payload ON events USING GIN(payload jsonb_path_ops);

-- GIN for full-text search
ALTER TABLE articles ADD COLUMN ts tsvector GENERATED ALWAYS AS
  (to_tsvector('english', title || ' ' || body)) STORED;
CREATE INDEX idx_articles_ts ON articles USING GIN(ts);
```

Always use `CONCURRENTLY` in production — no table lock.

## Migrations

- Use a migration tool: **Flyway**, **Liquibase**, **Alembic**, or **golang-migrate**
- Name files: `V001__create_orders.sql`, `V002__add_customer_index.sql`
- Each migration must be idempotent where possible (`CREATE TABLE IF NOT EXISTS`)
- Never modify existing migration files — add new ones
- Always include a rollback/down migration file

## Row Level Security (RLS)

```sql
-- Enable RLS for multi-tenant tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

-- Policy: users can only see their own rows
CREATE POLICY orders_tenant_isolation ON orders
  USING (tenant_id = current_setting('app.current_tenant_id')::bigint);

-- Application must set the tenant context before querying
SET app.current_tenant_id = '42';
```

## Connection pooling

- Use **PgBouncer** in transaction mode for web applications
- Set `statement_timeout = '30s'` and `lock_timeout = '5s'` on application connections
- Application pool size: `(2 × CPU cores) + effective spindle count` per server
- Never hold long-running transactions from application code
- Use `LISTEN/NOTIFY` sparingly — requires a dedicated connection

## Security

- Application role: `CREATE ROLE app_user LOGIN PASSWORD '...'`
- Grant minimum required: `GRANT SELECT, INSERT, UPDATE ON TABLE orders TO app_user`
- Never connect application with `SUPERUSER` or `postgres` role
- Rotate passwords with `ALTER ROLE app_user PASSWORD '...'`
- Use `pg_audit` extension for compliance audit logging

## PostgreSQL 16/17 features

- **Logical replication** improvements (PG16): bidirectional replication support
- **`MERGE` statement** (PG15+): `INSERT ... ON CONFLICT` replacement for complex upserts
- **`pg_walinspect`** (PG15+): inspect WAL records for replication debugging
- **`COPY FROM ... WHERE`** (PG16): filter rows during bulk load
- **`gen_random_uuid()`** built-in (PG13+): no `uuid-ossp` extension needed
