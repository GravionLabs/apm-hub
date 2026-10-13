<#
.SYNOPSIS
  Detect the project tech stack and output a JSON report.

.DESCRIPTION
  Scans the project root recursively for indicator files and returns a JSON object
  listing detected languages, frameworks, packageManager, and the matching <lang>-test
  and <lang>-implementation skills.

.PARAMETER ProjectRoot
  Path to the project root directory.

.PARAMETER NoCache
  Ignore `.agents/techstack.json`: recompute the report and rewrite the cache.

.OUTPUTS
  JSON string to stdout. Non-zero exit code on failure.
#>
param(
  [Parameter(Mandatory)][string]$ProjectRoot,
  [switch]$NoCache
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

# --- cache: .agents/techstack.json = report + manifest_hash ---
$rootFull = (Resolve-Path $ProjectRoot).Path
$cacheFile = Join-Path $rootFull '.agents/techstack.json'
$manifestFilters = @(
  'package.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'package-lock.json', 'tsconfig.json',
  'angular.json', 'pyproject.toml', 'requirements.txt', 'setup.py', 'uv.lock', 'Cargo.toml',
  '*.csproj', '*.sln', '*.slnx'
)
$manifestEntries = foreach ($f in $manifestFilters) {
  foreach ($file in (Get-IndicatorFile -Path $rootFull -Filter $f -Depth 5)) {
    $rel = [System.IO.Path]::GetRelativePath($rootFull, $file.FullName) -replace '\\', '/'
    "${rel}:$((Get-FileHash -Path $file.FullName -Algorithm SHA256).Hash)"
  }
}
$manifestList = (@($manifestEntries) | Sort-Object -Unique -CaseSensitive) -join "`n"
$sha = [System.Security.Cryptography.SHA256]::Create()
$manifestHash = ([System.BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($manifestList))) -replace '-', '').ToLowerInvariant()

if (-not $NoCache -and (Test-Path $cacheFile -PathType Leaf)) {
  try {
    $cached = Get-Content $cacheFile -Raw | ConvertFrom-Json -ErrorAction Stop
    if ($cached.manifest_hash -eq $manifestHash -and $null -ne $cached.languages) {
      (Get-Content $cacheFile -Raw).Trim()
      exit 0
    }
  } catch { }
}

$languages = [System.Collections.Generic.List[string]]::new()
$frameworks = [System.Collections.Generic.List[string]]::new()

# --- packageManager detection ---
$packageManagers = [System.Collections.Generic.List[string]]::new()

$pkgJsonFiles = Get-IndicatorFile -Path $ProjectRoot -Filter "package.json" -Depth 5
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
  $found = Get-IndicatorFile -Path $ProjectRoot -Filter $entry.Name -Depth 5
  if ($found -and -not $packageManagers.Contains($entry.Value)) {
    $packageManagers.Add($entry.Value)
  }
}

$csprojForPkg = Get-IndicatorFile -Path $ProjectRoot -Filter "*.csproj" -Depth 5
if ($csprojForPkg -and -not $packageManagers.Contains("dotnet")) {
  $packageManagers.Add("dotnet")
}

# --- Angular ---
$angularJson = Get-IndicatorFile -Path $ProjectRoot -Filter "angular.json" -Depth 5
if ($angularJson) {
  $frameworks.Add("angular")
  if (-not $languages.Contains("typescript")) {
    $languages.Add("typescript")
  }
}

# --- TypeScript (package.json + tsconfig.json pair in same directory) ---
$allPkgJson = Get-IndicatorFile -Path $ProjectRoot -Filter "package.json" -Depth 5
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
$hasAnyTsConfig = Get-IndicatorFile -Path $ProjectRoot -Filter "tsconfig.json" -Depth 5
if ($allPkgJson -and -not $hasAnyTsConfig) {
  if (-not $languages.Contains("javascript")) {
    $languages.Add("javascript")
  }
}

# --- Python ---
$pyIndicators = @("pyproject.toml", "requirements.txt", "setup.py")
$hasPython = $false
foreach ($indicator in $pyIndicators) {
  $found = Get-IndicatorFile -Path $ProjectRoot -Filter $indicator -Depth 5
  if ($found) {
    $hasPython = $true
    break
  }
}
if ($hasPython) {
  $languages.Add("python")
}

# --- .NET / C# ---
$csprojFiles = Get-IndicatorFile -Path $ProjectRoot -Filter "*.csproj" -Depth 5
$slnFiles = Get-IndicatorFile -Path $ProjectRoot -Filter "*.sln" -Depth 5
$slnxFiles = Get-IndicatorFile -Path $ProjectRoot -Filter "*.slnx" -Depth 5
if ($csprojFiles -or $slnFiles -or $slnxFiles) {
  $languages.Add("csharp")
  $frameworks.Add("dotnet")
}

$langPrefixMap = @{
  typescript = "ts"
  python     = "py"
  csharp     = "dotnet"
  javascript = "js"
}

for ($i = 0; $i -lt $languages.Count; $i++) {
  if ($langPrefixMap.ContainsKey($languages[$i])) {
    $languages[$i] = $langPrefixMap[$languages[$i]]
  }
}

$test = $languages | ForEach-Object { "${_}-test" }
$implementation = $languages | ForEach-Object { "${_}-implementation" }

$report = [ordered]@{
  languages       = @($languages)
  frameworks      = @($frameworks)
  packageManager  = @($packageManagers)
  test            = @($test)
  implementation  = @($implementation)
  manifest_hash   = $manifestHash
}

$json = $report | ConvertTo-Json -Compress

try {
  New-Item -ItemType Directory -Path (Split-Path $cacheFile) -Force | Out-Null
  Set-Content -Path $cacheFile -Value $json -Encoding utf8NoBOM
  # keep .agents/ out of git when it is not already ignored
  $null = git -C $rootFull rev-parse --is-inside-work-tree 2>$null
  if ($LASTEXITCODE -eq 0) {
    git -C $rootFull check-ignore -q .agents/techstack.json 2>$null
    if ($LASTEXITCODE -ne 0) {
      $exclude = git -C $rootFull rev-parse --path-format=absolute --git-path info/exclude 2>$null
      if ($exclude) {
        New-Item -ItemType Directory -Path (Split-Path $exclude) -Force | Out-Null
        Add-Content -Path $exclude -Value '.agents/'
      }
    }
  }
} catch {
  # the cache is an optimisation; never fail detection because of it
}

$json
exit 0
