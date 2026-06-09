---
name: ng-test
description: >
  Angular test rules using Vitest and TestBed. Covers standalone component
  testing, signal testing, service mocking, and async patterns. Use this
  skill when writing or running tests in an Angular project.
allowed-tools: execute shell runCommands read search codebase
compatibility: opencode, github-copilot
---

## Prerequisites

- Project root with `angular.json` and `vitest.config.ts`
- Angular 21+ with standalone components

## Test Runner

- **Framework**: Vitest (replaces Karma/Jasmine)
- **Config**: `vitest.config.ts` at project root
- **Run all**: `pnpm test`
- **Run single**: `npx vitest run <path>`

## Component Testing

```typescript
import { render, screen } from '@testing-library/angular';
import { MyComponent } from './my.component';

describe('MyComponent', () => {
  it('renders with input', async () => {
    const { container } = await render(MyComponent, {
      componentInputs: { value: 'test' }
    });
    expect(container).toContain('test');
  });
});
```

## Signal Testing

```typescript
import { ComponentRef } from '@angular/core';
import { MyService } from './my.service';

it('updates signal on action', () => {
  const service = TestBed.inject(MyService);
  service.updateValue('new');
  expect(service.value()).toBe('new');
});
```

## Service Mocking

```typescript
TestBed.configureTestingModule({
  providers: [
    { provide: MyService, useValue: mockService }
  ]
});
```

## Gotchas

- Angular standalone components don't need `NgModule` wrapping
- Use `provideHttpClient(withFetch())` for HTTP testing
- Async operations: use `fakeAsync` + `tick()` or `waitForAsync`
- Component inputs use `componentInputs` (not `inputs`)
