---
name: ng-implementation
description: >
  Angular-specific implementation and test rules. Extends the parent
  `implementation` skill with Angular 21+ conventions. Auto-loaded when
  `implementation` skill dispatches to <lang>-implementation.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
compatibility: opencode, github-copilot
model: gpt-4.1
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

## Test Examples

### Component test

```typescript
import { render, screen } from "@testing-library/angular";
import { MyComponent } from "./my.component";

describe("MyComponent", () => {
  it("renders with input", async () => {
    const { container } = await render(MyComponent, {
      componentInputs: { value: "hello" },
    });
    expect(container.textContent).toContain("hello");
  });

  it("emits event on click", async () => {
    const emitted = vi.fn();
    await render(MyComponent, {
      componentOutputs: { save: emitted },
    });
    screen.getByText("Save").click();
    expect(emitted).toHaveBeenCalled();
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

### Route guard test

```typescript
import { TestBed } from "@angular/core/testing";
import { AuthGuard } from "./auth.guard";

describe("AuthGuard", () => {
  it("allows when authenticated", () => {
    const guard = TestBed.inject(AuthGuard);
    const result = guard.canActivate();
    expect(result).toBe(true);
  });
});
```

## Related Skills

- **Test**: Load `ng-test` for TestBed config and async testing patterns
- **AG Grid**: Load `ng-ag-grid-developer` for grid-specific implementation
