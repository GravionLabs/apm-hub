---
name: ng-library
description: Scaffold an Angular library inside an existing workspace, with `public-api.ts` as the single export surface. Use when creating a new publishable or shared Angular library.
---

Scaffold a new Angular library inside an existing workspace.

## Steps

1. Ask: library name (e.g. `@org/my-lib`), selector prefix, include sample component, publishing target
2. Generate: `ng generate library <lib-name> --prefix=<prefix>`
3. Clean up the generated scaffold — remove unnecessary boilerplate
4. Set up `public-api.ts` as the single export surface
5. Add the initial component using `ng-component` conventions (3-file structure)
6. Configure `ng-packagr` in `ng-package.json` — set `lib.entryFile` to `public-api.ts`
7. Add build script: `"build:<lib>": "ng build <lib>"`
8. Verify the library builds: `ng build <lib>`

## Constraints

- All exports through `public-api.ts` — no deep imports
- Standalone components only — no NgModules
- The library must compile before the task is complete
