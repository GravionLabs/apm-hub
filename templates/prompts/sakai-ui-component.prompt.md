---
mode: agent
name: sakai-ui-component
description: 'Scaffold a new @gravion/sakai-ui library component with gv- prefix, 3-file structure, and public-api.ts export'
tools: ['editFiles', 'codebase', 'runCommands']
---
# Create sakai-ui Library Component

Scaffold a new component for the `@gravion/sakai-ui` Angular library following all library conventions.

## Step 1 — Gather information

Ask the user for:

- **Component name** (e.g., `breadcrumb`, `notification-bar`): used for file and selector
- **Domain** (`layout/components`, `pages`, or new domain): determines folder location
- **Imports needed**: PrimeNG modules, other `gv-` components, or Angular modules?
- **Does it use LayoutStore?** (e.g., for dark mode, menu state)

## Step 2 — Create folder and 3 files

Path: `projects/sakai-ui/src/lib/<domain>/<name>/`

### `<name>.ts`

```typescript
import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutStore } from '../../store';

@Component({
  selector: 'gv-<name>',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './<name>.html',
  styleUrl: './<name>.scss',
})
export class Gv<ClassName> {
  store = inject(LayoutStore);
  // Remove store injection if not needed
}
```

### `<name>.html`

```html
<div>
  <!-- Gv<ClassName> template -->
</div>
```

### `<name>.scss`

```scss
// Gv<ClassName> styles
```

## Step 3 — Export from `public-api.ts`

Add the export to `projects/sakai-ui/src/public-api.ts`:

```typescript
export { Gv<ClassName> } from './lib/<domain>/<name>/<name>';
```

Group it with related exports (layout components together, pages together).

## Step 4 — Use in demo app

In the demo, always import from `@gravion/sakai-ui`:

```typescript
import { Gv<ClassName> } from '@gravion/sakai-ui';
```

Never import from the library source path (`../../projects/sakai-ui/src/...`).

## Step 5 — Build and verify

```bash
ng build sakai-ui   # Build library first
ng build demo       # Then verify demo compiles
```

## Naming Quick Reference

| Input name | Filename | Class | Selector |
|------------|----------|-------|----------|
| `breadcrumb` | `breadcrumb.ts` | `GvBreadcrumb` | `gv-breadcrumb` |
| `notification-bar` | `notification-bar.ts` | `GvNotificationBar` | `gv-notification-bar` |
| `page-header` | `page-header.ts` | `GvPageHeader` | `gv-page-header` |

## Rules Checklist

- [ ] Selector starts with `gv-`
- [ ] Class name starts with `Gv`, no `Component` suffix
- [ ] `standalone: true`
- [ ] Uses `templateUrl` and `styleUrl` (no inline)
- [ ] Uses `inject()` for DI (no constructor)
- [ ] Uses `input()` / `output()` for component I/O (no decorators)
- [ ] Exported from `public-api.ts`
- [ ] Demo imports from `@gravion/sakai-ui`
- [ ] `ng build sakai-ui` passes
