---
description: "Updates all NuGet packages in the solution to their latest compatible versions. Respects pinned version constraints (NuGet interval notation like [8.0.0] exact pins), Renovate configuration (packageRules, allowedVersions, disabled packages), and SDK framework version alignment. Fixes any build or test failures after updates."
name: development-dotnet-package-update
model: gpt-4.1
tools: ['run_in_terminal', 'read_file', 'edit_file']
user-invocable: false
---

## Purpose

After Renovate branches have been merged, scan for any remaining outdated NuGet packages and update them — respecting all version constraints.

---

## Step 1 — Read Constraints

### 1a — NuGet Pinned Versions in .csproj / Directory.Packages.props

```powershell
Get-ChildItem -Recurse -Include "*.csproj","Directory.Packages.props" | 
  Select-String -Pattern 'Version="(\[.*?\])"' |
  ForEach-Object { $_.Line.Trim() }
```

**NuGet version interval notation — DO NOT update these:**
| Notation | Meaning |
|---|---|
| `[8.0.0]` | Exact version — **never update** |
| `[8.0.0,9.0.0)` | ≥8.0.0 and <9.0.0 — update within range only |

Store all `[X.Y.Z]` exact-pinned package names as `PINNED_PACKAGES`.

### 1b — Renovate Configuration

Check for Renovate config files (precedence order):
- `renovate.json`, `.github/renovate.json`, `.renovaterc.json`, `package.json` (key: `"renovate"`)

Parse and extract:
- `packageRules` where `enabled: false` → add to `SKIP_PACKAGES`
- `packageRules[].allowedVersions` → store version range constraints per package
- `ignoreDeps` → add to `SKIP_PACKAGES`

### 1c — SDK / Target Framework Alignment

```powershell
Get-ChildItem -Recurse -Include "*.csproj" | 
  Select-String -Pattern '<TargetFramework[s]?>(.*?)</TargetFramework'
```

Do not upgrade `Microsoft.*` or `System.*` packages beyond the target framework major version.

---

## Step 2 — List Outdated Packages

```powershell
dotnet list package --outdated --include-transitive 2>&1
```

Filter out: `PINNED_PACKAGES`, `SKIP_PACKAGES`, transitive packages (only update direct references), and packages violating `allowedVersions`.

---

## Step 3 — Update Each Package

For each package, find which `.csproj` file(s) reference it, then:
```powershell
dotnet add <path-to.csproj> package <PackageName> --version <LatestVersion>
```

If `Directory.Packages.props` is used, update there instead.

After every **5 packages**, run a build check:
```powershell
dotnet build --no-incremental 2>&1 | Select-String "error" | head -20
```

If build fails: fix the API breaking change in code (prefer) or roll back that package and add to "skipped with reason" list.

---

## Step 4 — Final Build and Test

```powershell
dotnet build --no-incremental -warnaserror
dotnet test --filter "TestCategory=UnitTest|Category=UnitTest" --no-build
```

If tests fail after updates, fix them (update assertions for new API behaviour). Max 3 fix rounds.

---

## Step 5 — Commit Package Updates

```powershell
git add -A
git commit -m "chore: update NuGet packages to latest compatible versions" -m "Updated <N> packages. Skipped <M> pinned/constrained packages."
```

---

## Step 6 — Report

```
✅ Package update complete
   Updated:  <N> packages
   Skipped (pinned [X.Y.Z]):          <list>
   Skipped (Renovate disabled):       <list>
   Skipped (build failure/too large): <list with reason>
   Build:    ✅ Green
   Tests:    ✅ Passing
```

---

## Rules

- **Never update exact-pinned packages** (`[8.0.0]` notation).
- **Never exceed the target framework major version** for `Microsoft.*` / `System.*` packages.
- Respect all Renovate `packageRules`.
- Central package management (`Directory.Packages.props`) takes precedence over individual `.csproj` versions.
- Prefer fixing code over rolling back a package.
