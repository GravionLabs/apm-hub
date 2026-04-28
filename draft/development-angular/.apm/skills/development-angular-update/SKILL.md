---
name: development-angular-update
description: >
  Migrates an Angular application to a newer major version using ng update and Angular schematics.
  Use this skill when upgrading Angular (e.g. v17 → v18, v19 → v20), migrating from NgModules to
  standalone, switching to @if/@for/@switch control flow, or adopting signals-first patterns —
  even if the user does not explicitly mention ng update or Angular versioning.
allowed-tools: execute read edit search codebase editFiles runCommands
model: claude-sonnet-4.6
---

## Stack

- **CLI:** Angular CLI (`ng update`, `ng generate @angular/core:migrate-*`)
- **Package manager:** `npm` or `pnpm`
- **Schematics:** `@angular/core:standalone`, `@angular/core:control-flow`

## Step 1 — Check current version

```powershell
ng version
npm ls @angular/core @angular/cli --depth=0
```

## Step 2 — Update Angular packages

```powershell
# Update to next major (one major at a time)
ng update @angular/core@<target> @angular/cli@<target>

# Update all Angular-related packages
ng update
```

## Step 3 — Run standalone migration (if needed)

If the project still uses NgModules:

```powershell
ng generate @angular/core:standalone
```

Apply in three passes: components → routes → remove AppModule.

## Step 4 — Migrate to new control flow syntax

Replace legacy structural directives:

```html
<!-- Before -->
<!-- After -->
*ngIf="x" → @if (x) { ... } *ngFor="let i of arr" → @for (i of arr; track i.id)
{ ... } [ngSwitch] → @switch (x) { @case (y) { ... } }
```

Run the schematic:

```powershell
ng generate @angular/core:control-flow
```

## Step 5 — Review breaking changes

Check the [Angular Update Guide](https://update.angular.io/) for the target version.
Common breaking changes per version:

- **v17**: standalone APIs stable, new control flow syntax
- **v18**: zoneless experimental, `afterRenderEffect` added
- **v19**: `linkedSignal`, `resource()`, `httpResource()`, required signal inputs stable
- **v20/21**: check release notes at [angular.dev/reference/releases](https://angular.dev/reference/releases)

## Key rules

- Test after each major version bump: `ng test`, `ng build`
- Check `@angular/material`, `@ngrx/*`, `@angular/cdk` — update separately if needed
- Review `BREAKING_CHANGES.md` in each package's changelog
- **Input/output visibility**: when converting `@Input()` / `@Output()` to `input()` / `output()` / `model()`, the resulting signal must have **no visibility modifier** — neither `public` nor `protected`. `protected` triggers `TS2445` in Angular's template type-checker when a parent template binds to the input.

## Gotchas

- **One major at a time** — never skip versions (e.g. v17 → v18 → v19, not v17 → v19). `ng update` enforces this.
- **Run `ng test` and `ng build` after every major bump** before continuing to the next version.
- **`@angular/material`, `@ngrx/*`, `@angular/cdk` are NOT updated by `ng update @angular/core`** — run `ng update @angular/material`, `ng update @ngrx/store` etc. separately.
- **Standalone schematic runs in three passes** — run `ng generate @angular/core:standalone` three times: first for components, then routes, then to remove AppModule.
- **Control flow schematic is idempotent** — safe to re-run; already-migrated templates are skipped.

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
