---
name: ts-test
description: >
  TypeScript/Node.js test rules using Vitest. Covers test runner config,
  file naming, mocking patterns, coverage, and test-writing methodology.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
compatibility: opencode, github-copilot
---

## Prerequisites

- Node.js v18+, pnpm installed
- Project root with `vitest.config.ts`

## Workflow A — Test Runner

- **Framework**: Vitest (`globals: true`, `environment: node`)
- **Config**: `vitest.config.ts` at project root
- **Run all**: `pnpm test`
- **Run single file**: `npx vitest run <path>`

### File Naming

- Test files: `*.test.ts` (co-located with source)
- E2E / integration: `*.e2e.test.ts` or `*.int.test.ts`

### Coverage

```powershell
pnpm test:ci
```

- Uses `@vitest/coverage-v8`
- Output: `coverage/` directory
- CI publishes `cobertura-coverage.xml`

### Mocking

- Function-level: `vi.fn()`
- Module-level: `vi.mock("module-path")`
- Avoid module-level mocks when inline mocking suffices

## Workflow B — Writing Tests

1. Read target code — understand structure, dependencies, existing test patterns
2. Identify test cases — happy path, boundary values, error handling, null/empty inputs
3. Write tests using Vitest with `describe`/`it` blocks
4. Use mocking frameworks already in project (`vi.fn()`, `vi.mock()`)
5. Follow project naming conventions

### Reference files
- Load `references/test-cases.md` for test case identification patterns and conventions

## Gotchas

- Tests must be hermetic — no network calls, no shared state
- Use `vi.useFakeTimers()` for timer-dependent code
- Coverage threshold may be enforced in CI
- One test file per source module
- Keep tests independent and deterministic
- No debug code or `console.log` in committed tests
