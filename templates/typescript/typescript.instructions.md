---
description: 'TypeScript coding standards: strict types, ESM modules, naming conventions, async/await patterns, and modern TypeScript features'
applyTo: '**/*.ts,**/*.tsx'
---

# TypeScript Coding Conventions

## Project Setup & Tooling

- Use **strict mode** in `tsconfig.json`: `"strict": true` (enables `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, etc.).
- Use **ESM** (`"module": "NodeNext"` or `"ESNext"`) for new projects; CommonJS only for legacy compatibility.
- Use **`prettier`** for formatting and **`eslint`** with `@typescript-eslint` for linting.
- Use **`vitest`** or **`jest`** for testing; prefer `vitest` for modern projects.
- Manage dependencies with **`npm`** or **`pnpm`**; use `package.json` `engines` to declare Node.js version requirements.

## Naming Conventions

- **Variables & functions:** `camelCase`
- **Classes, interfaces, types, enums:** `PascalCase`
- **Constants:** `UPPER_SNAKE_CASE` for true compile-time constants; `camelCase` for module-level values.
- **Files:** `kebab-case.ts` (e.g., `order-service.ts`, `user-repository.ts`)
- **Test files:** `*.test.ts` or `*.spec.ts`
- **Interfaces:** do NOT prefix with `I` (prefer `UserRepository` over `IUserRepository`).
- **Type aliases vs interfaces:** use `interface` for object shapes, `type` for unions/intersections/aliases.

## Type System

- Prefer **explicit return types** on exported functions and methods.
- Use **`unknown`** instead of `any` when the type is not yet known; narrow with type guards.
- Avoid `as` type assertions — use **type guards** (`instanceof`, `typeof`, custom predicates).
- Use **generics** to avoid code duplication; constrain with `extends` when possible.
- Use **`Readonly<T>`** and **`ReadonlyArray<T>`** for immutable data structures.
- Prefer **discriminated unions** over class hierarchies for sum types.
- Use **`satisfies`** operator (TS 4.9+) for type-checked literals without widening.
- Avoid `enum` — prefer `const` objects with `as const` or union types.

## Async & Error Handling

- Always `await` Promises; never fire-and-forget without explicit error handling.
- Use `async/await` over `.then()/.catch()` chains for readability.
- Wrap async entry points in `try/catch`; re-throw with context using `new Error('msg', { cause: err })`.
- Never swallow errors silently. Log and re-throw or handle explicitly.
- Use **`AbortController`** / **`AbortSignal`** for cancellable async operations.

## Code Design Rules

- Keep functions small and focused (single responsibility).
- Prefer **pure functions** and **immutable data** — avoid mutation.
- Use **dependency injection** for testability; avoid global singletons.
- Comments explain **why**, not what.
- Avoid unnecessary abstractions; add layers only when needed for testing or multiple implementations.
- Use **barrel files** (`index.ts`) sparingly — they can cause circular dependencies.

## Module & Import Rules

- Use **path aliases** (e.g., `@/utils`) instead of long relative paths `../../../`.
- Group imports: 1) Node built-ins, 2) external packages, 3) internal aliases, 4) relative paths.
- Avoid default exports — prefer named exports for better refactoring and tree-shaking.
- Use **`import type`** for type-only imports to prevent runtime import side-effects.

## Example

```typescript
import type { User } from '@/models/user.js';
import { validateEmail } from '@/utils/validation.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

export async function createUser(
  repo: UserRepository,
  data: { name: string; email: string }
): Promise<User> {
  if (!validateEmail(data.email)) {
    throw new Error(`Invalid email address: ${data.email}`);
  }
  const user: User = { id: crypto.randomUUID(), ...data };
  await repo.save(user);
  return user;
}
```
