---
name: development-angular-unity
description: >
  Build Angular UIs with the RWE Unity component framework (based on Angular Material).
  Provides component APIs, directives, services, utilities, and example code from @rwe/unity-lib.
  Use this skill when creating or modifying Angular applications that use Unity components —
  even if the user does not explicitly mention @rwe/unity-lib or Unity by name.
metadata:
  model: inherit
---

# RWE Unity Angular Framework

## Use this skill when

- Building or modifying Angular UIs that use `@rwe/unity-lib` components
- Looking up Unity component APIs, inputs, outputs, and usage examples
- Implementing forms, navigation, layout, or theming with Unity
- Needing the correct import path for a Unity component or directive
- Writing templates using Unity CSS utility classes or pipes
- Configuring `provideUnityLib()` or i18n setup
- Implementing tables, dialogs, notifications, or loading states

## Do not use this skill when

- The project does not use Angular or `@rwe/unity-lib`
- Working with plain Angular Material without the Unity wrapper
- The task is unrelated to frontend UI development
- The task is targeting the source code of the Unity library itself

## Instructions

1. Identify the Unity component, directive, service, or utility the user needs.
2. If API or configuration details are required → load the appropriate `references/` file (see **Reference Loading** below).
3. Apply Unity conventions: standalone imports, `ChangeDetectionStrategy.OnPush`, signal-based inputs, zoneless change detection.

## Gotchas

- **Zoneless is mandatory** — `provideZonelessChangeDetection()` is required. Do not use `NgZone` or rely on `zone.js`.
- **No NgModules** — all Unity components are standalone. Import them directly in `imports: [...]`; never in an NgModule.
- **Signal-based inputs only** — all inputs use `input()` / `model()`. Do not use the `@Input()` decorator on Unity components.
- **`provideUnityLib()` required** — call it once in the application bootstrap; without it, Unity components will not initialise correctly.

## Overview

Unity is RWE's internal Angular component library built on top of Angular Material.
All components are published under the `@rwe/unity-lib/*` package scope.

**Library version:** `21.4.2` (Angular v21+)

Key characteristics:

- **Standalone components** — import directly, no NgModules
- **Angular Material foundation** — extends mat-components with RWE branding
- **ChangeDetectionStrategy.OnPush** — all components use OnPush
- **Signal-based inputs** — all inputs are signal-based (`input()`, `model()`)
- **Zoneless** — designed for `provideZonelessChangeDetection()`
- **Reactive forms** — prefer `FormControl` binding for forms with validation; use two-way `[(value)]` for simple bindings without validation
- **i18n** — built-in locale support via `@ngx-translate/core`
- **Theming** — light/dark/contrast mode via CSS custom properties (`--rwe-brand-*`, `--rwe-color-*`)

## Reference Loading

Load reference files on demand based on the task:

- If the user is setting up a new Unity project, installing the library, or configuring `provideUnityLib()` → read `references/getting-started.md`
- If the task involves **non-form** components (`rwe-card`, `rwe-table`, `rwe-accordion`, `rwe-loader`, `rwe-chip`, etc.) — selectors, inputs, outputs, events → read `references/components.md`

**Forms** — use the file that matches the task depth:
- If the task involves any form component (`rwe-form-input`, `rwe-form-select`, `rwe-form-datepicker`, etc.) — imports, inputs, option binding, or configuration → read `references/form-components.md`
- If the user wants to build a new form, needs a complete form example, or is starting from scratch → read `references/form-recipe.md`
- If the user needs form validation (validators, error messages, custom rules) → read `references/form-validators.md`

- If the task involves directives (`[rweIcon]`, `[rwePopup]`, etc.) → read `references/directives.md`
- If the task involves services (notification, confirmation, theme, breakpoint, etc.) → read `references/services.md`
- If the task involves pipes, utility functions, or reactive operators → read `references/utils.md`
- If the task involves CSS utility classes → read `references/css-classes.md`
- If the task involves CSS custom properties or theming variables → read `references/css-variables.md`
- If the task involves layout design decisions or header/aside/main area patterns → read `references/layout-guidelines.md`

