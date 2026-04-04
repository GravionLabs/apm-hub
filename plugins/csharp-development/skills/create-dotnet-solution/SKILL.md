---
name: create-dotnet-solution
description: 'Scaffold a new .NET solution with src/test layout, Central Package Management (Directory.Packages.props), Directory.Build.props, and .editorconfig.'
allowed-tools: runCommands editFiles codebase
---

Scaffold a new .NET solution following the standard project structure.

## What this skill does
Creates a solution with `src/` and `test/` directories, Central Package Management, shared build configuration, and an `.editorconfig` — ready for development.

## Steps
1. Ask: solution name, project type (classlib / webapi / worker / console), NuGet packages needed
2. Create solution and directory structure:
   ```bash
   mkdir <SolutionName> && cd <SolutionName>
   dotnet new sln -n <SolutionName>
   mkdir src test
   dotnet new <template> -n <SolutionName> -o src/<SolutionName>
   dotnet new nunit -n <SolutionName>.Tests -o test/<SolutionName>.Tests
   dotnet sln add src/<SolutionName> test/<SolutionName>.Tests
   ```
3. Create `Directory.Packages.props` with `<ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>` and version entries for all packages
4. Create `Directory.Build.props` with `<Nullable>enable</Nullable>`, `<ImplicitUsings>enable</ImplicitUsings>`, `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>`
5. Create `.editorconfig` with C# formatting rules
6. Update `.csproj` files to use `<PackageReference>` without `Version` attributes
7. Run `dotnet build` to verify

## Constraints
- All package versions in `Directory.Packages.props` — never in individual `.csproj` files
- Solution must build cleanly before task is complete
