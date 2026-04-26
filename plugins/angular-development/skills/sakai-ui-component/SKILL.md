---
name: sakai-ui-component
description: 'Scaffold a new @gravion/sakai-ui Angular library component with gv- prefix, 3-file structure, PrimeNG dependencies, and public-api.ts export.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
model: claude-sonnet-4.6
---

Scaffold a new component for the `@gravion/sakai-ui` Angular library.

## What this skill does
Creates a PrimeNG-based Angular standalone component in the `sakai-ui` library, following all library conventions: `gv-` selector prefix, 3-file structure, and export via `public-api.ts`.

## Steps
1. Ask if not provided: component name (kebab-case), folder path within `sakai-ui/src/lib/`, PrimeNG components needed
2. Create `<name>.ts` as a standalone component with selector `gv-<name>`:
   ```typescript
   @Component({
     selector: 'gv-<name>',
     standalone: true,
     imports: [/* PrimeNG modules */],
     templateUrl: './<name>.html',
     styleUrl: './<name>.scss',
   })
   export class Gv<Name>Component { }
   ```
3. Create `<name>.html` with PrimeNG markup
4. Create `<name>.scss` (empty or with scoped styles)
5. Export the component in `public-api.ts`
6. Build the library to verify: `ng build sakai-ui`

## Constraints
- Selector prefix must be `gv-`
- All exports via `public-api.ts` — no internal deep imports from consumers
- PrimeNG components must be imported in the component's `imports` array
- Do not modify existing components unless fixing an export

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
