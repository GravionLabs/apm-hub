<#
.SYNOPSIS
  Detect the project tech stack and output a JSON report.

.DESCRIPTION
  Scans the project root for indicator files and returns a JSON object
  listing detected languages, frameworks, and the matching <lang>-build,
  <lang>-test, and <lang>-implementation skills.

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

# --- Angular ---
if (Test-Path (Join-Path $ProjectRoot "angular.json")) {
  $frameworks.Add("angular")
  $languages.Add("typescript")
}

# --- TypeScript ---
$pkgJson = Join-Path $ProjectRoot "package.json"
$tsConfig = Join-Path $ProjectRoot "tsconfig.json"
if ((Test-Path $pkgJson) -and (Test-Path $tsConfig)) {
  if (-not $languages.Contains("typescript")) {
    $languages.Add("typescript")
  }
}

# --- JavaScript (Node.js only, no TypeScript) ---
if ((Test-Path $pkgJson) -and -not (Test-Path $tsConfig)) {
  if (-not $languages.Contains("javascript")) {
    $languages.Add("javascript")
  }
}

# --- Python ---
$pyProject = Join-Path $ProjectRoot "pyproject.toml"
$requirements = Join-Path $ProjectRoot "requirements.txt"
$setupPy = Join-Path $ProjectRoot "setup.py"
if ((Test-Path $pyProject) -or (Test-Path $requirements) -or (Test-Path $setupPy)) {
  $languages.Add("python")
}

# --- .NET / C# ---
$csprojFiles = Get-ChildItem -Path $ProjectRoot -Recurse -Filter "*.csproj" -Depth 3 -ErrorAction SilentlyContinue
$slnFiles = Get-ChildItem -Path $ProjectRoot -Recurse -Filter "*.sln" -Depth 2 -ErrorAction SilentlyContinue
if ($csprojFiles -or $slnFiles) {
  $languages.Add("csharp")
  $frameworks.Add("dotnet")
}

# --- Build skill list ---
$build = $languages | ForEach-Object { "${_}-build" }
$test = $languages | ForEach-Object { "${_}-test" }
$implementation = $languages | ForEach-Object { "${_}-implementation" }

$report = @{
  languages       = @($languages)
  frameworks      = @($frameworks)
  build           = @($build)
  test            = @($test)
  implementation  = @($implementation)
}

$report | ConvertTo-Json -Compress
exit 0
