---
name: typescript-code-review
description: 'Perform a structured TypeScript/JavaScript code review with priority ratings: 🔴 critical bugs/security, 🟡 important type/async issues, 🟢 style suggestions.'
allowed-tools: read search codebase
model: claude-sonnet-4.6
---

Review TypeScript (or JavaScript) code for correctness, type safety, and maintainability.

## What this skill does
Provides a structured, prioritized code review. Does not modify code — outputs findings only.

## Priority ratings
- 🔴 **Critical** — runtime bugs, security vulnerabilities, unhandled rejections
- 🟡 **Important** — type safety gaps, missing error handling, performance issues
- 🟢 **Suggestion** — style, naming, minor refactors

## Review checklist

### Type safety
- No `any` — use `unknown` and narrow types with guards
- Strict mode enabled in `tsconfig.json` (`strict: true`)
- Non-null assertions (`!`) only where null is truly impossible and documented
- Prefer `interface` for object shapes that may be extended; `type` for unions/intersections

### Async / error handling
- All Promises `await`-ed or explicitly returned — no floating Promises
- `async` functions must have `try/catch` or propagate errors to callers
- No `console.error` as the only error handling — errors must surface

### Security
- No `eval()` or `new Function()` on untrusted input
- Input validation before use in queries, file paths, or shell commands
- No secrets in source code

### Node.js patterns
- Use `import` (ESM) over `require` in new code
- Use `path.join` / `path.resolve` — never string concatenation for file paths

### Testing (vitest / Jest)
- Tests are isolated — no shared mutable state
- Mocks reset between tests (`beforeEach(() => vi.clearAllMocks())`)
- Assertions specific — not just `expect(x).toBeTruthy()`

## Output format
Group by file. Priority emoji, location, explanation, suggested fix.

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
