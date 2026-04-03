---
agent: agent
description: 'Review TypeScript code for type safety, strict mode compliance, idiomatic patterns, and Node.js best practices'
---

# TypeScript Code Review

Review the provided TypeScript code for correctness, type safety, maintainability, and security. Follow the project's TypeScript and Node.js conventions.

## Review Focus

### 1. Type Safety
- **Strict mode:** Verify `"strict": true` is in `tsconfig.json`; flag any `any` types or unsafe casts (`as`).
- **Return types:** Exported functions and class methods must have explicit return types.
- **`unknown` over `any`:** Flag uses of `any`; suggest `unknown` + type guard or `zod` parsing.
- **Type assertions:** Flag `as X` assertions; recommend proper type guards (`instanceof`, `typeof`, custom predicates).
- **Nullability:** Check for missing null/undefined checks on potentially nullable values.

### 2. TypeScript Idioms
- **`enum` usage:** Flag `enum` — recommend `as const` objects or union types.
- **Default exports:** Flag default exports; recommend named exports.
- **`import type`:** Flag type-only imports missing the `type` keyword.
- **Discriminated unions:** Recommend over class hierarchies for sum types where appropriate.
- **`satisfies` operator:** Suggest where typed literals are used without narrowing.

### 3. Async & Error Handling
- **Unhandled promises:** Flag fire-and-forget patterns without explicit error handling.
- **Error types:** Flag raw string throws — all throws must use `Error` instances.
- **Error chaining:** Flag missing `{ cause }` in error wrapping.
- **Silent catches:** Flag empty `catch` blocks or catches that don't log/rethrow.
- **AbortSignal:** Suggest for long-running async operations that should be cancellable.

### 4. Node.js Conventions
- **Environment variables:** Flag `process.env.X` access without validation — must use `zod` or equivalent at startup.
- **Secrets:** Flag any hardcoded credentials, tokens, API keys, or URLs.
- **Logging:** Flag `console.log` in non-test code — must use a structured logger (`pino`, `winston`).
- **Graceful shutdown:** Flag HTTP servers that don't handle `SIGTERM`/`SIGINT`.
- **SQL injection:** Flag string-interpolated queries — must use parameterized queries.

### 5. Code Quality
- **Naming:** `camelCase` for variables/functions, `PascalCase` for types/classes/interfaces.
- **Barrel files:** Flag deep barrel re-exports that may cause circular dependencies.
- **Unused code:** Flag unused imports, variables, and parameters (should use `_` prefix if intentional).
- **Complexity:** Flag functions over ~30 lines or with deeply nested logic.
- **Comments:** Flag comments that describe *what* the code does — only *why* comments belong.

### 6. Testing
- **Coverage:** Are public functions and error paths tested?
- **Mocking:** Are external dependencies properly mocked? Is code under test ever mocked?
- **Test naming:** Do test names clearly describe the behavior being tested?

## Response Format

Return a prioritized, actionable checklist. For each issue:
1. **File & line:** Where is the issue?
2. **Description:** What is the issue?
3. **Rule:** Which TypeScript/Node.js rule is violated?
4. **Recommendation:** How to fix it (with code example if helpful).
5. **Severity:** 🔴 High / 🟡 Medium / 🟢 Low

Code to review:
${input:code:Paste the TypeScript code or diff to review}
