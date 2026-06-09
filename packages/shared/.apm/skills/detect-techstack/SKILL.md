---
name: detect-techstack
description: >
  Detect the project tech stack and return a JSON report with detected languages,
  package manager, and the matching <lang>-test and <lang>-implementation skills.
  Use this skill before loading language-specific skills so agents can dispatch
  to the correct sub-skills for each language/framework detected.
allowed-tools: execute shell runCommands read search codebase
compatibility: opencode, github-copilot
---

## Overview

Run the `Detect-TechStack.ps1` script at project root to identify which languages, frameworks, and package manager the project uses. The script returns a JSON object with detected technologies and the correct `<lang>-test` and `<lang>-implementation` skill names for dispatch.

Avoid verbose reasoning.

## Instructions

1. Run the detection script:
   ```powershell
   $report = & "$env:SKILL_DIR/scripts/Detect-TechStack.ps1" -ProjectRoot (Resolve-Path .)
   ```

2. The script returns JSON. Parse it:
   ```powershell
   $stack = $report | ConvertFrom-Json
   ```

3. Load the appropriate skills based on the detected languages:
   - For each language in `$stack.languages`, load `${lang}-test`, `${lang}-implementation`
   - For each framework in `$stack.frameworks`, load the framework-specific skills

4. Use `$stack.packageManager` to inform install commands.

5. Report the detection to the user.

## Output Format

The script returns JSON conforming to the schema below. If detection fails, it exits with non-zero code and writes the error to stderr.

### Success (exit 0)
```json
{
  "languages": ["typescript", "python", "csharp"],
  "frameworks": ["angular", "dotnet"],
  "packageManager": ["pnpm", "dotnet"],
  "test": ["ts-test", "py-test", "dotnet-test"],
  "implementation": ["ts-implementation", "py-implementation", "dotnet-implementation"]
}
```

### Failure (exit non-zero)
Error message written to stderr.

## Detection Rules

| File/Folder | Detects |
|---|---|
| `angular.json` (recursive, depth 3) | Angular framework |
| `package.json` + `tsconfig.json` pair (recursive, depth 3) | TypeScript |
| `pyproject.toml`, `requirements.txt`, or `setup.py` (recursive, depth 3) | Python |
| `*.csproj` or `*.sln` (recursive, depth 3 / 2) | .NET / C# |
| `package.json` alone, no `tsconfig.json` (recursive, depth 3) | JavaScript (Node.js) |
| `packageManager` field in `package.json` (highest priority) | Package manager |
| Lockfiles `pnpm-lock.yaml`, `bun.lockb`, `yarn.lock`, `package-lock.json`, `uv.lock` (recursive, depth 2) | Package manager |
| `*.csproj` | Package manager (dotnet) |
| `Cargo.toml` | Package manager (cargo) |

## Gotchas

- A project may have multiple languages (e.g. Angular frontend + .NET backend in a monorepo).
- If no tech stack is detected, the script returns `{"languages": [], "frameworks": [], "packageManager": [], "test": [], "implementation": []}`.
