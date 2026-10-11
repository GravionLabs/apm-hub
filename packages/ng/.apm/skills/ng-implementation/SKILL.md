---
name: ng-implementation
description: 'Angular 20+ implementation and review rules (standalone, signals, DI, forms, libraries) extending `implementation`. Use for Angular code or architecture questions.'
license: MIT
---

Paths to `references/` are relative to this skill's directory.

## Before writing code

- Run `ng version` first; conventions differ between majors. If it fails, use `npx @angular/cli@latest`.
- Generate with `ng generate`, then `ng build` immediately and fix errors before continuing.
- Do not guess APIs: use the Angular CLI MCP server or angular.dev. If the MCP server is not configured → read `references/mcp.md`.
- If working with Signal Forms, Angular Aria, `linkedSignal`/`resource`, functional route guards or Vitest setup → read `references/version-notes.md`.

## Framework

- **Test runner**: Vitest for v21+, Jest for v20 and earlier (details in `ng-test`)
- **Components**: standalone only, no NgModules; `standalone: true` is the default, do not add it
- **CLI**: Angular CLI for generators (`ng generate`)

## Conventions

- `ChangeDetectionStrategy.OnPush`; signals for state, `computed()` for derived values, `effect()` only for side effects
- `input()` / `output()` instead of `@Input` / `@Output`; `model()` for two-way binding
- DI: `inject()` over constructor injection; services `providedIn: 'root'`
- Forms: Reactive Forms by default; template-driven for simple template-led forms; Signal Forms (`@angular/forms/signals`) only when requested or already used in the codebase
- Templates: `@if` / `@for` (with `track`) / `@switch`, not `*ngIf` / `*ngFor`
- Subscriptions cleaned up via `DestroyRef` / `takeUntilDestroyed`
- Upgrades: one major at a time with `ng update`; `ng generate @angular/core:control-flow` migrates legacy templates

## File naming

Match the project's existing convention. New Angular 20+ projects follow the CLI default: no `.component` / `.service` suffix (`header.ts`, class `Header`); projects that still use `*.component.ts` keep it. Never mix both in one project.

## Libraries

- `ng generate library <name> --prefix=<prefix>` inside the workspace
- `public-api.ts` is the single export surface; no deep imports
- `ng-package.json`: `lib.entryFile` points to `public-api.ts`
- Verify with `ng build <lib>` before the task is complete

## Tests

Load `ng-test` for TestBed setup, signal testing, mocking and async patterns.

## Review rules

- `OnPush`; signals for state, `computed()` for derived values
- `effect()` only for side effects, never for state updates (use `computed` or `linkedSignal`)
- `@if` / `@for` (with `track`) / `@switch`; `input()` / `output()`
- `inject()`; no constructor injection in new code
- Subscriptions cleaned up via `DestroyRef` / `takeUntilDestroyed`
- No complex template expressions; ARIA labels and `alt` text on interactive elements and images
- Library code exported only through `public-api.ts`

## Related Skills

- `ng-component` — scaffold a component (incl. Sakai UI variant)
- `ng-signal-store` — NgRx Signal Store for feature state
- `ng-ag-grid-developer` — AG Grid Enterprise integration
- `ng-create-project` — new application or workspace
