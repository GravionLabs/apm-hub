---
name: gh-agents-md
description: >
  Analyzes a repository and generates a complete AGENTS.md file. Use this skill
  when asked to create, generate, or bootstrap an AGENTS.md — even if the user
  just says "add an AGENTS.md" or "document the build and test commands." Supports
  dotnet, node, python, github-actions, and generic project types.
allowed-tools: execute read edit search codebase editFiles runCommands
model: claude-sonnet-4.6
---

Generate a complete `AGENTS.md` file for the repository.

## What this skill does
Detects the project type from indicator files, then creates a tailored `AGENTS.md` with build commands, test commands, code style guidance, and PR conventions.

## Steps
1. Detect project type from indicator files:
   | Indicator | Type |
   | `*.csproj`, `*.sln`, `Directory.Packages.props` | `dotnet` |
   | `package.json`, `tsconfig.json` | `node` |
   | `pyproject.toml`, `setup.py`, `requirements.txt` | `python` |
   | `.github/workflows/` with nested `action.yml` | `github-actions` |
   If multiple indicators match, pick the dominant one.
2. Read `README.md`, `CONTRIBUTING.md`, and CI workflow files for context
3. Generate `AGENTS.md` with these sections:
   - **Build** — commands to build the project
   - **Test** — commands to run tests (with single-test example)
   - **Lint** — commands to check code style
   - **Code style** — key conventions (naming, formatting, file structure)
   - **PR conventions** — branch naming, commit message format, PR checklist
4. Write the file to the repository root as `AGENTS.md`

## Constraints
- Tailor commands to the actual project — do not use generic placeholders
- If build/test commands are ambiguous, read `package.json` scripts or `.github/workflows/` to infer them

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
