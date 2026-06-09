---
name: ng-developer
description: >
  Generates Angular code and provides architectural guidance. Use this skill when
  creating projects, components, or services, or for best practices on reactivity
  (signals, linkedSignal, resource), forms, dependency injection, routing, SSR,
  accessibility (ARIA), animations, styling (component styles, Tailwind CSS),
  testing, or CLI tooling.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
compatibility: opencode, github-copilot
license: MIT
model: claude-sonnet-4.6
metadata:
  author: Copyright 2026 Google LLC
  version: '1.0'
---

# Angular Developer Guidelines

## Overview

Comprehensive Angular development guidance: project creation, components, reactivity (signals), forms, DI, routing, accessibility, styling, animations, testing.

**Key principle:** Analyze project Angular version first — best practices vary significantly between versions.

## Prerequisites

- Angular project or intent to create one
- TypeScript familiarity (recommended but not required)
- Angular CLI installed (or willingness to use `npx`)

## Steps

### Phase 1 — Analyze & Prepare

✓ Checkpoint: Project environment understood; version confirmed; references loaded

1. **Analyze project version:**
   - Existing project: run `ng version`
   - New project: determine user-specified version
   - Load appropriate references based on version and task

2. **Load task-specific references:**
   - **Project creation:** Start with scaffolding guidance. Load form references only if user asks or feature set clearly includes forms: [reactive-forms.md](references/reactive-forms.md), [template-driven-forms.md](references/template-driven-forms.md), [signal-forms.md](references/signal-forms.md) (only for explicit Signal Forms or existing Signal Forms codebase)
   - **Components:** Read [references/components.md](references/components.md), [inputs.md](references/inputs.md), [outputs.md](references/outputs.md), [host-elements.md](references/host-elements.md)
   - **Reactivity:** Read [references/signals-overview.md](references/signals-overview.md), [linked-signal.md](references/linked-signal.md), [resource.md](references/resource.md), [effects.md](references/effects.md)
   - **Forms:** Read [references/reactive-forms.md](references/reactive-forms.md), [template-driven-forms.md](references/template-driven-forms.md), [signal-forms.md](references/signal-forms.md) (only for explicit Signal Forms task or existing Signal Forms codebase)
   - **DI:** Read [references/di-fundamentals.md](references/di-fundamentals.md), [creating-services.md](references/creating-services.md), [defining-providers.md](references/defining-providers.md), [injection-context.md](references/injection-context.md), [hierarchical-injectors.md](references/hierarchical-injectors.md)
   - **Accessibility:** Read [references/ng-aria.md](references/ng-aria.md)
   - **Routing:** Read [references/routing-index.md](references/routing-index.md) for topic selection. For routing-specific tasks, read relevant direct references: [define-routes.md](references/define-routes.md), [loading-strategies.md](references/loading-strategies.md), [show-routes-with-outlets.md](references/show-routes-with-outlets.md), [navigate-to-routes.md](references/navigate-to-routes.md), [route-guards.md](references/route-guards.md), [data-resolvers.md](references/data-resolvers.md), [router-lifecycle.md](references/router-lifecycle.md), [rendering-strategies.md](references/rendering-strategies.md), [route-animations.md](references/route-animations.md)
   - **Styling:** Read [references/tailwind-css.md](references/tailwind-css.md), [component-styling.md](references/component-styling.md), [ng-animations.md](references/ng-animations.md)
   - **Testing:** Read [references/testing-vitest.md](references/testing-vitest.md) for Angular v21+ or [testing-jest.md](references/testing-jest.md) for v20 and earlier, plus task-specific: [testing-fundamentals.md](references/testing-fundamentals.md), [component-harnesses.md](references/component-harnesses.md), [router-testing.md](references/router-testing.md), [e2e-testing.md](references/e2e-testing.md)
   - **Tooling:** Read [references/cli.md](references/cli.md), [mcp.md](references/mcp.md)

