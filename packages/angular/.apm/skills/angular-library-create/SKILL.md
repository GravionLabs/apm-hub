---
name: angular-library-create
description: 'Scaffold a new Angular library inside an existing workspace using ng-packagr, with public-api.ts, 3-file component structure, and injection tokens.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: claude-sonnet-4.6
---

Scaffold new Angular library inside existing workspace.

## Steps
1. Ask: library name (e.g. `@org/my-lib`), selector prefix, include sample component, publishing target (npm / internal)
2. Generate library:
   ```bash
   ng generate library <lib-name> --prefix=<prefix>
   ```
3. Clean up generated scaffold — remove unnecessary boilerplate
4. Set up `public-api.ts` as single export surface
5. Add initial component using `angular-component` conventions (3-file structure)
6. Configure `ng-packagr` in `ng-package.json` — set `lib.entryFile` to `public-api.ts`
7. Add build script in `package.json` if not present: `"build:<lib>": "ng build <lib>"`
8. Verify library builds: `ng build <lib>`

## Constraints
- All exports through `public-api.ts` — no deep imports
- Use standalone components — no NgModules
- Library must compile with `ng build` before task complete
