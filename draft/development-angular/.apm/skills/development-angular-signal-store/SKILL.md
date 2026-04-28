---
name: development-angular-signal-store
description: >
  Scaffolds an NgRx Signal Store for Angular feature state management using @ngrx/signals.
  Use this skill when creating or adding a signal store, managing component or feature state,
  or implementing async effects with rxMethod — even if the user does not explicitly mention
  @ngrx/signals or NgRx.
allowed-tools: execute read edit search codebase editFiles runCommands
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

## Gotchas

- **`providedIn: 'root'` vs feature-scoped**: passing `{ providedIn: 'root' }` to `signalStore()` makes the store a singleton; omit it for component/feature-scoped instances registered via `providers: [<Feature>Store]`.
- **`rxMethod` vs `patchState`**: use `rxMethod` for Observable-based async operations (HTTP calls, debounce); use `patchState` for simple synchronous state updates.
- **Always export the store type alias**: `type <Feature>Store = InstanceType<typeof <Feature>Store>` — needed for injection typing in components and tests.
- **No direct state mutation**: always update state via `patchState(store, ...)` inside `withMethods`; never mutate state properties directly.

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