### Phase 2 — Generate Code

✓ Checkpoint: Code scaffolded and generated; all CLI commands executed successfully

3. **Execute scaffolding or generation:**
   - Use Angular CLI (`ng new`, `ng generate`, etc.) for all code creation
   - Follow version-appropriate patterns from loaded references
   - Apply Angular style guide and best practices

4. **Project creation specifically:**
   - **Step 1 — Check version:** If user requests specific version, use `npx @angular/cli@<version> new <project-name>`
   - **Step 2 — Check local install:** If no version specified, run `ng version` to detect local installation
   - **Step 3 — Fallback:** If `ng version` fails, use `npx @angular/cli@latest new <project-name>`

5. **Component/service/other generation:**
   - Use local CLI: `ng generate component <name>` or similar
   - Ensure project structure follows Angular conventions

### Phase 3 — Build & Validate

✓ Checkpoint: Build successful; generated code correct and functional

6. **Build to catch errors early:**
   - Run `ng build` immediately after code generation
   - Prefer smallest useful output; use quiet/progress-suppressed build flag if available
   - Fix build errors before proceeding
   - **Don't skip this step** — ensures code correctness

7. **Run tests (if applicable):**
   - Determine test runner: Vitest (v21+, recommended) or Jest (v20 and earlier)
   - Write tests during development
   - Prefer `npm --silent run test` to avoid npm wrapper noise; use watch mode only for interactive test session

8. **Prepare response:**
   - Read [assets/output-template.md](assets/output-template.md)
   - Fill in only sections matching work actually completed

## Architecture Guides by Topic

### Creating New Projects
- Default: Latest stable Angular (unless user specifies)
- Forms: Don't assume forms part of project creation. Default to Reactive Forms; use Template-driven Forms for simple template-led cases; use Signal Forms only when explicitly requested or already adopted
- Follow "Execution Rules" in Phase 2, Step 4

### Components
- Anatomy, metadata, core concepts, template control flow
- Signal-based inputs, transforms, model inputs
- Signal-based outputs and custom events
- Host bindings and attribute injection
- See: [references/components.md](references/components.md) and related files

### Reactivity & Data Management
- Use Angular Signals (`signal`, `computed`, `linkedSignal`, `resource`)
- Understand reactive contexts and `untracked`
- Use `effect` for side effects (logging, DOM manipulation)
- Know when NOT to use effects
- See: [references/signals-overview.md](references/signals-overview.md) and related files

### Forms
- **Preference:** Reactive Forms by default
- **Alternative:** Template-driven Forms for simple template-led forms
- **Opt-in:** Signal Forms only when user explicitly requests or project already uses them
- Analyze project and choose appropriate strategy
- See: [references/reactive-forms.md](references/reactive-forms.md), [template-driven-forms.md](references/template-driven-forms.md), [signal-forms.md](references/signal-forms.md) when needed

### Dependency Injection
- Use `inject()` function (modern) over constructor injection
- Services: use `providedIn: 'root'` for tree-shakability
- `InjectionToken` for custom providers
- Hierarchical injectors: `EnvironmentInjector` vs `ElementInjector`
- Modifiers: `optional`, `skipSelf`
- See: [references/di-fundamentals.md](references/di-fundamentals.md) and related files

### Accessibility (ARIA)
- Use Angular Aria components for headless, accessible patterns
- Supported: Accordion, Listbox, Combobox, Menu, Tabs, Toolbar, Tree, Grid
- Style ARIA attributes properly
- See: [references/angular-aria.md](references/angular-aria.md)

### Routing
- Comprehensive routing guide: route definition, loading strategies, outlets, guards, resolvers, lifecycle events, rendering strategies, animations
- See: [references/routing-index.md](references/routing-index.md) for overview, then load direct routing references named in Phase 1, Step 2

