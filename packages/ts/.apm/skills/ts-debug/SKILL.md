---
name: ts-debug
description: 'Diagnose and fix TypeScript type errors, module resolution issues, build failures, and runtime errors using tsc, Node.js debugger, and source maps.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase problems
compatibility: opencode, github-copilot
model: claude-sonnet-4.6
---

Diagnose TypeScript and Node.js issues: type errors, module resolution failures, build errors, runtime crashes.

## Stack
- **tsc** — TypeScript compiler for static type checking (`tsc --noEmit`)
- **ts-node** / **tsx** — run TypeScript directly during development
- **Node.js `--inspect`** — V8 debugger protocol for runtime debugging
- **Chrome DevTools** — connect to Node.js inspector via `chrome://inspect`
- **source-map-support** — map compiled JS errors back to TypeScript source lines

## Steps

### 1. Analyze TypeScript errors
- Read full error output: file, line, TS error code (e.g., `TS2345`)
- Check TypeScript version: `npx tsc --version`
- Common error codes: `TS2345` (argument type mismatch), `TS2322` (assignment mismatch), `TS2339` (property does not exist), `TS7006` (implicit `any`)

### 2. Type errors (tsc)
```bash
npx tsc --noEmit
npx tsc --noEmit --strict
```
- Use `reveal_type` equivalent: add `const _: ExpectedType = value` to check inferred types
- Add `// @ts-expect-error` with a comment to isolate a specific line; remove once fixed
- For `any` errors, replace with `unknown` and add type guard or `zod` parse

### 3. Runtime debugging (Node.js --inspect)
```bash
# Start with inspector
node --inspect dist/index.js
# or with tsx (no compile step)
node --inspect --import tsx/esm src/index.ts
```
- Open `chrome://inspect` in Chrome → click "inspect" under Remote Target
- Set breakpoints in DevTools (source maps map to `.ts` files)
- Use `debugger;` statement in source for hard breakpoint

### 4. Module resolution issues
```bash
# Check what TypeScript resolves
npx tsc --traceResolution 2>&1 | grep -A3 "your-module"
```
- Verify `"moduleResolution": "NodeNext"` and `.js` extensions in imports when using ESM
- Check `paths` aliases in `tsconfig.json` match runtime resolver
- For ESM: `"type": "module"` in `package.json`; import paths must include `.js` extension

### 5. Build / bundler errors
```bash
# Clean build
rm -rf dist && npx tsc
# Check tsconfig includes/excludes
npx tsc --showConfig
```
- Verify `outDir`, `rootDir`, `include`, and `exclude` in `tsconfig.json`
- For monorepos: check `composite: true` and project references configured

## Common Patterns

| Symptom | Tool | Action |
|---|---|---|
| `TS2345` argument type error | tsc | Check function signature; use `satisfies` or type guard |
| `TS7006` implicit `any` | tsc | Add type annotation; enable `noImplicitAny` |
| `Cannot find module` | tsc `--traceResolution` | Add `.js` ext to ESM imports; check `paths` |
| `ERR_MODULE_NOT_FOUND` at runtime | Node.js | Verify `dist/` output exists; check `outDir` |
| Stack trace points to `.js` not `.ts` | source-map-support | Install `source-map-support`; set `"sourceMap": true` in tsconfig |
| Unhandled promise rejection | Node.js `--inspect` | Add `process.on('unhandledRejection', ...)` handler; find missing `await` |
| Type is `never` unexpectedly | tsc | Check discriminated union exhaustiveness; use `assertNever` helper |

## Async Debugging
- Add `process.on('unhandledRejection', (reason) => { console.error(reason); process.exit(1); })` to surface hidden async errors
- Use `--inspect-brk` to pause on first line and step through async startup code
- For long chains, `await Promise.all([...])` errors show first rejection — use `Promise.allSettled` to see all
- Check for missing `await` with `@typescript-eslint/no-floating-promises` lint rule

## Tips
> **Use `task` tool** for diagnostic commands (`tsc --noEmit`, `--traceResolution`, `npx tsc --showConfig`) — mechanical inspection steps.
