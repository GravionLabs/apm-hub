---
name: angular-signal-store
description: 'Create an NgRx Signal Store with state, computed signals, methods, and hooks'
allowed-tools: editFiles codebase runCommands
---

# Create NgRx Signal Store

Scaffold a new NgRx Signal Store (`@ngrx/signals`) for managing shared state in an Angular application.

## Step 1 — Gather information

Ask the user for:

- **Feature name** (e.g., `user`, `product`, `layout`): used for store and state naming
- **State fields**: what properties does the state hold? (types and default values)
- **Scope**: `providedIn: 'root'` (global) or feature-scoped?
- **Async operations needed?** (e.g., loading data from an API)

## Step 2 — Create `<feature>.models.ts`

```typescript
export interface <Feature>State {
  items: <Item>[];
  selectedId: string | undefined;
  isLoading: boolean;
  error: string | undefined;
}

export const initial<Feature>State: <Feature>State = {
  items: [],
  selectedId: undefined,
  isLoading: false,
  error: undefined,
};
```

## Step 3 — Create `<feature>.store.ts`

```typescript
import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks, patchState } from '@ngrx/signals';
import { <Feature>State, initial<Feature>State } from './<feature>.models';

export const <Feature>Store = signalStore(
  { providedIn: 'root' },
  withState<<Feature>State>(initial<Feature>State),

  withComputed((store) => ({
    selectedItem: computed(() =>
      store.items().find((item) => item.id === store.selectedId()),
    ),
    hasItems: computed(() => store.items().length > 0),
  })),

  withMethods((store) => ({
    select(id: string): void {
      patchState(store, { selectedId: id });
    },
    clearSelection(): void {
      patchState(store, { selectedId: undefined });
    },
    setLoading(isLoading: boolean): void {
      patchState(store, { isLoading });
    },
    setItems(items: <Item>[]): void {
      patchState(store, { items });
    },
  })),

  withHooks({
    onInit(store) {
      // Optional: load initial data
    },
  }),
);
```

## Step 4 — Use in a component

```typescript
import { Component, inject } from '@angular/core';
import { <Feature>Store } from './<feature>.store';

export class <Feature>List {
  private store = inject(<Feature>Store);

  // Access state signals directly
  items = this.store.items;
  isLoading = this.store.isLoading;
  selectedItem = this.store.selectedItem; // computed

  select(id: string) {
    this.store.select(id);
  }
}
```

Template:

```html
@if (isLoading()) {
  <p-progress-spinner />
} @else {
  @for (item of items(); track item.id) {
    <div (click)="select(item.id)">{{ item.name }}</div>
  }
}
```

## Async Example (HTTP)

For loading data from an API, add a method using `rxMethod` or plain async:

```typescript
withMethods((store, http = inject(HttpClient)) => ({
  async loadItems(): Promise<void> {
    patchState(store, { isLoading: true, error: undefined });
    try {
      const items = await firstValueFrom(http.get<Item[]>('/api/items'));
      patchState(store, { items, isLoading: false });
    } catch (err) {
      patchState(store, { isLoading: false, error: String(err) });
    }
  },
})),
```

## Naming Conventions

| Part | Convention | Example |
|------|-----------|---------|
| Store | `PascalCase + Store` | `UserStore` |
| State interface | `PascalCase + State` | `UserState` |
| Initial state | `initial + PascalCase + State` | `initialUserState` |
| Models file | `<feature>.models.ts` | `user.models.ts` |
| Store file | `<feature>.store.ts` | `user.store.ts` |
