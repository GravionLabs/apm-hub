---
mode: agent
name: angular-library-create
description: 'Scaffold an Angular library with ng-packagr, public-api.ts, 3-file component structure, and injection tokens'
tools: ['editFiles', 'codebase', 'runCommands']
---
# Create Angular Library

Scaffold a new Angular library inside an existing Angular workspace using `ng-packagr`.

## Step 1 — Gather information

Ask the user for:

- **Library name** (e.g., `ui-components`, `sakai-ui`): used for folder and npm package name
- **npm scope** (e.g., `@gravion`, `@myorg`): used in `package.json` name
- **Component selector prefix** (e.g., `gv`, `my`): all components use this prefix
- **Workspace**: does an Angular workspace (`angular.json`) already exist?

## Step 2 — Generate the library

```bash
ng generate library <library-name> --prefix=<prefix>
```

This creates `projects/<library-name>/` with `ng-packagr` configuration.

## Step 3 — Set up folder structure

Reorganize `src/lib/` for a scalable structure:

```
projects/<lib-name>/src/
├── public-api.ts              # All public exports
└── lib/
    ├── components/            # Reusable components
    │   └── <component-name>/
    │       ├── <name>.ts
    │       ├── <name>.html
    │       └── <name>.scss
    ├── store/                 # NgRx Signal Store(s)
    │   ├── index.ts
    │   ├── <feature>.store.ts
    │   └── <feature>.models.ts
    └── tokens/                # Injection tokens
        └── <token>.token.ts
```

## Step 4 — Configure `public-api.ts`

```typescript
// Export everything the consumer needs — nothing internal
export { MyComponent } from './lib/components/my-component/my-component';
export { MyStore } from './lib/store';
export { MY_TOKEN } from './lib/tokens/my.token';
```

## Step 5 — Create first component (3-file pattern)

```typescript
// my-component.ts
import { Component } from '@angular/core';

@Component({
  selector: '<prefix>-my-component',
  standalone: true,
  imports: [],
  templateUrl: './my-component.html',
  styleUrl: './my-component.scss',
})
export class MyComponent {}
```

```html
<!-- my-component.html -->
<div>
  <!-- MyComponent template -->
</div>
```

```scss
// my-component.scss
// MyComponent styles
```

## Step 6 — Configure `tsconfig.json` path mapping

In the workspace root `tsconfig.json`, add a path mapping so the demo can import from the package name:

```json
{
  "compilerOptions": {
    "paths": {
      "@scope/lib-name": ["./dist/lib-name"]
    }
  }
}
```

## Step 7 — Build workflow

```bash
# Build library first (always)
ng build <lib-name>

# Then build the consumer app
ng build demo
```

Add convenience scripts to `package.json`:

```json
{
  "scripts": {
    "build:lib": "ng build <lib-name>",
    "build:demo": "ng build demo",
    "build": "npm run build:lib && npm run build:demo"
  }
}
```

## Step 8 — Create an injection token (optional)

For configurable data (e.g., navigation menu, theme config):

```typescript
// tokens/my-config.token.ts
import { InjectionToken } from '@angular/core';

export interface MyConfig {
  primaryColor: string;
}

export const MY_CONFIG = new InjectionToken<MyConfig>('MY_CONFIG', {
  factory: () => ({ primaryColor: 'blue' }),  // safe default
});
```

Export from `public-api.ts`. Consumers provide it in `app.config.ts`:

```typescript
providers: [
  { provide: MY_CONFIG, useValue: { primaryColor: 'green' } }
]
```

## Naming Conventions

- Library folder: `kebab-case` (e.g., `sakai-ui`)
- Package name: `@scope/lib-name` (e.g., `@gravion/sakai-ui`)
- Component selector prefix: 2-3 letter `kebab` prefix (e.g., `gv-`)
- Class prefix: corresponding `PascalCase` (e.g., `Gv`)
- No `.component` suffix in filenames or class names
