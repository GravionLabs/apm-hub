---
name: angular-migration
description: 'Migrate an Angular application to a newer version. Covers ng update, standalone component migration, new @if/@for/@switch control flow syntax, and signals-first patterns.'
allowed-tools: codebase editFiles runCommands
model: claude-sonnet-4.6
---

Migrate an Angular application to a newer version.

## Stack
- **CLI:** Angular CLI (`ng update`, `ng generate @angular/core:migrate-*`)
- **Package manager:** `npm` or `pnpm`
- **Schematics:** `@angular/core:standalone`, `@angular/core:control-flow`, `@ngrx/signals`

## Step 1 — Check current version

```bash
ng version
cat package.json | grep '"@angular/'
```

## Step 2 — Update Angular packages

```bash
# Update to next major (one major at a time)
ng update @angular/core@<target> @angular/cli@<target>

# Update all Angular-related packages
ng update
```

> ⚠️ Always migrate **one major version at a time** (e.g., v17 → v18, then v18 → v19).

## Step 3 — Run standalone migration (if needed)

If the project still uses NgModules:
```bash
ng generate @angular/core:standalone
```
Apply in three passes: components → routes → remove AppModule.

## Step 4 — Migrate to new control flow syntax

Replace legacy structural directives:
```html
<!-- Before -->              <!-- After -->
*ngIf="x"              →    @if (x) { ... }
*ngFor="let i of arr"  →    @for (i of arr; track i.id) { ... }
[ngSwitch]             →    @switch (x) { @case (y) { ... } }
```

Run the schematic:
```bash
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

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
