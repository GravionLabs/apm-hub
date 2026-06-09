---
name: ts-test
description: >
  TypeScript/Node.js test rules using Vitest. Covers test runner config,
  file naming, mocking patterns, and coverage. Use this skill when writing
  or running tests in a TypeScript project.
allowed-tools: execute shell runCommands read search codebase
compatibility: opencode, github-copilot
---

## Prerequisites

- Node.js v18+, a package manager (pnpm, npm, yarn)
- Project root with `vitest.config.ts`

## Test Runner

- **Framework**: Vitest (`globals: true`, `environment: node`)
- **Config**: `vitest.config.ts` at project root
- **Run all**: `$packageManager test`
- **Run single file**: `npx vitest run <path>`

## File Naming

- Test files: `*.test.ts` (co-located with source)
- E2E / integration: `*.e2e.test.ts` or `*.int.test.ts`

## Coverage

```powershell
$packageManager test:ci
```

- Uses `@vitest/coverage-v8`
- Output: `coverage/` directory
- CI publishes `cobertura-coverage.xml`

## Mocking

- Function-level: `vi.fn()`
- Module-level: `vi.mock("module-path")`
- Avoid module-level mocks when inline mocking suffices

## Gotchas

- Tests must be hermetic — no network calls, no shared state
- Use `vi.useFakeTimers()` for timer-dependent code
- Coverage threshold may be enforced in CI
