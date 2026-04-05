---
name: angular-library-create
description: 'Scaffold a new Angular library inside an existing workspace using ng-packagr, with public-api.ts, 3-file component structure, and injection tokens.'
allowed-tools: editFiles codebase runCommands
model: claude-sonnet-4.6
---

Scaffold a new Angular library inside an existing Angular workspace.

## What this skill does
Creates a library project using `ng generate library`, configures `ng-packagr`, sets up `public-api.ts`, adds an initial component, and wires up the barrel exports.

## Steps
1. Ask: library name (e.g. `@org/my-lib`), selector prefix, whether to include a sample component, publishing target (npm / internal)
2. Generate the library:
   ```bash
   ng generate library <lib-name> --prefix=<prefix>
   ```
3. Clean up the generated scaffold — remove boilerplate files not needed
4. Set up `public-api.ts` as the single export surface
5. Add an initial component using the `angular-component` conventions (3-file structure)
6. Configure `ng-packagr` in `ng-package.json` — set `lib.entryFile` to `public-api.ts`
7. Add build script in `package.json` if not present: `"build:<lib>": "ng build <lib>"`
8. Verify the library builds: `ng build <lib>`

## Constraints
- All exports go through `public-api.ts` — no deep imports
- Use standalone components — no NgModules
- Library must compile with `ng build` before task is complete
