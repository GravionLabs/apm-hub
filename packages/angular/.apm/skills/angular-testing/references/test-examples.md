# Angular Test Examples

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
