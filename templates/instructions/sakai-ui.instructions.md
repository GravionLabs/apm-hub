---
description: 'Coding standards for @gravion/sakai-ui Angular library development'
applyTo: 'projects/sakai-ui/**/*.ts, projects/sakai-ui/**/*.html, projects/sakai-ui/**/*.scss'
---

# @gravion/sakai-ui Library Instructions

Conventions for developing components, stores, and tokens inside the `@gravion/sakai-ui` Angular library.

## Workspace Structure

```
projects/sakai-ui/src/lib/
├── layout/
│   ├── components/          # Layout components (GvAppLayout, GvTopbar, etc.)
│   │   └── <name>/
│   │       ├── <name>.ts    # Component class
│   │       ├── <name>.html  # Template
│   │       └── <name>.scss  # Styles
│   ├── store/               # NgRx Signal Store (LayoutStore, models)
│   └── menu-model.token.ts  # GV_MENU_MODEL injection token
└── pages/
    ├── auth/                # GvLogin, GvError, GvAccess
    ├── landing/             # GvLanding + widgets
    ├── notfound/            # GvNotFound
    └── empty/               # GvEmpty
```

## Naming Conventions

- **Selector prefix:** all library component selectors use `gv-` (e.g., `gv-topbar`, `gv-sidebar`)
- **Class prefix:** all library classes use `Gv` (e.g., `GvTopbar`, `GvSidebar`)
- **No `.component` postfix** in filenames or class names
- 3 files per component: `name.ts` / `name.html` / `name.scss`

## Component Template

```typescript
import { Component, inject } from '@angular/core';
import { LayoutStore } from '../../store';

@Component({
  selector: 'gv-example',
  standalone: true,
  imports: [],
  templateUrl: './example.html',
  styleUrl: './example.scss',
})
export class GvExample {
  store = inject(LayoutStore);
}
```

## Dependency Injection Rules

- Always use `inject()` — never constructor injection
- Use `input()` and `output()` signals for component I/O
- Use `GV_MENU_MODEL` injection token to pass menu data into `GvSidebar` — never prop-drill through multiple components

```typescript
// Providing the menu model in the app
providers: [
  { provide: GV_MENU_MODEL, useValue: MY_MENU_ITEMS }
]
```

## Public API

- Every new export must be added to `projects/sakai-ui/src/public-api.ts`
- Never import directly from library source paths in the demo app — always use `@gravion/sakai-ui`
- Export components, stores, tokens, and models that consumers need

```typescript
// public-api.ts pattern
export { GvTopbar } from './lib/layout/components/topbar/topbar';
export { GV_MENU_MODEL } from './lib/layout/menu-model.token';
export * from './lib/layout/store';
```

## State Management

- Use `LayoutStore` from `@ngrx/signals` for all layout state
- Do not create separate `LayoutService` — the store is the single source of truth
- State changes via `patchState()` only

## Styling

- Use component-scoped SCSS (`styleUrl`)
- Reference PrimeNG design tokens (e.g., `var(--primary-color)`, `var(--surface-0)`) for theming
- Prefer TailwindCSS utility classes in templates over custom SCSS where possible

## Build

- Build library first: `ng build sakai-ui`
- Then build demo: `ng build demo`
- `tsconfig.json` maps `@gravion/sakai-ui` → `./dist/sakai-ui`
