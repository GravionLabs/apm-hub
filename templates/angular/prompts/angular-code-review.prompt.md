---
mode: agent
name: angular-code-review
description: 'Perform a structured Angular 21 code review with prioritised findings (🔴 critical, 🟡 important, 🟢 suggestion)'
tools: ['codebase', 'problems']
---

# Angular Code Review

Perform a structured, prioritised review of Angular 21 code. Does not modify files — outputs findings only.

## Priority ratings
- 🔴 **Critical** — incorrect change detection, memory leaks, broken lifecycle, security risks
- 🟡 **Important** — missing OnPush, signal anti-patterns, unmanaged subscriptions, performance issues
- 🟢 **Suggestion** — naming, template simplification, accessibility, minor improvements

## Step 1 — Identify scope

Ask the user if not clear:
- Which component(s), service(s), or module(s) to review?
- Any specific concerns (performance, correctness, accessibility)?

## Step 2 — Review each file

For each file, check:

### Change Detection
- [ ] `ChangeDetectionStrategy.OnPush` used where component state is signal-driven or input-only
- [ ] No direct DOM manipulation bypassing Angular (use `Renderer2` if needed)
- [ ] Signals used for reactive state instead of mutable class properties

### Lifecycle Hooks
- [ ] No heavy synchronous work in `ngOnInit` (defer with `afterNextRender` if needed)
- [ ] All Observables unsubscribed: `takeUntilDestroyed()` / `DestroyRef` / `async` pipe
- [ ] `effect()` used only for side effects — not for cascading state updates

### Templates
- [ ] New control flow syntax used: `@if`, `@for`, `@switch` (not legacy `*ngIf`/`*ngFor`)
- [ ] `track` expression provided for all `@for` loops
- [ ] No complex logic in templates — extract to `computed()` or methods
- [ ] No direct object/array mutation inside templates

### Signals & State
- [ ] `computed()` used for all derived values
- [ ] Signal inputs (`input()`, `input.required()`, `model()`) used where applicable
- [ ] No wrapping signals in BehaviorSubject unnecessarily

### Accessibility
- [ ] Interactive elements (buttons, links) have descriptive labels or `aria-label`
- [ ] Images have meaningful `alt` text
- [ ] Focus trap / focus management implemented for modals and overlays

### Performance
- [ ] Large lists use `@for` with `track` or virtual scrolling (`CdkVirtualScrollViewport`)
- [ ] Feature routes lazy-loaded (`loadComponent` / `loadChildren`)
- [ ] Heavy computations memoised with `computed()`

## Step 3 — Report findings

Group findings by file. For each finding:
```
[🔴/🟡/🟢] <File>:<line> — <Issue description>
   Suggestion: <how to fix>
```

End with a summary count per severity.
