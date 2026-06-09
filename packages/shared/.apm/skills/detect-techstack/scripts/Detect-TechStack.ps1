<#
.SYNOPSIS
  Detect the project tech stack and output a JSON report.

.DESCRIPTION
  Scans the project root recursively for indicator files and returns a JSON object
  listing detected languages, frameworks, packageManager, and the matching <lang>-test
  and <lang>-implementation skills.

.PARAMETER ProjectRoot
  Path to the project root directory. Defaults to the current directory.

.OUTPUTS
  JSON string to stdout. Non-zero exit code on failure.
#>
param(
  [Parameter(Mandatory)][string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $ProjectRoot -PathType Container)) {
  Write-Error "ProjectRoot '$ProjectRoot' does not exist or is not a directory."
  exit 1
}

$languages = [System.Collections.Generic.List[string]]::new()
$frameworks = [System.Collections.Generic.List[string]]::new()

# --- packageManager detection (depth 2) ---
$packageManager = $null

$pkgJsonFiles = Get-ChildItem -Path $ProjectRoot -Recurse -Depth 3 -Filter "package.json" -ErrorAction SilentlyContinue
if ($pkgJsonFiles) {
  foreach ($pkg in $pkgJsonFiles) {
    try {
      $content = Get-Content $pkg.FullName -Raw | ConvertFrom-Json -ErrorAction Stop
      if ($content.packageManager) {
        $packageManager = ($content.packageManager -split '@')[0]
        break
      }
    } catch {
      continue
    }
  }
}

if (-not $packageManager) {
  $lockfilePriority = @(
    @{ Name = "pnpm-lock.yaml"; Value = "pnpm" }
    @{ Name = "bun.lockb";      Value = "bun" }
    @{ Name = "yarn.lock";      Value = "yarn" }
    @{ Name = "package-lock.json"; Value = "npm" }
    @{ Name = "uv.lock";        Value = "uv" }
    @{ Name = "Cargo.toml";     Value = "cargo" }
  )

  foreach ($entry in $lockfilePriority) {
    $found = Get-ChildItem -Path $ProjectRoot -Recurse -Depth 2 -Filter $entry.Name -ErrorAction SilentlyContinue
    if ($found) {
      $packageManager = $entry.Value
      break
    }
  }
}

if (-not $packageManager) {
  $csprojForPkg = Get-ChildItem -Path $ProjectRoot -Recurse -Depth 3 -Filter "*.csproj" -ErrorAction SilentlyContinue
  if ($csprojForPkg) {
    $packageManager = "dotnet"
  }
}

# --- Angular ---
$angularJson = Get-ChildItem -Path $ProjectRoot -Recurse -Depth 3 -Filter "angular.json" -ErrorAction SilentlyContinue
if ($angularJson) {
  $frameworks.Add("angular")
  if (-not $languages.Contains("typescript")) {
    $languages.Add("typescript")
  }
}

# --- TypeScript (package.json + tsconfig.json pair in same directory) ---
$allPkgJson = Get-ChildItem -Path $ProjectRoot -Recurse -Depth 3 -Filter "package.json" -ErrorAction SilentlyContinue
$hasTypescript = $false
foreach ($pkg in $allPkgJson) {
  $tsConfig = Join-Path $pkg.Directory.FullName "tsconfig.json"
  if (Test-Path $tsConfig) {
    $hasTypescript = $true
    break
  }
}
if ($hasTypescript) {
  if (-not $languages.Contains("typescript")) {
    $languages.Add("typescript")
  }
}

# --- JavaScript (package.json exists but no tsconfig.json anywhere) ---
$hasAnyTsConfig = Get-ChildItem -Path $ProjectRoot -Recurse -Depth 3 -Filter "tsconfig.json" -ErrorAction SilentlyContinue
if ($allPkgJson -and -not $hasAnyTsConfig) {
  if (-not $languages.Contains("javascript")) {
    $languages.Add("javascript")
  }
}

# --- Python ---
$pyIndicators = @("pyproject.toml", "requirements.txt", "setup.py")
$hasPython = $false
foreach ($indicator in $pyIndicators) {
  $found = Get-ChildItem -Path $ProjectRoot -Recurse -Depth 3 -Filter $indicator -ErrorAction SilentlyContinue
  if ($found) {
    $hasPython = $true
    break
  }
}
if ($hasPython) {
  $languages.Add("python")
}

# --- .NET / C# ---
$csprojFiles = Get-ChildItem -Path $ProjectRoot -Recurse -Depth 3 -Filter "*.csproj" -ErrorAction SilentlyContinue
$slnFiles = Get-ChildItem -Path $ProjectRoot -Recurse -Depth 2 -Filter "*.sln" -ErrorAction SilentlyContinue
if ($csprojFiles -or $slnFiles) {
  $languages.Add("csharp")
  $frameworks.Add("dotnet")
}

$test = $languages | ForEach-Object { "${_}-test" }
$implementation = $languages | ForEach-Object { "${_}-implementation" }

$report = @{
  languages       = @($languages)
  frameworks      = @($frameworks)
  packageManager  = $packageManager
  test            = @($test)
  implementation  = @($implementation)
}

$report | ConvertTo-Json -Compress
exit 0
