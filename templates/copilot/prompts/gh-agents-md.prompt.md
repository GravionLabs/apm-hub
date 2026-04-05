---
mode: agent
description: 'Analyze the repository and generate a complete AGENTS.md file tailored to the project type (dotnet, node, python, github-actions, or generic).'
tools: ['codebase', 'editFiles', 'runCommands', 'search']
---
Analyze the current repository and generate a complete, filled-in `AGENTS.md` file.

## Step 1 — Detect project type

Look for these indicator files to determine the project type:

| Indicator | Type |
| :--- | :--- |
| `*.csproj`, `*.sln`, `*.slnx`, `global.json`, `Directory.Packages.props` | `dotnet` |
| `package.json`, `tsconfig.json`, `.nvmrc` | `node` |
| `pyproject.toml`, `setup.py`, `requirements.txt`, `uv.lock` | `python` |
| `.github/workflows/` with `action.yml` files in subdirectories | `github-actions` |

If multiple indicators are present, pick the dominant one.
If no indicator is found, use `generic`.

## Step 2 — Gather information

Collect the following from the repository:

- **Directory structure** (top 2 levels)
- **Project name and description** (from `README.md`, `package.json`, `pyproject.toml`, or `*.csproj`)
- **Technology versions** (runtime, language, SDK, package manager)
- **Test framework and conventions** (look for test directories, config files, existing test files)
- **Build and test commands** (from `package.json` scripts, `Makefile`, `README.md`, CI workflow files)
- **Key conventions** (naming patterns, architectural decisions visible in existing code)
- **Auto-generated files or directories** that must not be edited manually

## Step 3 — Generate AGENTS.md

Use the detected type to select the appropriate template structure:

- `dotnet` → use `templates/agents-md/dotnet.md` as structure
- `node` → use `templates/agents-md/node.md` as structure
- `python` → use `templates/agents-md/python.md` as structure
- `github-actions` → use `templates/agents-md/github-actions.md` as structure
- `generic` → use `templates/agents-md/generic.md` as structure

Fill in **all placeholder comments** with concrete values from the repository.
Remove any sections that are not applicable.
Add additional sections if important conventions are found that don't fit the template.

## Step 4 — Write the file

Write the generated content to `AGENTS.md` in the **repository root**.

If an `AGENTS.md` already exists, show a diff and ask for confirmation before overwriting.
