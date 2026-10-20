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
$agentsDir = Join-Path $rootFull '.agents'
$cacheFile = Join-Path $agentsDir 'techstack.json'
# a symlinked .agents/ is never read from or written through; the report is printed without caching
$agentsItem = Get-Item -LiteralPath $agentsDir -Force -ErrorAction SilentlyContinue
$agentsLinked = [bool]($agentsItem -and $agentsItem.LinkType)

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

if (-not $NoCache -and -not $agentsLinked -and (Test-Path $cacheFile -PathType Leaf)) {
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
      (Get-Content $cacheFile -Raw).Trim()
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
if (Get-IndicatorFile -Path $rootFull -Filter "Cargo.toml" -Depth 5) {
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
  if (-not $agentsLinked) {
    New-Item -ItemType Directory -Path $agentsDir -Force | Out-Null
    $tmp = Join-Path $agentsDir ("techstack." + [guid]::NewGuid().ToString('N') + ".tmp")
    Set-Content -Path $tmp -Value $json -Encoding utf8NoBOM
    Move-Item -Path $tmp -Destination $cacheFile -Force
    # keep .agents/ out of git when it is not already ignored
    $null = git -C $rootFull rev-parse --is-inside-work-tree 2>$null
    if ($LASTEXITCODE -eq 0) {
      git -C $rootFull check-ignore -q .agents/techstack.json 2>$null
      if ($LASTEXITCODE -ne 0) {
        # --git-path resolves a symlinked exclude file to its target; build the path from the git dir so the link check sees it
        $commonDir = git -C $rootFull rev-parse --path-format=absolute --git-common-dir 2>$null
        $infoDir = if ($commonDir) { Join-Path $commonDir 'info' } else { $null }
        $infoItem = if ($infoDir) { Get-Item -LiteralPath $infoDir -Force -ErrorAction SilentlyContinue } else { $null }
        if ($infoDir -and -not ($infoItem -and $infoItem.LinkType)) {
          $exclude = Join-Path $infoDir 'exclude'
          New-Item -ItemType Directory -Path $infoDir -Force | Out-Null
          $item = Get-Item -LiteralPath $exclude -Force -ErrorAction SilentlyContinue
          $isLink = $item -and $item.LinkType
          $lines = if ($item) { @(Get-Content -LiteralPath $exclude) } else { @() }
          $listed = @($lines | Where-Object { $_.Trim() -in @('.agents/', '.agents', '/.agents/', '/.agents') }).Count -gt 0
          if (-not $isLink -and -not $listed) {
            $raw = if ($item) { Get-Content -LiteralPath $exclude -Raw } else { '' }
            $prefix = if ($raw -and -not $raw.EndsWith("`n")) { "`n" } else { '' }
            [System.IO.File]::AppendAllText($exclude, "$prefix.agents/`n")
          }
        }
      }
    }
  }
} catch {
  if ($tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
  # the cache is an optimisation; never fail detection because of it
}

$json
exit 0
