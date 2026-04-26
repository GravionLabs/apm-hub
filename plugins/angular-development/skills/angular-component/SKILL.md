---
name: angular-component
description: 'Scaffold an Angular standalone component with 3-file structure (ts/html/scss) following project conventions for selector prefix, imports, and folder placement.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: claude-sonnet-4.6
---

Generate an Angular standalone component following project conventions.

## What this skill does
Creates three files (`<name>.ts`, `<name>.html`, `<name>.scss`) for a standalone Angular component. Follows the project's selector prefix, import patterns, and folder conventions.

## Steps
1. Ask if not provided: component name (kebab-case), selector prefix (e.g. `app`, `gv`), target folder, and any Angular/PrimeNG modules to import
2. Create `<name>.ts`:
   ```typescript
   @Component({
     selector: '<prefix>-<name>',
     standalone: true,
     imports: [...],
     templateUrl: './<name>.html',
     styleUrl: './<name>.scss',
   })
   export class <ClassName>Component { }
   ```
3. Create `<name>.html` with a minimal placeholder template
4. Create `<name>.scss` as an empty file
5. Add the component to the nearest barrel (`index.ts` / `public-api.ts`) if one exists

## Constraints
- Always `standalone: true` — no NgModules
- Use `styleUrl` (singular, Angular 17+), not `styleUrls`
- Class name: PascalCase + `Component` suffix
- Follow project's import ordering (Angular core → Angular common → PrimeNG → local)

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
