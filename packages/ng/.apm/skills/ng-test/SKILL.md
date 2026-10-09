---
name: ng-test
description: >
  Angular test rules using Vitest and TestBed. Covers standalone component
  testing, signal testing, service mocking, and async patterns. Use this
  skill when writing or running tests in an Angular project.
---

## Prerequisites

- Project root with `angular.json` and `vitest.config.ts`
- Angular 21+ with standalone components

## Test Runner

- **Framework**: Vitest (replaces Karma/Jasmine)
- **Config**: `vitest.config.ts` at project root
- **Run all**: `<pm> test` (package manager from `detect-techstack`)
- **Run single**: `npx vitest run <path>`

## Component Testing

```typescript
import { TestBed } from '@angular/core/testing';
import { MyComponent } from './my.component';

describe('MyComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [MyComponent] }));

  it('renders with input', () => {
    const fixture = TestBed.createComponent(MyComponent);
    fixture.componentRef.setInput('value', 'test');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('test');
  });
});
```

## Signal Testing

```typescript
import { TestBed } from '@angular/core/testing';
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

## TestBed rules

- `TestBed.configureTestingModule()` for component/service wiring; one `describe` per component/service
- Use `fixture.debugElement.query(By.css(...))` for DOM queries
- Call `fixture.detectChanges()` after state changes; `TestBed.flushEffects()` when testing signal effects

See [test-examples.md](references/test-examples.md) for full TestBed examples.

## Gotchas

- Angular standalone components don't need `NgModule` wrapping
- Use `provideHttpClient(withFetch())` for HTTP testing
- Async operations: use `fakeAsync` + `tick()` or `waitForAsync`
- Set signal inputs with `fixture.componentRef.setInput('name', value)`
