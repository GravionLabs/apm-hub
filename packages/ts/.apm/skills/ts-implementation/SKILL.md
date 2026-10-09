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
- **Format/Lint**: ESLint (flat config) + Prettier — see `setup-prettier-eslint-husky`
- **Runtime**: Node.js 22 LTS

## Imports

- ES modules only — `import` not `require`
- Relative paths with `.js` extension: `import { foo } from "../foo.js"`

## Conventions

- Types: never `any`. Use explicit interfaces or type aliases.
- Async: `async/await` only, no raw `.then()`.
- Mocking: function-level via `vi.fn()`. Module-level mocks only when unavoidable.
- File naming: `kebab-case.ts`, test files: `kebab-case.test.ts`.

## Tests

Runner config, naming, mocking and coverage live in `ts-test` (Vitest, `describe`/`it`, `vi.fn()`).

## Review rules

- No `any` — use `unknown` and narrow; `strict: true` in `tsconfig.json`
- No floating promises; async functions propagate or handle errors
- ESM `import` only; `path.join`/`path.resolve` for file paths
- No `eval()`/`new Function()`; validate input before queries, paths, shell commands
- Tests isolated; mocks reset in `beforeEach` (`vi.clearAllMocks()`)
- Assertions specific — not just `toBeTruthy()`
