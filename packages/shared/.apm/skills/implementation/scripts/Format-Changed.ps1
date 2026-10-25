<#
.SYNOPSIS
  Runs a caller-supplied format (or check) command on the changed files with the given extensions. No language logic.
.PARAMETER Extensions
  Extensions to keep, e.g. '.ts','.tsx' (one comma-separated string works too; the leading dot is optional).
.PARAMETER Command
  Command line with a {files} placeholder, e.g. 'npx prettier --write {files}'. Without the placeholder the files are appended.
.PARAMETER Check
  Read-only intent: the command passed is the check command; the success line reads `checked: <n> files`.
.PARAMETER Base
  Also include the files changed in `<Base>...HEAD`. Default: uncommitted changes only (staged, unstaged, untracked).
#>
param(
  [Parameter(Mandatory)][string[]]$Extensions,
  [Parameter(Mandatory)][string]$Command,
  [switch]$Check,
  [string]$Base
)
$ErrorActionPreference = 'Stop'

$root = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $root) { Write-Output 'skipped: not a git repository'; exit 0 }

$exts = @($Extensions | ForEach-Object { $_ -split ',' } | Where-Object { $_.Trim() } |
  ForEach-Object { $e = $_.Trim().ToLowerInvariant(); if ($e.StartsWith('.')) { $e } else { ".$e" } })

$names = [System.Collections.Generic.List[string]]::new()
if ($Base) { & git -C $root diff --name-only "$Base...HEAD" 2>$null | ForEach-Object { $names.Add($_) } }
# staged + unstaged vs HEAD (a repository without a commit has no HEAD: fall back to the index)
$headOk = (& git -C $root rev-parse --verify -q HEAD 2>$null); 
if ($headOk) { & git -C $root diff --name-only HEAD | ForEach-Object { $names.Add($_) } }
else { & git -C $root diff --name-only --cached | ForEach-Object { $names.Add($_) } }
& git -C $root ls-files --others --exclude-standard | ForEach-Object { $names.Add($_) }

# repo-relative, existing (deleted dropped), extension match, no duplicates
$files = @($names | Select-Object -Unique | Where-Object {
    $_ -and (Test-Path -LiteralPath (Join-Path $root $_) -PathType Leaf) -and ($exts -contains ([IO.Path]::GetExtension($_).ToLowerInvariant()))
  })
if ($files.Count -eq 0) { Write-Output 'skipped: no changed files'; exit 0 }

$tokens = @($Command.Trim() -split '\s+' | Where-Object { $_ })
$tool = $tokens[0]
if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Write-Output "skipped: $tool not found"; exit 0 }

# every file is its own argument (no shell quoting); the command never sees `.` or a directory
$argList = [System.Collections.Generic.List[string]]::new()
$placed = $false
foreach ($t in $tokens[1..($tokens.Count)] | Where-Object { $_ }) {
  if ($t -eq '{files}') { foreach ($f in $files) { $argList.Add($f) }; $placed = $true } else { $argList.Add($t) }
}
if (-not $placed) { foreach ($f in $files) { $argList.Add($f) } }

Push-Location -LiteralPath $root
try {
  & $tool @argList
  $code = $LASTEXITCODE
} finally { Pop-Location }
if ($code -ne 0) { exit $code }
Write-Output ("{0}: {1} files" -f ($(if ($Check) { 'checked' } else { 'formatted' }), $files.Count))
