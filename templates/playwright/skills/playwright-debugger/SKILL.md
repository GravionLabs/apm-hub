---
name: playwright-debugger
description: >
  Use this skill to debug Playwright tests using the Playwright CLI. This includes analyzing
  failing tests, inspecting traces, viewing reports, replaying test runs, extracting selectors,
  and diagnosing flaky behavior. This skill is language-agnostic and works for TypeScript,
  .NET, and Python Playwright projects.

allowed-tools:
  - read
  - search
  - codebase
  - execute
  - runCommands

license: MIT
---

## Overview

This skill focuses on debugging Playwright tests using the Playwright CLI. It does not generate
test code; it inspects failures, traces, reports, logs, and selectors. The CLI is preferred because
it stores snapshots on disk, avoids large LLM context payloads, and provides deterministic debugging tools.

## When to Use This Skill

Trigger this skill when the user asks to:
- debug a failing Playwright test
- analyze a trace (`trace.zip`)
- open a Playwright HTML report
- replay a test step-by-step
- inspect selectors or locator failures
- diagnose flaky tests
- understand timeouts or navigation issues
- debug authentication flows
- inspect network logs
- view console logs or errors
- analyze slow tests or performance issues

## Debugging Tools (CLI)

Always use the Playwright CLI for debugging:

- View trace:
  - `npx playwright show-trace trace.zip`

- View HTML report:
  - `npx playwright show-report`

- Debug mode:
  - `npx playwright test --debug`

- Run a single test:
  - `npx playwright test path/to/test.spec.ts`

- Run with tracing enabled:
  - `npx playwright test --trace=on`

- Run with video:
  - `npx playwright test --video=on`

- Run with slow motion:
  - `npx playwright test --headed --slow-mo=500`

## Decision Flow

1. **Detect project language**
   - TypeScript → look for `@playwright/test` in package.json
   - .NET → look for `Microsoft.Playwright` in .csproj
   - Python → look for `playwright` in requirements.txt

2. **Locate test artifacts**
   - Look for `playwright-report/`
   - Look for `test-results/`
   - Look for `trace.zip`

3. **If a trace exists → analyze trace**
   - Use CLI to open it
   - Extract failing step
   - Extract locator information
   - Extract console/network logs

4. **If no trace exists → instruct user to re-run with tracing**
   - `npx playwright test --trace=on`

5. **If test is flaky → run in loop**
   - `npx playwright test --repeat-each=10`

6. **If selectors fail → use codegen**
   - `npx playwright codegen URL`

7. **If navigation fails → inspect network logs**
   - Use trace viewer network tab

## Debugging Rules

### Selector Failures
- Prefer role-based selectors (`getByRole`)
- Avoid CSS selectors for dynamic Angular components
- Use `getByTestId` for stable elements
- Use codegen to regenerate selectors

### Timeout Failures
- Check for missing awaits
- Check for animations or transitions
- Use `expect(locator).toBeVisible()` instead of manual waits
- Increase timeout only if necessary

### Navigation Failures
- Check redirects in trace viewer
- Check network errors
- Ensure login flows are stable

### Flaky Tests
- Use `--repeat-each`
- Use `--retries`
- Avoid relying on timing
- Use deterministic selectors

### Authentication Issues
- Use storage state (`--save-storage`)
- Avoid logging in inside every test
- Use fixtures for login

## Best Practices

- Always inspect the trace before modifying test code
- Use the CLI trace viewer instead of reading logs manually
- Keep tests idempotent and deterministic
- Avoid global state between tests
- Use environment variables for credentials
- Use `page.pause()` only during debugging

## Gotchas

- Do not debug using the MCP server — always use the CLI
- Do not rely on CSS selectors for Angular Material
- Do not use `waitForTimeout` unless absolutely necessary
- Do not store browser contexts globally
- Do not mix headed and headless modes in CI
