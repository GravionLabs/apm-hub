<#
.SYNOPSIS
  Runs a caller-supplied format (or check) command on the changed files with the given extensions. No language logic.
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
  [Parameter(Mandatory)][string[]]$Extensions,
  [Parameter(Mandatory)][string]$Command,
  [switch]$Check,
  [string]$Requires,
  [string]$Base
)
$ErrorActionPreference = 'Stop'

$root = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $root) { Write-Output 'skipped: not a git repository'; exit 0 }

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

$tokens = @($Command.Trim() -split '\s+' | Where-Object { $_ })
$tool = $tokens[0]
if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Write-Output "skipped: $tool not found"; exit 0 }

if ($Requires) {
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
$argList = [System.Collections.Generic.List[string]]::new()
$placed = $false
foreach ($t in $tokens[1..($tokens.Count)] | Where-Object { $_ }) {
  if ($t -eq '{files}') { foreach ($f in $safe) { $argList.Add($f) }; $placed = $true } else { $argList.Add($t) }
}
if (-not $placed) { foreach ($f in $safe) { $argList.Add($f) } }

Push-Location -LiteralPath $root
try {
  & $tool @argList
  $code = $LASTEXITCODE
} finally { Pop-Location }
if ($code -ne 0) { exit $code }
Write-Output ("{0}: {1} files" -f ($(if ($Check) { 'checked' } else { 'formatted' }), $files.Count))
