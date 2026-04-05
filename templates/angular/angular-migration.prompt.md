---
mode: agent
name: angular-migration
description: 'Guide a step-by-step Angular version migration: ng update, standalone migration, new control flow syntax, and signals-first refactoring'
tools: ['codebase', 'editFiles', 'runCommands']
---

# Angular Version Migration

Guide a complete Angular version migration, one major version at a time.

## Step 1 — Assess the current state

```bash
ng version
cat package.json | grep '"@angular/'
```

Ask the user:
- What is the **target Angular version**?
- Are there any **third-party Angular libraries** in use? (Material, NgRx, PrimeNG, etc.)
- Are there **NgModules** to migrate to standalone?

Check the [Angular Update Guide](https://update.angular.io/) for the source → target path.

## Step 2 — Migrate one major version at a time

⚠️ **Never skip major versions.** Always migrate v17 → v18, then v18 → v19, etc.

```bash
# Update Angular core and CLI to next major
ng update @angular/core@<next> @angular/cli@<next>

# Update Angular-maintained packages
ng update @angular/cdk@<next> @angular/material@<next>  # if used

# Update NgRx
ng update @ngrx/store@<next>  # if used
```

After each major version: run `ng build` and `ng test` — fix issues before continuing.

## Step 3 — Migrate to standalone components (if needed)

If the project uses `NgModule`-based architecture:

```bash
# Run the automated migration schematic (3 passes)
ng generate @angular/core:standalone          # Pass 1: convert components/directives/pipes
ng generate @angular/core:standalone --mode=prune-ng-modules  # Pass 2: clean up modules
ng generate @angular/core:standalone --mode=finish  # Pass 3: bootstrapApplication
```

Manually verify:
- `AppModule` removed or replaced by `app.config.ts`
- Providers moved to `bootstrapApplication(AppComponent, appConfig)`
- Routing uses `provideRouter(routes)` instead of `RouterModule.forRoot()`
- `HttpClient` uses `provideHttpClient()` instead of `HttpClientModule`

## Step 4 — Migrate to new control flow syntax

Replace Angular's legacy structural directives with the new block syntax:

```html
<!-- ❌ Legacy -->
<div *ngIf="isLoading">Loading...</div>
<li *ngFor="let item of items; trackBy: trackById">{{ item.name }}</li>
<div [ngSwitch]="status">
  <span *ngSwitchCase="'active'">Active</span>
</div>

<!-- ✅ New control flow -->
@if (isLoading) { <div>Loading...</div> }
@for (item of items; track item.id) { <li>{{ item.name }}</li> }
@switch (status) { @case ('active') { <span>Active</span> } }
```

Run the automated migration:
```bash
ng generate @angular/core:control-flow
```

Manually review generated output — the schematic may miss complex cases.

## Step 5 — Migrate to signals-first patterns (optional but recommended)

Where appropriate, replace `@Input()` / `@Output()` with signal-based alternatives:

```typescript
// ❌ Classic
@Input() title: string = '';
@Output() titleChange = new EventEmitter<string>();

// ✅ Signal-based
title = input.required<string>();
titleChange = output<string>();
```

Replace `BehaviorSubject` state patterns with signals:
```typescript
// ❌ Classic
private _items$ = new BehaviorSubject<Item[]>([]);
items$ = this._items$.asObservable();

// ✅ Signal-based (in a service)
items = signal<Item[]>([]);
```

## Step 6 — Update third-party dependencies

Check compatibility matrices:
- [NgRx Compatibility Matrix](https://ngrx.io/guide/migration)
- [Angular Material](https://material.angular.io/guide/getting-started)
- [PrimeNG Release Notes](https://primeng.org/installation)

## Step 7 — Final validation

```bash
ng build --configuration production   # full production build
ng test --watch=false                  # all unit tests
ng lint                                # no new lint errors
```

Review and commit the changes. Document the migration in `CHANGELOG.md`.
