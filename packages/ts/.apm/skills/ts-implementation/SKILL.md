---
name: ts-implementation
description: >
  TypeScript-specific implementation and test rules. Extends the parent
  `implementation` skill with TS/Vitest conventions. Auto-loaded when
  `implementation` skill dispatches to <lang>-implementation.
---

## Framework

- **Test runner**: Vitest (`globals: true`, `environment: node`)
- **Config**: `vitest.config.ts` at project root
- **Format/Lint**: Biome

## Imports

- ES modules only — `import` not `require`
- Relative paths with `.js` extension: `import { foo } from "../foo.js"`

## Conventions

- Types: never `any`. Use explicit interfaces or type aliases.
- Async: `async/await` only, no raw `.then()`.
- Mocking: function-level via `vi.fn()`. Module-level mocks only when unavoidable.
- File naming: `kebab-case.ts`, test files: `kebab-case.test.ts`.

## Test Examples

### Service test

```ts
import { describe, it, expect } from "vitest";

describe("source-service", () => {
  it("creates a source and returns it", async () => { ... });
  it("rejects duplicate URL", async () => { ... });
  it("returns null for non-existent id", async () => { ... });
});
```

### Route test

```ts
import { describe, it, expect } from "vitest";

describe("GET /api/sources/:id", () => {
  it("returns 200 for existing source", async () => { ... });
  it("returns 404 for non-existing source", async () => { ... });
});
```

## Related Skills

- **Test**: Load `ts-test` for test runner config, naming, and coverage details
