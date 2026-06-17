---
name: ng-testing
description: 'Write Angular 21 unit tests using Vitest and TestBed. Covers standalone component testing, signal testing, service mocking, and async patterns.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
compatibility: opencode, github-copilot
---

Write Angular 21 unit tests with Vitest and TestBed.

## Stack
- **Test runner:** Vitest (`@analogjs/vite-plugin-angular` or Angular CLI with Vitest builder)
- **TestBed:** `TestBed.configureTestingModule()` for component/service wiring
- **Signals:** test with `TestBed.flushEffects()` after state changes

See [test-examples.md](references/test-examples.md) for full examples.

## Key rules
- One `describe` per component/service
- Use `fixture.debugElement.query(By.css(...))` for DOM queries
- Call `fixture.detectChanges()` after state changes
- Use `fakeAsync` + `tick()` for Observable/timer-based async
