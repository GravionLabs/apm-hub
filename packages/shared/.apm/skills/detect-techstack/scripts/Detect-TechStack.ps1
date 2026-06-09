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

function Get-IndicatorFile {
  param([string]$Path, [string]$Filter, [int]$Depth)
  Get-ChildItem -Path $Path -Recurse -Depth $Depth -Filter $Filter -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]' -and $_.FullName -notmatch '[\\/]\.git[\\/]' -and $_.FullName -notmatch '[\\/]\.opencode[\\/]' }
}

$languages = [System.Collections.Generic.List[string]]::new()
$frameworks = [System.Collections.Generic.List[string]]::new()

# --- packageManager detection ---
$packageManagers = [System.Collections.Generic.List[string]]::new()

$pkgJsonFiles = Get-IndicatorFile -Path $ProjectRoot -Filter "package.json" -Depth 3
foreach ($pkg in $pkgJsonFiles) {
  try {
    $content = Get-Content $pkg.FullName -Raw | ConvertFrom-Json -ErrorAction Stop
    if ($content.packageManager) {
      $name = ($content.packageManager -split '@')[0]
      if (-not $packageManagers.Contains($name)) {
        $packageManagers.Add($name)
      }
    }
  } catch {
    continue
  }
}

$lockfileChecks = @(
  @{ Name = "pnpm-lock.yaml"; Value = "pnpm" }
  @{ Name = "bun.lockb";      Value = "bun" }
  @{ Name = "yarn.lock";      Value = "yarn" }
  @{ Name = "package-lock.json"; Value = "npm" }
  @{ Name = "uv.lock";        Value = "uv" }
  @{ Name = "Cargo.toml";     Value = "cargo" }
)

foreach ($entry in $lockfileChecks) {
  $found = Get-IndicatorFile -Path $ProjectRoot -Filter $entry.Name -Depth 2
  if ($found -and -not $packageManagers.Contains($entry.Value)) {
    $packageManagers.Add($entry.Value)
  }
}

$csprojForPkg = Get-IndicatorFile -Path $ProjectRoot -Filter "*.csproj" -Depth 3
if ($csprojForPkg -and -not $packageManagers.Contains("dotnet")) {
  $packageManagers.Add("dotnet")
}

# --- Angular ---
$angularJson = Get-IndicatorFile -Path $ProjectRoot -Filter "angular.json" -Depth 3
if ($angularJson) {
  $frameworks.Add("angular")
  if (-not $languages.Contains("typescript")) {
    $languages.Add("typescript")
  }
}

# --- TypeScript (package.json + tsconfig.json pair in same directory) ---
$allPkgJson = Get-IndicatorFile -Path $ProjectRoot -Filter "package.json" -Depth 3
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
$hasAnyTsConfig = Get-IndicatorFile -Path $ProjectRoot -Filter "tsconfig.json" -Depth 3
if ($allPkgJson -and -not $hasAnyTsConfig) {
  if (-not $languages.Contains("javascript")) {
    $languages.Add("javascript")
  }
}

# --- Python ---
$pyIndicators = @("pyproject.toml", "requirements.txt", "setup.py")
$hasPython = $false
foreach ($indicator in $pyIndicators) {
  $found = Get-IndicatorFile -Path $ProjectRoot -Filter $indicator -Depth 3
  if ($found) {
    $hasPython = $true
    break
  }
}
if ($hasPython) {
  $languages.Add("python")
}

# --- .NET / C# ---
$csprojFiles = Get-IndicatorFile -Path $ProjectRoot -Filter "*.csproj" -Depth 3
$slnFiles = Get-IndicatorFile -Path $ProjectRoot -Filter "*.sln" -Depth 2
if ($csprojFiles -or $slnFiles) {
  $languages.Add("csharp")
  $frameworks.Add("dotnet")
}

$test = $languages | ForEach-Object { "${_}-test" }
$implementation = $languages | ForEach-Object { "${_}-implementation" }

$report = @{
  languages       = @($languages)
  frameworks      = @($frameworks)
  packageManager  = @($packageManagers)
  test            = @($test)
  implementation  = @($implementation)
}

$report | ConvertTo-Json -Compress
exit 0