### Styling & Animations
- **Tailwind CSS:** Integrating with Angular projects
- **Animations:** Use native CSS (recommended) or legacy DSL
- **Component styles:** Best practices and encapsulation
- See: [references/tailwind-css.md](references/tailwind-css.md), [component-styling.md](references/component-styling.md), [angular-animations.md](references/angular-animations.md)

### Testing
- **Choose test runner:** Vitest (v21+, recommended) or Jest (v20 and earlier)
- **Patterns:** TestBed, component fixtures, async patterns (`fakeAsync`, `tick`), mocking, HTTP testing
- **Component harnesses:** Robust interaction and testing
- **Router testing:** Use `RouterTestingHarness`
- **E2E:** Best practices with Cypress
- See: [references/testing-vitest.md](references/testing-vitest.md) and related files

### Signal Store (NgRx)

Scaffold NgRx Signal Store for Angular feature state management.

1. Ask: feature name, state shape (fields + types + defaults), scope (`root` or feature), async operations needed
2. Create `<feature>.models.ts` with state interface and supporting types
3. Create `<feature>.store.ts`:
   ```typescript
   export const <Feature>Store = signalStore(
     { providedIn: 'root' },
     withState<FeatureState>(initialState),
     withComputed((store) => ({...})),
     withMethods((store) => ({...})),
     withHooks({ onInit(store) {...} })
   );
   ```
4. For async: use `rxMethod` or `patchState` with loading/error state fields
5. Register in component or feature providers as needed

**Constraints:**
- Use `@ngrx/signals` — not `@ngrx/store`
- Keep store files focused on single feature slice
- Prefer `withComputed` for derived values over manual subscriptions
- Export store type: `type <Feature>Store = InstanceType<typeof <Feature>Store>`

---

### Library Create

Scaffold new Angular library inside existing workspace.

1. Ask: library name (e.g. `@org/my-lib`), selector prefix, include sample component, publishing target
2. Generate library: `ng generate library <lib-name> --prefix=<prefix>`
3. Clean up generated scaffold — remove unnecessary boilerplate
4. Set up `public-api.ts` as single export surface
5. Add initial component using ng-component conventions (3-file structure)
6. Configure `ng-packagr` in `ng-package.json` — set `lib.entryFile` to `public-api.ts`
7. Add build script: `"build:<lib>": "ng build <lib>"`
8. Verify library builds: `ng build <lib>`

**Constraints:**
- All exports through `public-api.ts` — no deep imports
- Use standalone components — no NgModules
- Library must compile before task complete

---

### Sakai UI Component

Scaffold new component for `@gravion/sakai-ui` Angular library.

1. Ask: component name (kebab-case), folder path within `sakai-ui/src/lib/`, PrimeNG components needed
2. Create `<name>.ts` as standalone component with selector `gv-<name>`:
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
5. Export component in `public-api.ts`
6. Build library to verify: `ng build sakai-ui`

**Constraints:**
- Selector prefix must be `gv-`
- All exports via `public-api.ts` — no internal deep imports from consumers
- PrimeNG components imported in component's `imports` array
- Don't modify existing components unless fixing export

### Tooling
- **Angular CLI:** Creating apps, generating code, serving, building
- **Angular MCP Server:** Tools, configuration, experimental features
- See: [references/cli.md](references/cli.md), [mcp.md](references/mcp.md)

## Gotchas

- **Always run `ng build` after generation** — catches errors early
- `ng version` may fail without global Angular CLI — fallback to `npx @angular/cli@latest`
- **Don't throw errors in tests** — use `TestBed.flushEffects()` when testing Signals
- **Test choice matters:** Vitest for modern Angular (v21+), Jest for legacy
- Signal Forms opt-in — don't assume unless user or codebase points to `@angular/forms/signals`

## Output Format

If preparing final response, read [assets/output-template.md](assets/output-template.md).
Use template, keep response focused on Angular version, generated artifacts, and build/test status.
