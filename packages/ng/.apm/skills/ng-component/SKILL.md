---
name: ng-component
description: 'Scaffold an Angular standalone component with 3-file structure (ts/html/scss) following project conventions for selector prefix, imports, and folder placement.'
---

Scaffold one standalone Angular component.

## Steps

### Phase 1 — Gather Input

Collect all required information upfront:
1. Ask: component name (kebab-case), selector prefix, target folder, modules to import
2. Validate inputs: name format, folder exists
3. ✓ **Checkpoint:** All inputs collected and validated.

### Phase 2 — Create Files

Generate 3-file component structure:
1. Create `<name>.component.ts` with:
   - `@Component` decorator
   - `selector: '<prefix>-<name>'`
   - `standalone: true`
   - `changeDetection: ChangeDetectionStrategy.OnPush`
   - Proper imports ordered: Angular core → Angular common → PrimeNG → local
   - Empty component class
2. Create `<name>.component.html` with minimal placeholder template
3. Create `<name>.component.scss` as empty stylesheet
4. Update barrel export: add to `index.ts` or `public-api.ts` if exists

✓ **Checkpoint:** All 3 component files created and barrel updated.

### Phase 3 — Verify

Validate generated component:
1. Check all files exist and are syntactically valid
2. Verify imports in correct order
3. ✓ **Checkpoint:** Component ready to use.

## Constraints

- Always `standalone: true` and `OnPush` — no NgModules
- Use `styleUrl` (singular, Angular 17+), not `styleUrls`
- Class name: PascalCase + `Component` suffix
- Import ordering: Angular core → Angular common → PrimeNG → local
- Selector prefix matches project convention

Report: summary, files created/updated, verify commands (`ng lint`, `ng build`).

## Gotchas

- **Component name must match file name:** If class is `HeaderComponent`, files must be `header.component.*`
- **PascalCase for class, kebab-case for files:** Class: `NavbarComponent`, Files: `navbar.component.*`
- **Selector prefix consistency:** Use same prefix across all components (e.g., `app-*`, `gv-*`)
- **Barrel exports:** Verify nearest `index.ts` or `public-api.ts` updated, or component won't be easily importable
- **Import ordering matters:** Tools may reformat if order wrong — follow project convention

## Sakai UI variant

For components in the `@gravion/sakai-ui` library:

1. Ask: component name (kebab-case), folder under `sakai-ui/src/lib/`, PrimeNG components needed
2. Create `<name>.ts`, `<name>.html`, `<name>.scss` (no `.component` infix):
   ```typescript
   @Component({
     selector: 'gv-<name>',
     standalone: true,
     changeDetection: ChangeDetectionStrategy.OnPush,
     imports: [/* PrimeNG modules */],
     templateUrl: './<name>.html',
     styleUrl: './<name>.scss',
   })
   export class Gv<Name>Component { }
   ```
3. Export the component in `public-api.ts`
4. Verify: `ng build sakai-ui`

Constraints: selector prefix is `gv-`; PrimeNG components go in the component's `imports`; do not modify existing components unless fixing an export.
