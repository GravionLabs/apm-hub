<#
.SYNOPSIS
  Runs a caller-supplied format (or check) command on the changed files with the given extensions. No language logic.
.PARAMETER Language
  Key into `<repo>/.agents/format.json`; an entry there replaces -Extensions, -Command and -Requires (a configured tool that is missing is an error).
.PARAMETER Extensions
  Extensions to keep, e.g. '.ts','.tsx' (one comma-separated string works too; the leading dot is optional).
.PARAMETER Command
  Command line with a {files} placeholder, e.g. 'npx prettier --write {files}'. Without the placeholder the files are appended.
.PARAMETER Requires
  Optional probe command; it must exit 0 (e.g. 'npx --no-install prettier --version'), otherwise the run is skipped with `skipped: <tool> not configured`.
.PARAMETER Check
  Read-only intent: the command passed is the check command; the success line reads `checked: <n> files`.
.PARAMETER Base
  Also include the files changed in `<Base>...HEAD`. Default: uncommitted changes only (staged, unstaged, untracked).
#>
param(
  [string]$Language,
  [string[]]$Extensions,
  [string]$Command,
  [switch]$Check,
  [string]$Requires,
  [string]$Base
)
$ErrorActionPreference = 'Stop'

$root = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $root) { Write-Output 'skipped: not a git repository'; exit 0 }

function Stop-Fail([string]$Message) { Write-Error "error: $Message" -ErrorAction Continue; exit 1 }

# per-project override: an entry for -Language replaces extensions and ALL default commands
$commands = @(); $override = $false
$overrideFile = Join-Path $root '.agents/format.json'
if ($Language -and (Test-Path -LiteralPath $overrideFile -PathType Leaf)) {
  try { $cfg = Get-Content -LiteralPath $overrideFile -Raw | ConvertFrom-Json -ErrorAction Stop }
  catch { Stop-Fail ".agents/format.json is not valid JSON ($($_.Exception.Message))" }
  $entry = if ($cfg -is [pscustomobject]) { $cfg.PSObject.Properties[$Language] } else { $null }
  if ($entry) {
    $override = $true
    $key = if ($Check) { 'check' } else { 'format' }
    $entryVal = $entry.Value
    $cmdProp = if ($entryVal -is [pscustomobject]) { $entryVal.PSObject.Properties[$key] } else { $null }
    if (-not $cmdProp) { Stop-Fail ".agents/format.json: entry '$Language' has no '$key' command" }
    $commands = @($cmdProp.Value | Where-Object { $_ -is [string] -and $_.Trim() })
    if ($commands.Count -eq 0) { Stop-Fail ".agents/format.json: entry '$Language' has an empty '$key' command" }
    $extProp = $entryVal.PSObject.Properties['extensions']
    if ($extProp) { $Extensions = @($extProp.Value) }
    # commands come from a repo-controlled file: say so (no gate)
    Write-Error "notice: running commands from .agents/format.json for '$Language'" -ErrorAction Continue
  }
}
if (-not $override) {
  if (-not $Command) { Stop-Fail '-Command is required (no .agents/format.json entry applies)' }
  $commands = @($Command)
}
if (-not $Extensions) { Stop-Fail '-Extensions is required (no .agents/format.json entry supplies them)' }

$plans = @($commands | ForEach-Object { , @($_.Trim() -split '\s+' | Where-Object { $_ }) })
if ($override) {
  # a configured tool that is missing is an error even when nothing changed
  foreach ($t in $plans) {
    if (-not (Get-Command $t[0] -ErrorAction SilentlyContinue)) { Stop-Fail "$($t[0]) not found (configured in .agents/format.json for $Language)" }
  }
}

$exts = @($Extensions | ForEach-Object { $_ -split ',' } | Where-Object { $_.Trim() } |
  ForEach-Object { $e = $_.Trim().ToLowerInvariant(); if ($e.StartsWith('.')) { $e } else { ".$e" } })

