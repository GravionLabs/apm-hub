---
name: detect-techstack
description: 'Detect the project tech stack and return a JSON report with its language skills. Use before loading language skills.'
---

Run the detection script from the project root and hand the JSON to the caller; load `<lang>-test` and `<lang>-implementation` from its `test` and `implementation` lists.

Return contract: the JSON object below and nothing else — no file listings, no reasoning. The skill runs in the caller's context (the script needs a shell, which forked `explorer`/`reviewer` agents do not reliably have).

Paths to `scripts/` are relative to this skill's directory.

```powershell
pwsh scripts/Detect-TechStack.ps1 -ProjectRoot .            # cached
pwsh scripts/Detect-TechStack.ps1 -ProjectRoot . -NoCache   # force a fresh scan
```

## Cache

The report is stored in `<state>/techstack.json` (state directory: `DROMOS_STATE_DIR`, else `<git common dir>/agents`, shared by all worktrees; the printed JSON adds `state_dir`, `null` outside a repository where nothing is cached) together with `manifest_hash`: a SHA256 over the sorted relative paths and content hashes of the manifests the script reads (`package.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`, `package-lock.json`, `tsconfig.json`, `angular.json`, `pyproject.toml`, `requirements.txt`, `setup.py`, `uv.lock`, `Cargo.toml`, `*.csproj`, `*.sln`, `*.slnx`) plus a script version, so rule changes invalidate old caches. Same hash → the file is printed as is; any manifest added, removed or edited → recomputed and rewritten. A cache without `languages`, `test` or `implementation` is ignored; the write is atomic. A symlinked state directory is never used. Delete the file or pass `-NoCache` to force a rescan.

Run it with a shell in the caller's context. Output not a JSON object with a `languages` array (empty output, `[]`, prose) → rerun once with `-NoCache`; still invalid → say so and ask before guessing the stack.

## Output (stdout, exit 0)

```json
{
  "languages": ["ts", "py", "dotnet"],
  "frameworks": ["angular"],
  "packageManager": ["pnpm", "dotnet"],
  "test": ["ts-test", "py-test", "dotnet-test"],
  "implementation": ["ts-implementation", "py-implementation", "dotnet-implementation"],
  "tools": ["vitest", "biome", "cargo"],
  "manifest_hash": "<sha256>",
  "state_dir": "/abs/repo/.git/agents"
}
```

`tools` is found by config files in the project root: `vitest` (`vitest.config.*`, `vite.config.*` with a `test` block, or `vitest` in `package.json`), `biome` (`biome.json[c]`), `eslint` (`eslint.config.*`, `.eslintrc*`), `prettier` (`.prettierrc*`, `prettier.config.*`), `jest` (`jest.config.*`), `pytest` (`pytest.ini`, `[tool.pytest` in `pyproject.toml`), `cargo` (`Cargo.toml`). It is part of the cache hash.

`state_dir` is the absolute `<state>` path the other skills and agents use (defined here); the script no longer edits `.git/info/exclude`. On failure the script exits non-zero with the error on stderr. No stack detected → all arrays empty.

## Worktree onboarding

`scripts/Enable-Worktrees.ps1` makes a repository ignore `.worktrees/` (one-time, idempotent, changes go into a normal PR). It takes the tech-stack JSON above (`-TechStack` path or object, never re-detects) and `-Root` (default: git top level).

```powershell
pwsh scripts/Enable-Worktrees.ps1 -TechStack stack.json          # apply
pwsh scripts/Enable-Worktrees.ps1 -TechStack stack.json -Check   # no writes, exit 1 on drift
```

Rules: `.gitignore` and `.dockerignore` get `.worktrees/`; `biome.json` gets `vcs` (`enabled`, `clientKind: git`, `useIgnoreFile`) and is formatted; a Vitest probe under `.worktrees/__probe__` (removed afterwards) decides whether a `hints` entry with the `exclude` snippet is needed; `eslint.config.*` yields a hint only. Output: `{ root, changed: [path], hints: [{file, message, snippet}], ok }`; check mode exits 1 when a change or hint is pending.

## Fallback without PowerShell

If `pwsh` is not available → infer the stack from this table (search recursively, depth 5) and build the same JSON by hand:

| Marker | Result |
|---|---|
| `angular.json` | framework `angular`, language `ts` |
| `package.json` + `tsconfig.json` | language `ts`; `package.json` alone → `js` |
| `pyproject.toml`, `requirements.txt`, `setup.py` | language `py` |
| `*.csproj`, `*.sln`, `*.slnx` | language `dotnet`, package manager `dotnet` |
| `Cargo.toml` | language `rust` (skills `rust-test`, `rust-implementation`) |
| `src-tauri/tauri.conf.json` or `.json5` | framework `tauri` (next to `rust` and usually `ts`) |
| `packageManager` field in `package.json`, else lockfile (`pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`, `package-lock.json`, `uv.lock`) | package manager |

## Gotchas

- Monorepos report several languages (e.g. Angular frontend + .NET backend); load every listed skill.
- A skill named in `test` or `implementation` that is not installed (stacks are installed per project): report "install `<stack>@apm-hub` in this project's `apm.yml` or run `/apm-install`" (`ts`, `py`, `dotnet`; `ng` for `angular`, `rust`), never fail silently.
- `js` has no `js-test`/`js-implementation` skill in this hub; treat it like `ts` without type rules.
