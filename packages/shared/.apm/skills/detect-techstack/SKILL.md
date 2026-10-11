---
name: detect-techstack
description: 'Detect the project tech stack and return a JSON report (languages, package manager, <lang>-test and <lang>-implementation skills). Use before loading language skills.'
---

Run the detection script from the project root and hand the JSON to the caller; load `<lang>-test` and `<lang>-implementation` from its `test` and `implementation` lists.

Paths to `scripts/` are relative to this skill's directory.

```powershell
pwsh scripts/Detect-TechStack.ps1 -ProjectRoot .
```

## Output (stdout, exit 0)

```json
{
  "languages": ["ts", "py", "dotnet"],
  "frameworks": ["angular"],
  "packageManager": ["pnpm", "dotnet"],
  "test": ["ts-test", "py-test", "dotnet-test"],
  "implementation": ["ts-implementation", "py-implementation", "dotnet-implementation"]
}
```

On failure the script exits non-zero with the error on stderr. No stack detected → all arrays empty.

## Fallback without PowerShell

If `pwsh` is not available → infer the stack from this table (search recursively, depth 5) and build the same JSON by hand:

| Marker | Result |
|---|---|
| `angular.json` | framework `angular`, language `ts` |
| `package.json` + `tsconfig.json` | language `ts`; `package.json` alone → `js` |
| `pyproject.toml`, `requirements.txt`, `setup.py` | language `py` |
| `*.csproj`, `*.sln`, `*.slnx` | language `dotnet`, package manager `dotnet` |
| `packageManager` field in `package.json`, else lockfile (`pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`, `package-lock.json`, `uv.lock`) | package manager |

## Gotchas

- Monorepos report several languages (e.g. Angular frontend + .NET backend); load every listed skill.
- `js` has no `js-test`/`js-implementation` skill in this hub; treat it like `ts` without type rules.
