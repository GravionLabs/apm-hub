---
name: angular-testing
description: 'Write Angular 21 unit tests using Vitest and TestBed. Covers standalone component testing, signal testing, service mocking, and async patterns.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: claude-sonnet-4.6
---

Write Angular 21 unit tests with Vitest and TestBed.

## Stack
- **Test runner:** Vitest (`@analogjs/vite-plugin-angular` or Angular CLI with Vitest builder)
- **TestBed:** `TestBed.configureTestingModule()` for component/service wiring
- **Signals:** test with `TestBed.flushEffects()` after state changes

## Component test structure

```typescript
import { TestBed } from '@angular/core/testing';
import { MyComponent } from './my.component';

describe('MyComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [MyComponent],
  }));

  it('renders', () => {
    const fixture = TestBed.createComponent(MyComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement).toBeTruthy();
  });
});
```

## Testing signals

```typescript
it('updates computed signal', () => {
  const fixture = TestBed.createComponent(MyComponent);
  fixture.componentInstance.count.set(5);
  TestBed.flushEffects();
  fixture.detectChanges();
  expect(fixture.componentInstance.doubled()).toBe(10);
});
```

## Mocking services

```typescript
const mockService = { getData: vi.fn().mockResolvedValue([]) };
TestBed.configureTestingModule({
  providers: [{ provide: DataService, useValue: mockService }],
});
```

## Key rules
- One `describe` per component/service
- Use `fixture.debugElement.query(By.css(...))` for DOM queries
- Call `fixture.detectChanges()` after state changes
- Use `fakeAsync` + `tick()` for Observable/timer-based async