# NUL-separated output (-z): names with spaces, quotes or non-ASCII characters arrive unquoted
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
function Get-GitNames {
  param([string[]]$GitArgs)
  $out = & git -C $root @GitArgs 2>&1
  if ($LASTEXITCODE -ne 0) { $code = $LASTEXITCODE; Write-Error (($out | Out-String).Trim()) -ErrorAction Continue; exit $(if ($code) { $code } else { 1 }) }
  (@($out) -join "`n") -split "`0" | Where-Object { $_ }
}
$names = [System.Collections.Generic.List[string]]::new()
if ($Base) {
  # a bad ref must fail loudly: a swallowed error would let -Check pass with nothing checked
  Get-GitNames @('diff', '--name-only', '-z', "$Base...HEAD", '--') | ForEach-Object { $names.Add($_) }
}
# staged + unstaged vs HEAD (a repository without a commit has no HEAD: fall back to the index)
& git -C $root rev-parse --verify -q HEAD *> $null
$diffArgs = if ($LASTEXITCODE -eq 0) { @('diff', '--name-only', '-z', 'HEAD', '--') } else { @('diff', '--name-only', '-z', '--cached', '--') }
Get-GitNames $diffArgs | ForEach-Object { $names.Add($_) }
Get-GitNames @('ls-files', '--others', '--exclude-standard', '-z') | ForEach-Object { $names.Add($_) }

# repo-relative, existing (deleted dropped), extension match, no duplicates
$files = @($names | Select-Object -Unique | Where-Object {
    $_ -and (Test-Path -LiteralPath (Join-Path $root $_) -PathType Leaf) -and ($exts -contains ([IO.Path]::GetExtension($_).ToLowerInvariant()))
  })
if ($files.Count -eq 0) { Write-Output 'skipped: no changed files'; exit 0 }

if (-not $override) {
  $t = $plans[0]
  if (-not (Get-Command $t[0] -ErrorAction SilentlyContinue)) { Write-Output "skipped: $($t[0]) not found"; exit 0 }
}

if ($Requires -and -not $override) {
  $rt = @($Requires.Trim() -split '\s+' | Where-Object { $_ })
  $ok = $false
  if (Get-Command $rt[0] -ErrorAction SilentlyContinue) {
    $ra = @($rt | Select-Object -Skip 1)
    Push-Location -LiteralPath $root
    try { & $rt[0] @ra *> $null; $ok = ($LASTEXITCODE -eq 0) } finally { Pop-Location }
  }
  if (-not $ok) { Write-Output "skipped: $($rt[0]) not configured"; exit 0 }
}

# every file is its own argument (no shell quoting); the command never sees `.` or a directory
# a name starting with '-' must not read as an option
$safe = @($files | ForEach-Object { if ($_.StartsWith('-')) { "./$_" } else { $_ } })
function Get-ArgList([string[]]$Tokens) {
  $argList = [System.Collections.Generic.List[string]]::new()
  $placed = $false
  foreach ($t in $Tokens | Select-Object -Skip 1) {
    if ($t -eq '{files}') { foreach ($f in $safe) { $argList.Add($f) }; $placed = $true }
    elseif ($t.Contains('{files}')) { $argList.Add($t.Replace('{files}', ($safe -join ';'))); $placed = $true } # embedded: files joined by ';'
    else { $argList.Add($t) }
  }
  if (-not $placed) { foreach ($f in $safe) { $argList.Add($f) } }
  , $argList.ToArray()
}

Push-Location -LiteralPath $root
try {
  foreach ($t in $plans) {
    $al = Get-ArgList $t
    & $t[0] @al
    $code = $LASTEXITCODE
    if ($code -ne 0) { break }
  }
} finally { Pop-Location }
if ($code -ne 0) { exit $code }
Write-Output ("{0}: {1} files" -f ($(if ($Check) { 'checked' } else { 'formatted' }), $files.Count))
