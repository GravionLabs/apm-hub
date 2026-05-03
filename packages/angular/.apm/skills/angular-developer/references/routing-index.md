# Angular Routing Overview

Use this file to decide which routing reference to load next. `SKILL.md` already lists the direct routing references, so this page stays high-level and does not link deeper into the reference tree.

## Routing Topics

- **Route definitions:** URL paths, parameters, wildcards, and redirects.
- **Loading strategies:** Eager loading, lazy loading, and route-level code splitting.
- **Outlets and navigation:** `RouterLink`, `Router.navigate`, nested outlets, and named outlets.
- **Route protection and data:** Guards, resolvers, and preloading decisions.
- **Lifecycle and rendering:** Router events, rendering strategies, hydration, and view transitions.

## When to Load Specific References

- If the task is about URL structure or redirects, load `define-routes.md`.
- If the task is about lazy loading or bundle boundaries, load `loading-strategies.md`.
- If the task is about nested layouts or named outlets, load `show-routes-with-outlets.md`.
- If the task is about navigation APIs, load `navigate-to-routes.md`.
- If the task is about access control, load `route-guards.md`.
- If the task is about pre-fetching route data, load `data-resolvers.md`.
- If the task is about debugging navigations, load `router-lifecycle.md`.
- If the task is about SSR, prerendering, or hydration, load `rendering-strategies.md`.
- If the task is about visual route transitions, load `route-animations.md`.
