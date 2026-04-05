---
name: create-dotnet-solution
description: 'Scaffold a new .NET solution with src/test layout, Central Package Management (Directory.Packages.props), Directory.Build.props, and .editorconfig. Supports both NuGet libraries (multi-target) and applications (webapi/worker/console).'
allowed-tools: runCommands editFiles codebase
---

Scaffold a new .NET solution following the standard project structure.

## Stack
- **CLI:** `dotnet` SDK (key commands: `dotnet new`, `dotnet sln add`, `dotnet build`)
- **Package manager:** NuGet (via `Directory.Packages.props` — Central Package Management)
- **Scripts:** `pwsh` (PowerShell Core, cross-platform) for the scaffold script

Creates a solution with `src/` and `test/` directories, Central Package Management, shared build configuration, and an `.editorconfig` — ready for development.

## Steps
1. **Ask first:**
   - Solution name
   - **Library** (NuGet package, multi-target `net10.0;net9.0;net8.0`) or **Application** (webapi / worker / console / classlib, single `net10.0`)?
   - Project template (classlib / webapi / worker / console / grpc)
   - Additional NuGet packages needed

2. **Run the scaffold script** (recommended — one command creates the full structure):
   ```powershell
   pwsh scripts/New-Solution.ps1 -SolutionName <Name> -ProjectType <template> -OutputType <library|app>
   ```
   The script creates the directory structure, solution, projects, copies all template files, and runs `dotnet build`.

3. **Alternatively — manual steps:**
   ```bash
   mkdir <SolutionName> && cd <SolutionName>
   dotnet new sln -n <SolutionName>
   mkdir src test
   dotnet new <template> -n <SolutionName> -o src/<SolutionName>
   dotnet new nunit -n <SolutionName>.Tests -o test/<SolutionName>.Tests
   dotnet sln add src/<SolutionName> test/<SolutionName>.Tests
   dotnet add test/<SolutionName>.Tests reference src/<SolutionName>
   ```

4. Copy template files from `templates/` to the solution root (see `## Templates` below)

5. **Adjust `Directory.Build.props`** based on output type:
   - Library → keep `<TargetFrameworks>net10.0;net9.0;net8.0</TargetFrameworks>` (multi-target)
   - Application → change to `<TargetFramework>net10.0</TargetFramework>` (single target)

6. **Copy the appropriate CI workflow:**
   - Library → `.github/workflows/ci-library.yml` → rename to `ci.yml`, update `verify-package-files`
   - Application → `.github/workflows/ci-app.yml` → rename to `ci.yml`

7. Strip `Version` attributes from all `.csproj` files (CPM manages versions via `Directory.Packages.props`)

8. Add any additional packages to `Directory.Packages.props` + reference them without `Version` in `.csproj`

9. Run `dotnet build` to verify

## Templates
Starter files are available in `templates/` alongside this skill and get copied automatically when installing the plugin:

| File | Purpose |
|---|---|
| `Directory.Build.props` | Shared MSBuild: `LangVersion=Latest`, `GenerateDocumentationFile`, `NoWarn`. Multi-target for libraries; switch to single `<TargetFramework>` for apps. |
| `Directory.Packages.props` | CPM stub with all NUnit 4 test packages (NUnit, NSubstitute, Shouldly, coverlet, NUnit.Analyzers) + `Microsoft.SourceLink.GitHub` |
| `src/Directory.Build.props` | Imports root props, sets `OutputPath` |
| `test/Directory.Build.props` | Imports root, `IsPackable=false`, adds all test `PackageReference`s without versions, global `Using NUnit.Framework` |
| `.editorconfig` | Comprehensive C# style: file-scoped namespaces, primary constructors, `_camelCase` fields, analyzer severities, ReSharper/Rider support |
| `.github/workflows/ci-library.yml` | NuGet library CI via `GravionLabs/ci` reusable workflow (build, test, pack, publish) |
| `.github/workflows/ci-app.yml` | Application CI: `dotnet build` + `dotnet test` with test results reporter |

## Scripts
- **`scripts/New-Solution.ps1`** — Full scaffold automation. Run with `pwsh`:
  ```powershell
  pwsh scripts/New-Solution.ps1 -SolutionName "Acme.Core" -ProjectType classlib -OutputType library
  pwsh scripts/New-Solution.ps1 -SolutionName "Acme.Api" -ProjectType webapi -OutputType app
  ```
  Creates directories, solution, projects, copies all template files, strips Version attributes, and verifies the build.

## Constraints
- All package versions in `Directory.Packages.props` — never in individual `.csproj` files
- Solution must build cleanly before task is complete
- Library projects should multi-target; application projects use a single target framework

## Tips
> **Use the `task` tool** for the scaffolding steps — they are mechanical and don't require reasoning. Example: `#task pwsh scripts/New-Solution.ps1 -SolutionName "Acme.Core" -OutputType library`
> This allows routing scaffold work to a cheaper, faster model.