## Quick Reference — Component Index

### Layout

| Component             | Import                             | Selector                               |
| --------------------- | ---------------------------------- | -------------------------------------- |
| Application Frame     | `@rwe/unity-lib/application-frame` | `rwe-application-frame`                |
| Header                | `@rwe/unity-lib/application-frame` | `rwe-header`                           |
| Footer                | `@rwe/unity-lib/application-frame` | `rwe-footer`                           |
| Main                  | `@rwe/unity-lib/application-frame` | `rwe-main`                             |
| Aside Left            | `@rwe/unity-lib/application-frame` | `rwe-aside-left`                       |
| Aside Right           | `@rwe/unity-lib/application-frame` | `rwe-aside-right`                      |
| Card                  | `@rwe/unity-lib/card`              | `rwe-card`                             |
| Accordion             | `@rwe/unity-lib/accordion`         | `rwe-accordion`, `rwe-accordion-panel` |
| Details Frame         | `@rwe/unity-lib/details-frame`     | `rwe-details-frame`                    |
| List Frame            | `@rwe/unity-lib/list-frame`        | `rwe-list-frame`                       |
| Tab View              | `@rwe/unity-lib/tabs`              | `rwe-tabs`, `rwe-tab`                  |
| Virtual List          | `@rwe/unity-lib/vlist`             | `rwe-vlist`                            |
| HttpRequestWrap Frame | `@rwe/unity-lib/http-request-wrap` | `rwe-http-request-wrap-frame`          |
| Slot Left             | `@rwe/unity-lib/slot`              | `rwe-left`                             |
| Slot Center           | `@rwe/unity-lib/slot`              | `rwe-center`                           |
| Slot Right            | `@rwe/unity-lib/slot`              | `rwe-right`                            |

### Buttons

| Component   | Import                       | Selector          |
| ----------- | ---------------------------- | ----------------- |
| Button      | `@rwe/unity-lib/button`      | `rwe-button`      |
| Icon Button | `@rwe/unity-lib/icon-button` | `rwe-icon-button` |
| Menu Button | `@rwe/unity-lib/menu-button` | `rwe-menu-button` |

### Forms

| Component          | Import                                   | Selector                      |
| ------------------ | ---------------------------------------- | ----------------------------- |
| Input              | `@rwe/unity-lib/form-input`              | `rwe-form-input`              |
| Autocomplete       | `@rwe/unity-lib/form-autocomplete`       | `rwe-form-autocomplete`       |
| Autocomplete Chips | `@rwe/unity-lib/form-autocomplete-chips` | `rwe-form-autocomplete-chips` |
| Select             | `@rwe/unity-lib/form-select`             | `rwe-form-select`             |
| Select Multiple    | `@rwe/unity-lib/form-select-multi`       | `rwe-form-select-multi`       |
| Datepicker         | `@rwe/unity-lib/form-datepicker`         | `rwe-form-datepicker`         |
| Datepicker Range   | `@rwe/unity-lib/form-datepicker-range`   | `rwe-form-datepicker-range`   |
| Timepicker         | `@rwe/unity-lib/form-timepicker`         | `rwe-form-timepicker`         |
| Checkbox           | `@rwe/unity-lib/form-checkbox`           | `rwe-form-checkbox`           |
| Radio              | `@rwe/unity-lib/form-radio`              | `rwe-form-radio`              |
| Slide Toggle       | `@rwe/unity-lib/form-slide-toggle`       | `rwe-form-slide-toggle`       |
| Toggle             | `@rwe/unity-lib/form-toggle`             | `rwe-form-toggle`             |
| File Drop          | `@rwe/unity-lib/file-drop`               | `rwe-file-drop`               |

### Navigation / Routing

