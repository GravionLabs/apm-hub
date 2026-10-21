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
  Ignore `<state>/techstack.json`: recompute the report and rewrite the cache.

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

# --- cache: <state>/techstack.json = report + manifest_hash ---
$rootFull = (Resolve-Path $ProjectRoot).Path
# BEGIN Resolve-StateDir (identical in every script that defines it; test/repo/state-dir-resolver.test.ts)
function Resolve-StateDir {
  if ($env:DROMOS_STATE_DIR) { return [IO.Path]::GetFullPath($env:DROMOS_STATE_DIR, (Get-Location).Path) }
  $common = $null
  try { $common = "$(& git -C (Get-Location).Path rev-parse --path-format=absolute --git-common-dir 2>$null)".Trim() } catch { $common = $null }
  if ($LASTEXITCODE -ne 0 -or -not $common) { throw 'No state directory: not inside a git repository (set DROMOS_STATE_DIR)' }
  [IO.Path]::GetFullPath((Join-Path $common 'agents'))
}
# END Resolve-StateDir
# the state directory of the project (git common dir, shared by worktrees); outside a repository detection still works, without cache
$agentsDir = $null
Push-Location -LiteralPath $rootFull
try { $agentsDir = Resolve-StateDir } catch { $agentsDir = $null } finally { Pop-Location }
$cacheFile = if ($agentsDir) { Join-Path $agentsDir 'techstack.json' } else { $null }
# a symlinked state directory is never read from or written through; the report is printed without caching
$agentsItem = if ($agentsDir) { Get-Item -LiteralPath $agentsDir -Force -ErrorAction SilentlyContinue } else { $null }
$agentsLinked = [bool]($agentsItem -and $agentsItem.LinkType)
$agentsUsable = [bool]($agentsDir -and -not $agentsLinked)

function Out-Report([string]$Json) {
  # state_dir is added on output (cache hit or not); the cache file itself does not store it
  $o = $Json | ConvertFrom-Json
  $o | Add-Member -NotePropertyName state_dir -NotePropertyValue $agentsDir -Force
  $o | ConvertTo-Json -Compress
}

function Test-CacheEntry {
  # every entry must be a lowercase token like the script itself produces (ts, ts-test, pnpm, ...)
  param($Value)
  if ($null -eq $Value) { return $false }
  if ($Value -is [string] -or $Value -isnot [System.Collections.IEnumerable]) { return $false }
  foreach ($v in $Value) {
    if ($v -isnot [string] -or $v -cnotmatch '^[a-z0-9-]+$') { return $false }
  }
  return $true
}
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
$schemaVersion = 'techstack-v3'
$manifestList = $schemaVersion + "`n" + ((@($manifestEntries) | Sort-Object -Unique -CaseSensitive) -join "`n")
$sha = [System.Security.Cryptography.SHA256]::Create()
$manifestHash = ([System.BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($manifestList))) -replace '-', '').ToLowerInvariant()

if (-not $NoCache -and $agentsUsable -and (Test-Path $cacheFile -PathType Leaf)) {
  try {
    $cached = Get-Content $cacheFile -Raw | ConvertFrom-Json -ErrorAction Stop
    $names = @($cached.PSObject.Properties.Name)
    $shapeOk = $true
    foreach ($key in 'languages', 'test', 'implementation') {
      if (-not ($names -contains $key) -or -not (Test-CacheEntry $cached.$key)) { $shapeOk = $false }
    }
    foreach ($key in 'frameworks', 'packageManager') {
      if (($names -contains $key) -and -not (Test-CacheEntry $cached.$key)) { $shapeOk = $false }
    }
    if ($shapeOk -and $cached.manifest_hash -eq $manifestHash) {
      Out-Report (Get-Content $cacheFile -Raw).Trim()
      exit 0
    }
  } catch { }
}

$languages = [System.Collections.Generic.List[string]]::new()
$frameworks = [System.Collections.Generic.List[string]]::new()

