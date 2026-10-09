---
name: ng-developer
description: >
  Generates Angular code and provides architectural guidance. Use this skill when
  creating projects, components, or services, or for best practices on reactivity
  (signals, linkedSignal, resource), forms, dependency injection, routing, SSR,
  accessibility (ARIA), animations, styling, testing, or CLI tooling.
license: MIT
metadata:
  author: Copyright 2026 Google LLC
  version: '1.0'
---

## Rules

- Run `ng version` first — best practices differ between Angular versions
- New project: `npx @angular/cli@<version> new <name>` if the user names a version; otherwise the local `ng`; if `ng version` fails, `npx @angular/cli@latest new <name>`
- Generate code with `ng generate`, then run `ng build` immediately and fix errors before continuing
- Components: standalone, `ChangeDetectionStrategy.OnPush`, signals for state
- DI: `inject()` over constructor injection; `providedIn: 'root'` for services
- Forms: Reactive Forms by default; Template-driven for simple template-led forms; Signal Forms (`@angular/forms/signals`) only when requested or already used in the codebase
- Tests: Vitest for v21+, Jest for v20 and earlier; use `TestBed.flushEffects()` when testing signal effects
- Do not guess APIs: look them up with the Angular CLI MCP server (setup in `references/mcp.md`) or angular.dev

## References

Load `references/version-notes.md` when working with Signal Forms, Angular Aria, `linkedSignal`/`resource`, functional route guards, or Vitest setup — these have non-obvious or experimental APIs.

## Related skills

- `ng-component` — scaffold a component (incl. Sakai UI variant)
- `ng-signal-store` — NgRx Signal Store
- `ng-library` — new library in a workspace
- `ng-test`, `ng-implementation` — test and code conventions

## Gotchas

- `ng version` may fail without a global Angular CLI — fall back to `npx @angular/cli@latest`
- Don't assume Signal Forms; check `package.json` and imports first
