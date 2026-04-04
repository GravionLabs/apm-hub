---
description: 'NgRx Signal Store conventions for Angular applications'
applyTo: '**/*.ts'
---

# NgRx Signal Store Instructions

Guidelines for using `@ngrx/signals` (`signalStore`) for state management in Angular 21 applications.

## Core API

```typescript
import { signalStore, withState, withComputed, withMethods, withHooks, patchState } from '@ngrx/signals';
import { computed } from '@angular/core';

export const FeatureStore = signalStore(
  { providedIn: 'root' },
  withState<FeatureState>(initialState),
  withComputed((store) => ({
    derivedValue: computed(() => store.someValue()),
  })),
  withMethods((store) => ({
    updateValue(value: string): void {
      patchState(store, { someValue: value });
    },
  })),
  withHooks({
    onInit(store) {
      // runs when store is first injected
    },
    onDestroy(store) {
      // cleanup
    },
  }),
);
```

## State Shape

- Define state as a TypeScript interface in a separate `*.models.ts` file
- Keep state flat — avoid deeply nested objects
- Use `undefined` not `null` for optional state fields
- Export `initialState` as a typed constant

```typescript
// feature.models.ts
export interface FeatureState {
  items: Item[];
  selectedId: string | undefined;
  isLoading: boolean;
}

export const initialFeatureState: FeatureState = {
  items: [],
  selectedId: undefined,
  isLoading: false,
};
```

## Naming Conventions

- Store name: `PascalCase` + `Store` suffix (e.g., `LayoutStore`, `UserStore`)
- State interface: `PascalCase` + `State` suffix (e.g., `LayoutState`)
- Always use `providedIn: 'root'` unless the store is feature-scoped
- Export the store type alongside the value for typing

## Computed Signals

- Use `withComputed` for all derived state — never recompute in templates
- Computed signals update automatically when their dependencies change
- Name computed signals as descriptive adjectives/nouns (`isDesktop`, `activeItems`)

## Methods

- Use `withMethods` for all state mutations
- Call `patchState(store, partial)` — never mutate state directly
- Methods can be async (`async loadData() { ... }`)
- Return `void` from mutation methods; return values only from queries

## Injecting the Store

```typescript
export class MyComponent {
  private store = inject(FeatureStore);

  // Access signals directly
  items = this.store.items;
  isLoading = this.store.isLoading;

  loadItems() {
    this.store.loadItems();
  }
}
```

## Anti-patterns to Avoid

- ❌ Do not use `BehaviorSubject` or `Subject` for shared state — use Signal Store
- ❌ Do not mutate state outside `patchState`
- ❌ Do not use `LayoutService` if a `LayoutStore` exists — always prefer the store
- ❌ Do not create stores without `providedIn` unless intentionally feature-scoped
- ❌ Do not duplicate computed logic in components that exists in the store