# --- packageManager detection ---
$packageManagers = [System.Collections.Generic.List[string]]::new()

$pkgJsonFiles = Get-IndicatorFile -Path $rootFull -Filter "package.json" -Depth 5
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
  $found = Get-IndicatorFile -Path $rootFull -Filter $entry.Name -Depth 5
  if ($found -and -not $packageManagers.Contains($entry.Value)) {
    $packageManagers.Add($entry.Value)
  }
}

$csprojForPkg = Get-IndicatorFile -Path $rootFull -Filter "*.csproj" -Depth 5
if ($csprojForPkg -and -not $packageManagers.Contains("dotnet")) {
  $packageManagers.Add("dotnet")
}

# --- Angular ---
$angularJson = Get-IndicatorFile -Path $rootFull -Filter "angular.json" -Depth 5
if ($angularJson) {
  $frameworks.Add("angular")
  if (-not $languages.Contains("typescript")) {
    $languages.Add("typescript")
  }
}

# --- TypeScript (package.json + tsconfig.json pair in same directory) ---
$allPkgJson = Get-IndicatorFile -Path $rootFull -Filter "package.json" -Depth 5
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
$hasAnyTsConfig = Get-IndicatorFile -Path $rootFull -Filter "tsconfig.json" -Depth 5
if ($allPkgJson -and -not $hasAnyTsConfig) {
  if (-not $languages.Contains("javascript")) {
    $languages.Add("javascript")
  }
}

# --- Python ---
$pyIndicators = @("pyproject.toml", "requirements.txt", "setup.py")
$hasPython = $false
foreach ($indicator in $pyIndicators) {
  $found = Get-IndicatorFile -Path $rootFull -Filter $indicator -Depth 5
  if ($found) {
    $hasPython = $true
    break
  }
}
if ($hasPython) {
  $languages.Add("python")
}

# --- .NET / C# ---
$csprojFiles = Get-IndicatorFile -Path $rootFull -Filter "*.csproj" -Depth 5
$slnFiles = Get-IndicatorFile -Path $rootFull -Filter "*.sln" -Depth 5
$slnxFiles = Get-IndicatorFile -Path $rootFull -Filter "*.slnx" -Depth 5
if ($csprojFiles -or $slnFiles -or $slnxFiles) {
  $languages.Add("csharp")
  $frameworks.Add("dotnet")
}

# --- Rust (+ Tauri 1 and 2) ---
# build output and vendored crates carry their own Cargo.toml; they do not make the project Rust
if (Get-IndicatorFile -Path $rootFull -Filter "Cargo.toml" -Depth 5 |
    Where-Object { [System.IO.Path]::GetRelativePath($rootFull, $_.FullName) -notmatch '(^|[\\/])(target|vendor)[\\/]' }) {
  $languages.Add("rust")
}
foreach ($tauriConf in 'tauri.conf.json', 'tauri.conf.json5') {
  $tauriFound = Get-IndicatorFile -Path $rootFull -Filter $tauriConf -Depth 5 |
    Where-Object { $_.Directory.Name -eq 'src-tauri' }
  if ($tauriFound -and -not $frameworks.Contains("tauri")) {
    $frameworks.Add("tauri")
  }
}

$langPrefixMap = @{
  typescript = "ts"
  python     = "py"
  csharp     = "dotnet"
  javascript = "js"
  rust       = "rust"
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

$tmp = $null
try {
  if ($agentsUsable) {
    New-Item -ItemType Directory -Path $agentsDir -Force | Out-Null
    $tmp = Join-Path $agentsDir ("techstack." + [guid]::NewGuid().ToString('N') + ".tmp")
    Set-Content -Path $tmp -Value $json -Encoding utf8NoBOM
    Move-Item -Path $tmp -Destination $cacheFile -Force
  }
} catch {
  if ($tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
  # the cache is an optimisation; never fail detection because of it
}

Out-Report $json
exit 0
