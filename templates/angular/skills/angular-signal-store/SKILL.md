---
name: angular-signal-store
description: 'Create an NgRx Signal Store for Angular state management with state, computed signals, updaters, and effects. Follows @ngrx/signals patterns.'
allowed-tools: editFiles codebase runCommands
model: claude-sonnet-4.6
---

Scaffold an NgRx Signal Store for Angular feature state management.

## What this skill does
Creates a `<feature>.store.ts` (and optionally `<feature>.models.ts`) using `@ngrx/signals` with typed state, computed signals, updaters, and async effects.

## Steps
1. Ask if not provided: feature name, state shape (fields + types + defaults), scope (`root` or feature), whether async operations (API calls) are needed
2. Create `<feature>.models.ts` with state interface and any supporting types
3. Create `<feature>.store.ts`:
   ```typescript
   export const <Feature>Store = signalStore(
     { providedIn: 'root' },          // or omit for feature-scoped
     withState<FeatureState>(initialState),
     withComputed((store) => ({...})),
     withMethods((store) => ({...})),
     withHooks({ onInit(store) {...} })
   );
   ```
4. For async operations: use `rxMethod` or `patchState` with loading/error state fields
5. Register in the component or feature providers as needed

## Constraints
- Use `@ngrx/signals` — not `@ngrx/store` (Redux-style)
- Keep store files focused on a single feature slice
- Prefer `withComputed` for derived values over manual subscriptions
- Export the store type: `type <Feature>Store = InstanceType<typeof <Feature>Store>`
