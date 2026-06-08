---
name: detect-techstack
description: >
  Detect the project tech stack and return a JSON report with detected languages
  and the matching <lang>-build, <lang>-test, and <lang>-implementation skills.
  Use this skill before loading language-specific skills so agents can dispatch
  to the correct sub-skills for each language/framework detected.
allowed-tools: execute shell runCommands read search codebase
compatibility: opencode, github-copilot
---

## Overview

Run the `Detect-TechStack.ps1` script at project root to identify which languages and frameworks the project uses. The script returns a JSON object with detected technologies and the correct `<lang>-build`, `<lang>-test`, and `<lang>-implementation` skill names for dispatch.

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
   - For each language in `$stack.languages`, load `${lang}-build`, `${lang}-test`, `${lang}-implementation`
   - For each framework in `$stack.frameworks`, load the framework-specific skills

4. Report the detection to the user.

## Output Format

The script returns JSON conforming to the schema below. If detection fails, it exits with non-zero code and writes the error to stderr.

### Success (exit 0)
```json
{
  "languages": ["typescript", "python", "csharp"],
  "frameworks": ["angular", "dotnet"],
  "build": ["ts-build", "py-build", "dotnet-build"],
  "test": ["ts-test", "py-test", "dotnet-test"],
  "implementation": ["ts-implementation", "py-implementation", "dotnet-implementation"]
}
```

### Failure (exit non-zero)
Error message written to stderr.

## Detection Rules

| File/Folder | Detects |
|---|---|
| `angular.json` | Angular framework |
| `package.json` + `tsconfig.json` | TypeScript |
| `pyproject.toml` or `requirements.txt` | Python |
| `*.csproj` or `*.sln` (recursive) | .NET / C# |
| `package.json` (JS only, no tsconfig) | JavaScript (Node.js) |

## Gotchas

- A project may have multiple languages (e.g. Angular frontend + .NET backend in a monorepo).
- The script checks the project root only; it does not scan subdirectories recursively except for `*.csproj`/`*.sln`.
- If no tech stack is detected, the script returns `{"languages": [], "frameworks": [], "build": [], "test": [], "implementation": []}`.