| Component      | Import                          | Selector              |
| -------------- | ------------------------------- | --------------------- |
| Navigation     | `@rwe/unity-lib/navigation`     | `rwe-navigation`      |
| Nav Bar        | `@rwe/unity-lib/nav-bar`        | `rwe-nav-bar`         |
| Nav Tabs       | `@rwe/unity-lib/nav-tabs`       | `rwe-nav-tabs`        |
| Nav List       | `@rwe/unity-lib/nav-list`       | `rwe-nav-list`        |
| Breadcrumb     | `@rwe/unity-lib/breadcrumb`     | `rwe-breadcrumb-menu` |
| Back Button    | `@rwe/unity-lib/back-button`    | `rwe-back-button`     |
| Last-Used Menu | `@rwe/unity-lib/last-used-menu` | `rwe-last-used-menu`  |

### Messages / Feedback

| Component     | Import                         | Selector             |
| ------------- | ------------------------------ | -------------------- |
| State Message | `@rwe/unity-lib/state-message` | `rwe-state-message`  |
| Chip          | `@rwe/unity-lib/chip`          | `rwe-chip`           |
| Notification  | `@rwe/unity-lib/notification`  | `rwe-notification`   |
| Loader        | `@rwe/unity-lib/loader`        | `rwe-loader`         |
| Loader Line   | `@rwe/unity-lib/loader-line`   | `rwe-loader-line`    |
| Confirm       | `@rwe/unity-lib/confirm`       | `rwe-dialog-confirm` |

### Data Display

| Component | Import                 | Selector    |
| --------- | ---------------------- | ----------- |
| Table     | `@rwe/unity-lib/table` | `rwe-table` |

### Branding / Menu

| Component     | Import                         | Selector            |
| ------------- | ------------------------------ | ------------------- |
| App Logo      | `@rwe/unity-lib/app-logo`      | `rwe-app-logo`      |
| Logo          | `@rwe/unity-lib/logo`          | `rwe-logo`          |
| Create Logo   | `@rwe/unity-lib/create-logo`   | `rwe-create-logo`   |
| App Menu      | `@rwe/unity-lib/app-menu`      | `rwe-app-menu`      |
| Language Menu | `@rwe/unity-lib/language-menu` | `rwe-language-menu` |
| Theme Menu    | `@rwe/unity-lib/theme-menu`    | `rwe-theme-menu`    |
| User          | `@rwe/unity-lib/user`          | `rwe-user`          |
| Unity Version | `@rwe/unity-lib/unity-version` | `rwe-unity-version` |

### Directives

| Directive                 | Import                                     | Selector                       |
| ------------------------- | ------------------------------------------ | ------------------------------ |
| Icon                      | `@rwe/unity-lib/icon`                      | `[rweIcon]`                    |
| Title                     | `@rwe/unity-lib/title`                     | `[rweTitle]`                   |
| Copy                      | `@rwe/unity-lib/copy`                      | `[rweCopy]`, `[rweCopySilent]` |
| Filter Input              | `@rwe/unity-lib/filter-input`              | `[rweFilterInput]`             |
| Inline SVG                | `@rwe/unity-lib/inline-svg`                | `[rweInlineSvg]`               |
| Popup                     | `@rwe/unity-lib/popup`                     | `[rwePopup]`                   |
| Deco                      | `@rwe/unity-lib/deco`                      | `[rweDecoLeft]`, etc.          |
| Mint                      | `@rwe/unity-lib/mint`                      | `[rweMint]`                    |
| Match Parent              | `@rwe/unity-lib/match-parent`              | `[rweMatchParent]`             |
| Size Observer             | `@rwe/unity-lib/size-observer`             | `[rweSizeObserver]`            |
| Grid Repeat               | `@rwe/unity-lib/grid-repeat`               | `[rweGridRepeat]`              |
| Show Tooltip If Truncated | `@rwe/unity-lib/show-tooltip-if-truncated` | `[rweShowTooltipIfTruncated]`  |

## CSS Theming — Key Variables

Key brand colors and semantic tokens (for theming context). For the full variable catalogue → read `references/css-variables.md`.

