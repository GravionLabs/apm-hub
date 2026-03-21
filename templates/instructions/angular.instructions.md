---
description: 'Angular 21 coding standards and best practices'
applyTo: '**/*.ts, **/*.html, **/*.scss'
---

# Angular Development Instructions

Guidelines for building high-quality Angular 21 applications with TypeScript, Angular Signals, and standalone components.

## Project Standards

- Use Angular 21 with standalone components (no NgModules unless explicitly required)
- Enable strict mode in `tsconfig.json`
- Use Angular CLI for scaffolding; follow the [Angular Style Guide](https://angular.dev/style-guide)
- Use PrimeNG for UI components (latest version compatible with the project's Angular version)
- Use TailwindCSS for utility styling

## File Naming

- **No `.component` postfix**: name files `topbar.ts` / `topbar.html` / `topbar.scss`, not `topbar.component.ts`
- Every component must have **3 separate files**: `name.ts`, `name.html`, `name.scss`
- Use `templateUrl` and `styleUrl` — never inline `template` or `styles`
- Services: `user.service.ts`, Guards: `auth.guard.ts`, Pipes: `date-format.pipe.ts`

## Component Design

- All components must be `standalone: true`
- Use `input()`, `output()`, `viewChild()`, `viewChildren()` functions instead of decorators (`@Input`, `@Output`, `@ViewChild`)
- Use `inject()` for dependency injection — never constructor injection
- Apply `OnPush` change detection where practical for performance
- Keep template logic minimal; move complexity to component class or services

## Naming Conventions

- Component selectors: `kebab-case` with project-specific prefix (e.g., `app-`, `gv-`)
- Component classes: `PascalCase` without `Component` suffix (e.g., `Topbar`, not `TopbarComponent`)
- Services: `PascalCase` ending in `Service` (e.g., `UserService`)
- Signals: descriptive camelCase (e.g., `isLoading`, `currentUser`)

## State Management with Signals

- Use `signal()`, `computed()`, and `effect()` for local reactive state
- Use NgRx Signal Store (`@ngrx/signals`) for shared/cross-component state
- Never share mutable state through services with plain properties — use signals
- Use `toSignal()` to bridge RxJS observables to signals where needed

## Dependency Injection

```typescript
// ✅ Correct
export class UserProfile {
  private userService = inject(UserService);
  userId = input<string>();
}

// ❌ Wrong
export class UserProfile {
  constructor(private userService: UserService) {}
}
```

## Templates

- Use `@if`, `@for`, `@switch` (new control flow, Angular 17+)
- Use `@for` with `track` expression — always provide a unique identity
- Avoid complex expressions in templates; extract to `computed()` signals

```html
<!-- ✅ Correct -->
@for (item of items(); track item.id) {
  <li>{{ item.name }}</li>
}

<!-- ❌ Avoid -->
<li *ngFor="let item of items">{{ item.name }}</li>
```

## Routing

- Use lazy loading for all feature routes: `loadComponent: () => import(...)`
- Use `inject()` inside route guards and resolvers
- Define routes as typed `Routes` arrays in `*.routes.ts` files

## Testing

- Unit tests: Vitest (preferred) or Jest — file naming `*.spec.ts`
- Use `TestBed` for component tests with minimal mocked dependencies
- Prefer testing behavior over implementation details

## Performance

- Use `OnPush` change detection with signal-based components
- Implement `trackBy` (or `track`) in all list renders
- Lazy-load routes and heavy components
- Keep initial bundle under 500 kB (compressed) for fast first paint
