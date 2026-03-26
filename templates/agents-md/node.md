# AGENTS.md

<!-- Replace with a one-paragraph description of what this Node.js/TypeScript repository does. -->

---

## Repo Map

```
src/              — TypeScript source code
dist/             — Compiled output (auto-generated — do not edit manually)
test/             — Unit and integration tests
scripts/          — Developer tooling and automation
docs/             — Documentation
```

---

## Technology Stack

- **Runtime:** Node.js `<version>` (see `.nvmrc` or `engines` in `package.json`)
- **Language:** TypeScript `<version>`
- **Package Manager:** `npm` / `pnpm` / `yarn` (adjust as needed)
- **Test Framework:** <!-- e.g. Vitest, Jest, Mocha -->
- **Linter / Formatter:** <!-- e.g. ESLint + Prettier -->

---

## Key Conventions

- File names: `kebab-case.ts`
- No compiled `dist/` files edited manually — run `npm run build`
- Imports: use path aliases configured in `tsconfig.json`
- Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`)
- Do not commit `node_modules/` or `dist/`

---

## Build & Test Commands

```bash
npm install         # install dependencies
npm run build       # compile TypeScript → dist/
npm run test        # run test suite
npm run lint        # run ESLint
npm run format      # run Prettier
```

---

## Architecture Notes

<!-- Describe module structure, dependency injection, key patterns. -->

---

## Safe Change Checklist

- Run `npm run build` — ensure no TypeScript errors
- Run `npm run test` — all tests must pass
- Run `npm run lint` if a linter is configured
- Do not edit files in `dist/` manually
- Check `package.json` `engines` field when upgrading Node.js
