---
name: ng-implementation
description: >
  Angular-specific implementation and test rules. Extends the parent
  `implementation` skill with Angular 21+ conventions. Auto-loaded when
  `implementation` skill dispatches to `ng-implementation`.
---

## Framework

- **Test runner**: Vitest (replaces Karma/Jasmine)
- **Config**: `vitest.config.ts` at project root
- **Components**: standalone only, no NgModules
- **CLI**: Angular CLI for generators (`ng generate`)

## Imports

- Angular core APIs from `@angular/core`
- Signals: `import { signal, computed, effect, input, output } from "@angular/core"`
- Forms: `import { FormControl, FormGroup } from "@angular/forms"`
- Router: `import { Router, ActivatedRoute } from "@angular/router"`
- HTTP: `import { HttpClient } from "@angular/common/http"`

## Conventions

- Components: standalone with `imports` array, `OnPush` change detection
- Signals over `BehaviorSubject`/`Observable` for state
- `input()` and `output()` for component props/events (no `@Input`/`@Output`)
- `effect()` for side effects, `computed()` for derived values
- File naming: `kebab-case.component.ts`, `kebab-case.service.ts`
- Templates: `@if`/`@for`/`@switch` control flow (not `*ngIf`/`*ngFor`)
- Upgrades: one major at a time with `ng update`; run `ng generate @angular/core:control-flow` to migrate legacy templates

## Test Examples

### Component test

```typescript
import { TestBed } from "@angular/core/testing";
import { MyComponent } from "./my.component";

describe("MyComponent", () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [MyComponent] }));

  it("renders with input", () => {
    const fixture = TestBed.createComponent(MyComponent);
    fixture.componentRef.setInput("value", "hello");
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("hello");
  });

  it("emits event on click", () => {
    const fixture = TestBed.createComponent(MyComponent);
    const saved = vi.fn();
    fixture.componentInstance.save.subscribe(saved);
    fixture.detectChanges();
    fixture.nativeElement.querySelector("button").click();
    expect(saved).toHaveBeenCalled();
  });
});
```

### Service test

```typescript
import { TestBed } from "@angular/core/testing";
import { MyService } from "./my.service";

describe("MyService", () => {
  it("updates signal on action", () => {
    const service = TestBed.inject(MyService);
    service.updateValue("new");
    expect(service.value()).toBe("new");
  });
});
```

## Review rules

- `ChangeDetectionStrategy.OnPush`; signals for state, `computed()` for derived values
- `effect()` only for side effects, never for state updates
- `@if`/`@for` (with `track`)/`@switch` — not `*ngIf`/`*ngFor`
- `input()`/`output()` — not `@Input`/`@Output`
- Subscriptions cleaned up via `DestroyRef` / `takeUntilDestroyed`
- No complex template expressions; ARIA labels and `alt` text on interactive elements and images

## Related Skills

- **Test**: Load `ng-test` for TestBed config and async testing patterns
- **AG Grid**: Load `ng-ag-grid-developer` for grid-specific implementation
