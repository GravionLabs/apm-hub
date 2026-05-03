# Testing with Jest (Legacy)

**Jest was the default test runner before Vitest became standard in Angular v21+.** Use Jest for:
- Legacy Angular projects (v20 and earlier)
- Projects already configured with Jest
- Teams with existing Jest infrastructure

**For new projects, use [testing-vitest.md](testing-vitest.md) instead.**

## Setup

### Existing projects (Karma → Jest)

```powershell
# Install Jest dependencies
npm install --save-dev jest @types/jest jest-preset-angular

# Create jest.config.js
@'
export default {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/'
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/'
  ],
};
'@ | Set-Content -Path jest.config.js

# Create setup-jest.ts
"import 'jest-preset-angular/setup-jest';" | Set-Content -Path setup-jest.ts

# Update package.json
npm set-script test "jest"
npm set-script test:watch "jest --watch"
npm set-script test:coverage "jest --coverage"
```

## Writing Tests (Jest)

### Component test

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyComponent } from './my.component';

describe('MyComponent', () => {
  let component: MyComponent;
  let fixture: ComponentFixture<MyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MyComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render title', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('h1').textContent).toContain('Welcome');
  });
});
```

### Service test

```typescript
import { TestBed } from '@angular/core/testing';
import { DataService } from './data.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

describe('DataService', () => {
  let service: DataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DataService],
    });
    service = TestBed.inject(DataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch data', () => {
    const mockData = [{ id: 1, name: 'Test' }];

    service.getItems().subscribe(data => {
      expect(data).toEqual(mockData);
    });

    const req = httpMock.expectOne('/api/items');
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
  });
});
```

### Testing with Jest matchers

```typescript
describe('My Tests', () => {
  // Basic matchers
  expect(true).toBe(true);
  expect(value).toEqual(expectedValue);
  expect(value).toStrictEqual(expectedValue); // strict equality
  expect(value).toBeTruthy();
  expect(value).toBeFalsy();
  expect(value).toBeNull();
  expect(value).toBeUndefined();
  expect(value).toBeDefined();

  // String matchers
  expect(str).toContain('substring');
  expect(str).toMatch(/regex/);

  // Array/Object matchers
  expect(arr).toContain(item);
  expect(obj).toHaveProperty('key');
  expect(obj).toEqual({ key: 'value' });

  // Exception matchers
  expect(() => throwingFunction()).toThrow();
  expect(() => throwingFunction()).toThrow(Error);
  expect(() => throwingFunction()).toThrow('error message');

  // Promise matchers
  return expect(Promise.resolve()).resolves.toBeTruthy();
  return expect(Promise.reject()).rejects.toBeTruthy();
});
```

### Mocking with Jest

```typescript
// Mock a module
jest.mock('./data.service');

// Mock a function
const mockFn = jest.fn();
const mockFn = jest.fn().mockReturnValue('value');
const mockFn = jest.fn().mockResolvedValue({ data: 'value' });

// Spy on methods
const spy = jest.spyOn(object, 'method');
expect(spy).toHaveBeenCalled();
expect(spy).toHaveBeenCalledWith(arg1, arg2);
expect(spy).toHaveBeenCalledTimes(2);

// Clear mocks
jest.clearAllMocks();
spy.mockRestore();
```

### Async testing with Jest

```typescript
// Using async/await
it('should load data', async () => {
  const data = await service.loadData();
  expect(data).toBeDefined();
});

// Using done callback
it('should emit', (done) => {
  service.data$.subscribe(data => {
    expect(data).toBeTruthy();
    done();
  });
});

// Using fakeTimers
jest.useFakeTimers();
it('should trigger after delay', () => {
  jest.advanceTimersByTime(1000);
  expect(component.data).toBeDefined();
});
jest.useRealTimers();
```

## Running Tests (Jest)

```powershell
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- my.component.spec.ts

# Run with coverage
npm run test:coverage

# Update snapshots
npm test -- -u
```

## Common Patterns

### Spying on component methods

```typescript
it('should call onSubmit', () => {
  const spy = jest.spyOn(component, 'onSubmit');
  fixture.nativeElement.querySelector('button').click();
  expect(spy).toHaveBeenCalled();
});
```

### Mocking HTTP requests

```typescript
it('should handle errors', () => {
  service.getItems().subscribe(
    () => fail('should have failed'),
    (error) => {
      expect(error).toBeTruthy();
    }
  );

  const req = httpMock.expectOne('/api/items');
  req.error(new ErrorEvent('Network error'));
});
```

### Setting up shared test utilities

```typescript
// shared-test-utils.ts
export function createMockDataService(): DataService {
  return {
    getItems: jest.fn().mockResolvedValue([]),
    updateItem: jest.fn().mockResolvedValue({}),
  } as any;
}

// In test
const mockService = createMockDataService();
TestBed.configureTestingModule({
  providers: [{ provide: DataService, useValue: mockService }],
});
```

## Differences from Vitest

| Feature | Vitest | Jest |
|---------|--------|------|
| **Speed** | Faster (ESM native) | Slower (CommonJS) |
| **Setup** | `@analogjs/vite-plugin-angular` | `jest-preset-angular` |
| **Recommended for** | New projects (v21+) | Legacy projects (v20-) |
| **Runner** | Vite | Jest CLI |
| **API** | `vi.*` | `jest.*` |

---

See also: [testing-vitest.md](testing-vitest.md) for modern setup, [testing-fundamentals.md](testing-fundamentals.md) for TestBed basics.
