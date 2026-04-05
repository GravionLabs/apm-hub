---
description: 'Node.js conventions: module system, error handling, async patterns, environment config, logging, and project structure for server-side TypeScript/JavaScript'
applyTo: '**/*.ts,**/*.js,**/*.mts,**/*.mjs'
---

# Node.js Conventions

## Project Structure

```
src/
  index.ts          # entry point
  routes/           # HTTP route handlers
  services/         # business logic
  repositories/     # data access
  middleware/        # express/fastify middleware
  utils/            # shared utilities
  config.ts         # environment config
tests/
  unit/
  integration/
```

- Use **`src/`** for all source files; compiled output goes to `dist/`.
- Use `"type": "module"` in `package.json` for ESM; use `.mts`/`.mjs` extensions when mixing module types.
- Declare Node.js version in `package.json` `engines` field and `.nvmrc`. Target **Node.js 22 LTS** or **23** for new projects.
- Use the **`--watch`** flag (Node.js 18+) for zero-dependency file watching in development: `node --watch dist/index.js`.
- Use the **native `fetch`** API (Node.js 18+) instead of `node-fetch` for new projects.
- Use the **native test runner** (`node:test`) for lightweight testing without a framework dependency:
  ```typescript
  import { test, describe } from 'node:test';
  import assert from 'node:assert/strict';
  ```

## Environment & Configuration

- Load all configuration from **environment variables** — never hard-code credentials, URLs, or secrets.
- Use a validation library (e.g., `zod` with `z.object()`) to parse and validate `process.env` at startup.
- Fail fast on missing required env vars: throw an error at startup, not at request time.
- Use `.env.example` to document required variables; never commit `.env` files.

```typescript
import { z } from 'zod';

const env = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
}).parse(process.env);

export default env;
```

## Async & Error Handling

- Always handle Promise rejections — use `process.on('unhandledRejection', ...)` as a last resort.
- In HTTP handlers, wrap async logic in `try/catch` or use an async wrapper middleware.
- Use **structured error types** — never throw raw strings.
- Pass errors to `next(err)` in Express; use error middleware to format responses.
- Set **timeouts** on outbound HTTP requests; don't let them hang indefinitely.
- Use **`AbortSignal`** for request-scoped cancellation.

## Logging

- Use a structured logger (`pino`, `winston`) — never `console.log` in production code.
- Log at appropriate levels: `error`, `warn`, `info`, `debug`.
- Include context in log entries: `requestId`, `userId`, `duration` where relevant.
- Never log secrets, passwords, or PII.

```typescript
import pino from 'pino';
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
logger.info({ userId }, 'User logged in');
```

## HTTP & API Design

- Use **`fastify`** or **`express`** consistently — don't mix frameworks.
- Always validate request input (body, params, query) before processing — use `zod` or `ajv`.
- Return appropriate HTTP status codes; use `4xx` for client errors, `5xx` for server errors.
- Set security headers (use `helmet` for Express, `@fastify/helmet` for Fastify).
- Implement graceful shutdown: close HTTP server, drain connections, close DB pool.

```typescript
process.on('SIGTERM', async () => {
  await server.close();
  await db.end();
  process.exit(0);
});
```

## Module & Import Rules

- Prefer **named exports** over default exports.
- Use **path aliases** (`@/`) to avoid deep relative paths.
- Use **`import type`** for type-only imports.
- Avoid circular imports — structure dependencies as a DAG.

## Security

- Sanitize all user inputs before use in queries, shell commands, or file paths.
- Use **parameterized queries** — never string-interpolate into SQL.
- Set `httpOnly`, `secure`, `sameSite` on all cookies.
- Keep dependencies up to date; run `npm audit` in CI.

## Testing

- Unit-test services and utilities in isolation with mocked dependencies.
- Integration-test HTTP routes with a test HTTP client (`supertest`, `@fastify/inject`).
- Use a separate test database or in-memory store for integration tests.
- Clean up state between tests; avoid shared mutable state.
