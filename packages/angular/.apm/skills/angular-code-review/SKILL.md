---
name: angular-code-review
description: 'Review Angular code for change detection strategy, lifecycle hooks, signal usage, template best practices, accessibility, and performance. Returns a prioritised findings list.'
allowed-tools: read search codebase problems
compatibility: opencode, github-copilot
model: claude-sonnet-4.6
---

Review Angular 21 code with priority ratings.

## Priority ratings
- 🔴 **Critical** — incorrect change detection, memory leaks, broken lifecycle, security
- 🟡 **Important** — missing OnPush, signal anti-patterns, unnecessary subscriptions, missing unsubscribe
- 🟢 **Suggestion** — naming, template simplification, a11y improvements, performance hints

## Review checklist

### Change Detection
- Component uses `ChangeDetectionStrategy.OnPush` where appropriate
- No direct DOM manipulation bypassing Angular
- Signals used instead of mutable properties where state reactive

### Lifecycle Hooks
- No heavy logic in `ngOnInit` that should be deferred
- `ngOnDestroy` / `DestroyRef` used to unsubscribe Observables and clean up effects
- No subscriptions without cleanup

### Templates
- New control flow syntax (`@if`, `@for`, `@switch`) used — not `*ngIf`/`*ngFor`
- `trackBy` / `track` provided for all loops
- No complex expressions in templates (extract to computed signals or methods)
- No direct property mutation inside templates

### Signals & State
- `computed()` used for derived state — not manual recalculation
- `effect()` used only for side effects (DOM sync, logging) — not for state updates
- Signal inputs (`input()`, `input.required()`) used where applicable

### Accessibility
- Interactive elements have ARIA labels or descriptive text
- Images have `alt` attributes
- Focus management handled for dynamic content

### Performance
- Large lists use virtual scrolling where applicable
- Lazy-loaded routes for feature modules
- No unnecessary `async` pipes wrapping static values
