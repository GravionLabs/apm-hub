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

- Always `standalone: true` — no NgModules
- Use `styleUrl` (singular, Angular 17+), not `styleUrls`
- Class name: PascalCase + `Component` suffix
- Import ordering: Angular core → Angular common → PrimeNG → local
- Selector prefix matches project convention

## Output Format

### ✅ Summary
Angular component `{name}` created as standalone with selector `{prefix}-{name}`.

### 📝 What Changed
- Created: `{path}/{name}.component.ts` (52 lines)
- Created: `{path}/{name}.component.html`
- Created: `{path}/{name}.component.scss`
- Updated: `{path}/index.ts` (added export)

### ✔️ Verify
```powershell
# Check component syntax
ng lint

# Build to verify compilation
ng build

# Run tests (when tests are added)
ng test --include="**/{name}.component.spec.ts"
```

### 🚀 Next Steps
1. Write unit tests in `{path}/{name}.component.spec.ts`
2. Add component logic and imports as needed
3. Integrate into parent component or route
4. Test in dev server: `ng serve`

## Gotchas

- **Component name must match file name:** If class is `HeaderComponent`, files must be `header.component.*`
- **PascalCase for class, kebab-case for files:** Class: `NavbarComponent`, Files: `navbar.component.*`
- **Selector prefix consistency:** Use same prefix across all components (e.g., `app-*`, `gv-*`)
- **Barrel exports:** Verify nearest `index.ts` or `public-api.ts` updated, or component won't be easily importable
- **Import ordering matters:** Tools may reformat if order wrong — follow project convention