```css
/* Brand colors */
--rwe-brand-blue: #1d4477;
--rwe-brand-energydarkgreen: #00a19f;
--rwe-brand-energyblue: #00b1eb;

/* Semantic (auto-switch with light/dark/contrast theme) */
--rwe-color-primary: var(--mat-sys-primary);
--rwe-color-text: var(--rwe-brand-blue);
--rwe-color-surface: var(--rwe-brand-white);

/* Spacing */
--rwe-gap-medium: 1rem;
--rwe-padding-medium: 1.875rem;
```

## CSS Utility Classes — Key Patterns

Core layout classes (for quick reference). For all classes → read `references/css-classes.md`.

```html
<!-- Flex row / column -->
<div class="rwe-list-h">...</div>
<div class="rwe-list-v">...</div>

<!-- Card-like container -->
<div class="rwe-sheet rwe-padding-medium">...</div>

<!-- Spacing utilities -->
<div class="rwe-gap-medium">...</div>

<!-- Code formatting -->
<span class="rwe-code">inline code</span>
```

## Common Patterns

### Form with FormControl

```typescript
import { FormControl, Validators, ReactiveFormsModule } from "@angular/forms";
import { RweFormInputComponent } from "@rwe/unity-lib/form-input";
import { RweFormSelectComponent } from "@rwe/unity-lib/form-select";
import { RweButton } from "@rwe/unity-lib/button";

@Component({
  selector: "app-my-form",
  imports: [
    ReactiveFormsModule,
    RweFormInputComponent,
    RweFormSelectComponent,
    RweButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <rwe-form-input label="Name" [formControl]="name" />
    <rwe-form-select
      label="Country"
      [formControl]="country"
      [options]="countries"
    />
    <rwe-button (click)="submit()">Save</rwe-button>
  `,
})
export class MyForm {
  name = new FormControl("", Validators.required);
  country = new FormControl<string | null>(null);
  countries: RweSelectItem<string>[] = [
    { value: "DE", label: "Germany" },
    { value: "GB", label: "United Kingdom" },
  ];
}
```

### Form with Two-Way Binding

```html
<rwe-form-input label="Name" [(value)]="name" />
<rwe-form-checkbox label="Active" [(value)]="isActive" />
```

### Confirmation Dialog

```typescript
import { RweConfirmation } from "@rwe/unity-lib/confirm";

export class MyConfirm {
  readonly #confirm = inject(RweConfirmation);

  delete() {
    this.#confirm
      .confirm$<boolean>({
        label: "Delete Item?",
        details: "This action cannot be undone.",
      })
      .subscribe((result) => {
        if (result) {
          // confirmed
        }
      });
  }
}
```

### Notification Toast

```typescript
import { RweNotificationService } from "@rwe/unity-lib/notification";

export class MyNotification {
  readonly #notify = inject(RweNotificationService);

  save() {
    this.#notify.success("Item saved successfully");
  }

  handleError() {
    this.#notify.error("Something went wrong");
  }
}
```

### Simple Table

```typescript
import { RweTableComponent } from "@rwe/unity-lib/table";

@Component({
  imports: [RweTableComponent],
  template: `
    <rwe-table
      [dataSource]="data"
      [displayedColumns]="columns"
      [enableSorting]="true"
      [showPagination]="true"
      [pageSize]="10"
    />
  `,
})
export class MyTable {
  data = [
    { name: "Alice", age: 30, city: "Berlin" },
    { name: "Bob", age: 25, city: "London" },
  ];
  columns: ColumnConfig[] = [
    { name: "name", displayName: "Name" },
    { name: "age", displayName: "Age", align: "end" },
    { name: "city", displayName: "City" },
  ];
}
```

### Breakpoint Detection

```typescript
import { RweDiLayoutBreakpointHits } from "@rwe/unity-lib/breakpoint";

export class MyBreakpoint {
  readonly #breakpoints = inject(RweDiLayoutBreakpointHits);
  protected isMobile = computed(() => this.#breakpoints()["lt-sm"]);
}
```

### Theme Service

```typescript
import { RweThemeService } from "@rwe/unity-lib/core";

export class MyTheme {
  readonly #theme = inject(RweThemeService);
  protected isDark = computed(() => this.#theme.theme() === "energy-dark-mode");
}
```
