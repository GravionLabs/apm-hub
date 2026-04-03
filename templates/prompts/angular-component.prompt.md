---
mode: agent
name: angular-component
description: 'Scaffold an Angular 21 standalone component with 3-file structure (ts/html/scss)'
tools: ['editFiles', 'codebase', 'runCommands']
---
# Create Angular 21 Component

Scaffold a new Angular 21 standalone component following the 3-file structure convention.

## Step 1 — Gather information

Ask the user for the following before generating files:

- **Component name** (e.g., `user-profile`, `product-card`): used for filenames and class name
- **Selector prefix** (e.g., `app`, `gv`): used for the component selector
- **Folder path**: where to create the component (e.g., `src/app/components/user-profile/`)
- **Imports needed**: which Angular/PrimeNG modules to import (ask if not obvious)

## Step 2 — Create files

Create 3 files in the target folder. Replace `<name>`, `<prefix>`, and `<ClassName>` accordingly.

### `<name>.ts`

```typescript
import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: '<prefix>-<name>',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './<name>.html',
  styleUrl: './<name>.scss',
})
export class <ClassName> {
  // Example: label = input<string>('');
}
```

### `<name>.html`

```html
<div>
  <!-- <ClassName> template -->
</div>
```

### `<name>.scss`

```scss
// <ClassName> styles
```

## Step 3 — Wire into the application

If the component needs to be used somewhere, show the user:

1. How to import it in the parent component (`imports: [<ClassName>]`)
2. How to use it in the parent template (`<<prefix>-<name> />`)

## Naming Rules

| Input          | Filename          | Class         | Selector           |
|----------------|-------------------|---------------|--------------------|
| `user-profile` | `user-profile.ts` | `UserProfile` | `app-user-profile` |
| `product-card` | `product-card.ts` | `ProductCard` | `app-product-card` |

- Class name: convert `kebab-case` to `PascalCase`, no `Component` suffix
- Never add `.component` to the filename
- Always `standalone: true`
- Always use `templateUrl` and `styleUrl` — never inline templates or styles

## Angular 21 Signal Inputs

Prefer the new signal-based API for inputs and outputs:

```typescript
import { Component, input, output, computed } from '@angular/core';

export class ProductCard {
  // Signal inputs (reactive, no @Input decorator)
  product = input.required<Product>();
  showPrice = input<boolean>(true);

  // Signal output
  selected = output<Product>();

  // Computed from inputs
  displayName = computed(() => this.product().name.toUpperCase());

  selectProduct() {
    this.selected.emit(this.product());
  }
}
```
