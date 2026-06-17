# Testing with Vitest (Standard)

**Vitest is the recommended test runner for new Angular projects (v21+).** It offers faster performance than Karma/Jest and integrates seamlessly with modern Angular development workflows.

## Setup

### New projects
Vitest is configured by default when using `ng new`:
```powershell
ng new my-app
# Vitest builder already configured
```

### Existing projects (migrate from Karma/Jest)
```powershell
ng add @analogjs/vite-plugin-angular
# OR for Angular CLI with Vitest builder
npm install --save-dev @angular/build @vitejs/plugin-vue vitest @vitest/ui
ng config projects.my-app.architect.test.builder @angular-devkit/build-angular:karma
# Then switch to vitest builder
```

## Writing Tests

### Component test (standalone)

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
    expect(fixture.nativeElement.textContent).toBeTruthy();
  });
});
```

### Service test

```typescript
import { TestBed } from '@angular/core/testing';
import { DataService } from './data.service';

describe('DataService', () => {
  let service: DataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DataService],
    });
    service = TestBed.inject(DataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
```

### Testing signals

```typescript
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

it('should update computed signal', () => {
  const count = signal(0);
  const doubled = computed(() => count() * 2);

  count.set(5);
  TestBed.flushEffects();

  expect(doubled()).toBe(10);
});
```

### Testing effects

```typescript
it('should track effect dependencies', () => {
  const effect = vi.fn();
  const count = signal(0);

  TestBed.runInInjectionContext(() => {
    effect(() => effect(count()));
  });

  count.set(1);
  TestBed.flushEffects();

  expect(effect).toHaveBeenCalledTimes(2); // initial + update
});
```

### Async tests with fakeAsync/tick

```typescript
import { fakeAsync, tick } from '@angular/core/testing';

it('should wait for async operations', fakeAsync(() => {
  const fixture = TestBed.createComponent(MyComponent);
  
  component.loadData(); // async operation
  tick(1000); // advance time
  fixture.detectChanges();

  expect(component.data).toBeDefined();
}));
```

### Mocking services

```typescript
const mockDataService = {
  getData: vi.fn().mockResolvedValue([{ id: 1 }]),
  update: vi.fn().mockResolvedValue({}),
};

TestBed.configureTestingModule({
  providers: [
    { provide: DataService, useValue: mockDataService },
  ],
});
```

## Running Tests

```powershell
# Run all tests
ng test

# Run tests in watch mode (default)
ng test --watch

# Run tests once (CI mode)
ng test --no-watch --browsers=ChromeHeadless

# Run specific test file
ng test --include='**/my.component.spec.ts'

# Coverage
ng test --code-coverage
```

## Best Practices

✓ **One describe per component/service** — Clear test organization
✓ **Use `fixture.detectChanges()` after state changes** — Ensures change detection
✓ **Call `TestBed.flushEffects()` for signals** — Flushes signal effects
✓ **Mock external dependencies** — Use `vi.fn()` for functions
✓ **Test behavior, not implementation** — Focus on what component does, not how
✓ **Keep tests focused** — One assertion per test when possible
✓ **Use `fakeAsync`/`tick` for async** — Simpler than Promises for timers/intervals

## Common Patterns

### Component with input/output

```typescript
import { Component, input, output } from '@angular/core';

describe('MessageComponent', () => {
  it('should emit on button click', () => {
    const fixture = TestBed.createComponent(MessageComponent);
    const emitSpy = vi.spyOn(fixture.componentInstance.send, 'emit');
    
    fixture.nativeElement.querySelector('button').click();
    
    expect(emitSpy).toHaveBeenCalled();
  });
});
```

### HTTP requests (with HttpTestingController)

```typescript
import { HttpTestingController } from '@angular/common/http/testing';

describe('DataService with HTTP', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DataService, provideHttpClient(withInterceptors([]))],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should fetch data', () => {
    const mockData = [{ id: 1, name: 'Test' }];
    const service = TestBed.inject(DataService);

    service.getItems().subscribe(data => {
      expect(data).toEqual(mockData);
    });

    const req = httpMock.expectOne('/api/items');
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
  });
});
```

---

See also: [testing-jest.md](testing-jest.md) for legacy Jest setup, [testing-fundamentals.md](testing-fundamentals.md) for TestBed basics.
