---
mode: agent
name: angular-testing
description: 'Generate Angular 21 unit tests using Vitest and TestBed for components, services, and signals'
tools: ['editFiles', 'codebase', 'runCommands']
---

# Generate Angular Unit Tests

Write unit tests for Angular 21 code using **Vitest** as the test runner and Angular **TestBed** for component/service wiring.

## Step 1 — Identify what to test

Ask the user if not clear:
- Which file(s) to write tests for? (component, service, store, pipe, directive)
- Any specific scenarios to cover?
- Are there existing tests to extend, or starting from scratch?

## Step 2 — Analyse the source file

Read the target file and identify:
- Public inputs, outputs, and signals
- Injected services or dependencies
- Observable subscriptions and async patterns
- Component template bindings to verify

## Step 3 — Set up the test file

Create `<name>.spec.ts` alongside the source file:

```typescript
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MyComponent } from './my.component';

describe('MyComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MyComponent],           // standalone component
      providers: [
        // replace real services with mocks
      ],
    });
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MyComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
```

## Step 4 — Mock dependencies

For each injected service, create a typed mock:

```typescript
const mockUserService = {
  getUser: vi.fn().mockResolvedValue({ id: 1, name: 'Test' }),
  currentUser: signal(null),
};

TestBed.configureTestingModule({
  providers: [{ provide: UserService, useValue: mockUserService }],
});
```

## Step 5 — Write test cases

### Signal inputs and state
```typescript
it('updates doubled signal when count changes', () => {
  const fixture = TestBed.createComponent(CounterComponent);
  fixture.componentInstance.count.set(5);
  TestBed.flushEffects();       // flush any effects
  fixture.detectChanges();
  expect(fixture.componentInstance.doubled()).toBe(10);
});
```

### Template output
```typescript
it('displays the title', () => {
  const fixture = TestBed.createComponent(TitleComponent);
  fixture.componentRef.setInput('title', 'Hello');
  fixture.detectChanges();
  const h1 = fixture.debugElement.query(By.css('h1'));
  expect(h1.nativeElement.textContent).toContain('Hello');
});
```

### Observable / async (with fakeAsync)
```typescript
it('loads data on init', fakeAsync(() => {
  const fixture = TestBed.createComponent(DataComponent);
  fixture.detectChanges();
  tick();                        // advance timers / flush microtasks
  fixture.detectChanges();
  expect(fixture.componentInstance.items().length).toBeGreaterThan(0);
}));
```

### Event handling
```typescript
it('calls onSave when button is clicked', () => {
  const fixture = TestBed.createComponent(FormComponent);
  fixture.detectChanges();
  const spy = vi.spyOn(fixture.componentInstance, 'onSave');
  const btn = fixture.debugElement.query(By.css('[data-testid="save-btn"]'));
  btn.nativeElement.click();
  expect(spy).toHaveBeenCalledOnce();
});
```

## Step 6 — Run the tests

```bash
npx vitest run          # run once
npx vitest              # watch mode
ng test --watch=false   # via Angular CLI
```

Verify all tests pass. Fix any failures before proceeding.
