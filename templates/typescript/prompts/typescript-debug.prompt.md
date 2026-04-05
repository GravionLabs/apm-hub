---
mode: ask
description: 'Diagnose and fix TypeScript type errors, module resolution issues, build failures, and runtime errors'
---

Diagnose and fix the TypeScript issue I'm facing.

## Context

Describe what you're seeing:
- The error message or unexpected behavior
- Which command is failing (`tsc`, `node`, `tsx`, build tool, test runner)
- The TypeScript and Node.js versions (`npx tsc --version`, `node --version`)

## What to check

1. **Type errors** — run `npx tsc --noEmit` and share the full output
2. **Module resolution** — if you see `Cannot find module`, check that:
   - ESM imports include `.js` extension
   - `"moduleResolution": "NodeNext"` is set in `tsconfig.json`
   - `"type": "module"` is in `package.json`
3. **Runtime errors** — share the stack trace; note whether source maps are enabled (`"sourceMap": true` in tsconfig)
4. **Build errors** — share the `tsconfig.json` and the full compiler output

## What I want

A clear explanation of the root cause and the minimal fix needed, with corrected code snippets.
