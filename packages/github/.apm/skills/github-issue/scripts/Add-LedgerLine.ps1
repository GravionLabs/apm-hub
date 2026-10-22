#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Creates <state directory>/<issue>/ and appends one line to its progress.md (the orchestrator ledger); binds or unbinds the loop marker.
.DESCRIPTION
  Every appended line gets an ISO-8601 UTC prefix: '2026-10-21T15:19:46Z <text>' (the hooks write the same format; readers accept lines
  with and without it, so older ledgers stay valid; a -Line that already starts with the prefix is not prefixed twice).
  The only shell command the orchestrator is allowed to use for ledger writes on OpenCode: the agent permission
  map cannot restrict a shell redirect target, so the path is validated here. -Issue must be a positive integer,
  'adhoc' or 'loop-<nr>' (the loop ledger); the resolved path must stay under the state directory (DROMOS_STATE_DIR, else <git common dir>/agents, shared by all worktrees; outside a repository without it the script fails) and a symlinked state directory, issue directory or progress.md is refused. Without -Line only the directory is created.
  -Bind loop-<nr> (with an integer -Issue, the PBI the loop starts) appends 'Loop: PBI #<issue> started' to the existing
  loop ledger <state>/loop-<nr>/progress.md (the PBI ledger must exist or be created by -Line) and writes the marker of the caller's checkout,
  <state>/current.d/<key> ('<issue> loop-<nr>', plus ' <nr>' when the current branch carries another issue number: the hooks do not treat that
  branch as foreign); <key> is the lease key of Enter-Checkout.ps1 (first 16 hex of the SHA-256 of the absolute checkout path; the checkout is the
  git top level of the current directory). The SubagentStop hook and the OpenCode plugin then bind subagent lines of that checkout to the PBI's
  ledger until the loop ledger records 'Loop: stopped'. One marker per checkout: loops in different checkouts do not overwrite each other.
  After a successful append with an integer -Issue the 'heartbeat' of the checkout lease held by that issue (<state>/leases/*.json, Enter-Checkout.ps1) is renewed; no lease: nothing.
  Appends are safe under concurrency: an exclusive lock on '<ledger>.lock' (retried, released at process exit) around ONE write call per line.
  -Unbind (alone) removes the marker of the caller's checkout and the legacy marker <state>/current; no marker is a no-op. A symlinked marker or loop ledger is refused.
.PARAMETER Issue  Issue number, 'adhoc' or 'loop-<nr>'.
.PARAMETER Line   One line of text (no line breaks).
.PARAMETER Bind   The running loop, 'loop-<nr>'.
.PARAMETER Unbind Remove the loop marker of this checkout.
#>
[CmdletBinding()]
param(
  [string]$Issue,
  [string]$Line,
  [string]$Bind,
  [switch]$Unbind
)
# No Mandatory: a headless run must exit non-zero with a message instead of prompting.
$ErrorActionPreference = 'Stop'
function Test-Link([string]$Path) { [bool]([IO.FileInfo]::new($Path).LinkTarget) } # also true for a dangling link
# BEGIN Resolve-StateDir (identical in every script that defines it; test/repo/state-dir-resolver.test.ts)
function Resolve-StateDir {
  if ($env:DROMOS_STATE_DIR) { return [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($env:DROMOS_STATE_DIR, (Get-Location).Path)) }
  $common = $null
  try { $common = "$(& git -C (Get-Location).Path rev-parse --path-format=absolute --git-common-dir 2>$null)".Trim() } catch { $common = $null }
  if ($LASTEXITCODE -ne 0 -or -not $common) { throw 'No state directory: not inside a git repository (set DROMOS_STATE_DIR)' }
  [IO.Path]::GetFullPath((Join-Path $common 'agents'))
}
# END Resolve-StateDir
$base = Resolve-StateDir
# BEGIN Add-LedgerAppend: concurrency-safe append (several runs, hooks and loops write the same ledger)
# .NET does not open append-mode files with O_APPEND (it writes at an offset it tracks itself), so two writers could overwrite each other.
# Hence: an exclusive lock on '<ledger>.lock' (FileShare.None: flock on Unix, released at process exit), retried for up to 30 s, the ledger
# opened inside the lock (the position is the current end) and the whole line written with ONE call. Without the lock after the retries the
# line is still appended (a rare interleave beats a lost line), with a warning.
function Add-LedgerAppend([string]$Path, [string]$Text) {
  $bytes = [Text.UTF8Encoding]::new($false).GetBytes($Text + "`n")
  $lockPath = "$Path.lock"
  if (Test-Link $lockPath) { throw "Refusing symlinked path: $lockPath" }
  $lock = $null
  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  while ($true) {
    try { $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None); break }
    catch [IO.IOException] {
      if ([DateTime]::UtcNow -gt $deadline) { [Console]::Error.WriteLine("ledger lock $lockPath busy: appending without it"); break }
      Start-Sleep -Milliseconds (Get-Random -Minimum 5 -Maximum 40)
    }
  }
  try {
    $fs = [IO.File]::Open($Path, [IO.FileMode]::Append, [IO.FileAccess]::Write, [IO.FileShare]::ReadWrite)
    try { $fs.Write($bytes, 0, $bytes.Length); $fs.Flush() } finally { $fs.Dispose() }
  } finally { if ($lock) { $lock.Dispose() } }
}
# END Add-LedgerAppend
# BEGIN Add-Timestamp (same prefix as subagent-ledger.sh and apm-hub-hooks.ts)
function Add-Timestamp([string]$Text) {
  if ($Text -match '\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z ') { return $Text }
  "$([DateTime]::UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [cultureinfo]::InvariantCulture)) $Text"
}
# END Add-Timestamp
# BEGIN Get-CheckoutKey (the lease key of Enter-Checkout.ps1 for the git top level of the current directory)
function Get-CheckoutKey {
  $top = ''
  try { $top = "$(& git -C (Get-Location).Path rev-parse --show-toplevel 2>$null)".Trim() } catch { $top = '' }
  if (-not $top -or $LASTEXITCODE -ne 0) { $top = (Get-Location).Path } # no repository (DROMOS_STATE_DIR set): the directory itself
  $path = [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($top))
  $hash = [Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($path))
  ([BitConverter]::ToString($hash) -replace '-', '').Substring(0, 16).ToLowerInvariant()
}
# END Get-CheckoutKey
$markerDir = Join-Path $base 'current.d'
$marker = Join-Path $markerDir (Get-CheckoutKey)
$legacyMarker = Join-Path $base 'current' # before #466: one marker per repository; still read by the hooks while no current.d/ exists
if ($Unbind) {
  if ($PSBoundParameters.Keys | Where-Object { $_ -in 'Issue', 'Line', 'Bind' }) { throw 'Invalid -Unbind: use it alone.' }
  foreach ($p in @($base, $markerDir, $marker, $legacyMarker)) { if (Test-Link $p) { throw "Refusing symlinked path: $p" } }
  foreach ($p in @($marker, $legacyMarker)) { if (Test-Path -LiteralPath $p -PathType Leaf) { Remove-Item -LiteralPath $p -Force } }
  return
}
if ($Issue -notmatch '\A([1-9][0-9]{0,9}|adhoc|loop-[1-9][0-9]{0,9})\z') { throw "Invalid -Issue '$Issue': expected a positive integer without leading zeros, 'adhoc' or 'loop-<nr>'." }
if ($PSBoundParameters.ContainsKey('Line') -and $Line -match '[\r\n\u0085  ]') { throw 'Invalid -Line: must be a single line.' }
$binding = $PSBoundParameters.ContainsKey('Bind')
if ($binding) {
  if ($Issue -notmatch '\A[1-9][0-9]{0,9}\z') { throw "Invalid -Issue '$Issue' for -Bind: expected the PBI number." }
  if ($Bind -notmatch '\Aloop-[1-9][0-9]{0,9}\z') { throw "Invalid -Bind '$Bind': expected 'loop-<nr>'." }
}
$dir = [IO.Path]::GetFullPath((Join-Path $base $Issue))
if (-not $dir.StartsWith($base + [IO.Path]::DirectorySeparatorChar)) { throw "Path escapes the state directory: $dir" }
# A symlinked state directory or issue directory is refused (it could point outside the project).
foreach ($p in @($base, $dir)) { if ((Test-Path -LiteralPath $p) -and (Get-Item -LiteralPath $p -Force).LinkTarget) { throw "Refusing symlinked path: $p" } }
if ($binding) {
  # validate everything before the first write: the loop ledger exists and nothing on the way is a symlink
  $loopDir = Join-Path $base $Bind
  $loopFile = Join-Path $loopDir 'progress.md'
  foreach ($p in @($loopDir, $loopFile, $markerDir, $marker)) { if (Test-Link $p) { throw "Refusing symlinked path: $p" } }
  if (-not (Test-Path -LiteralPath $loopFile -PathType Leaf)) { throw "No loop ledger ${loopFile}: write its header first." }
  if (Test-Path -LiteralPath $marker -PathType Container) { throw "Not a file: $marker" }
  if ((Test-Path -LiteralPath $markerDir) -and -not (Test-Path -LiteralPath $markerDir -PathType Container)) { throw "Not a directory: $markerDir" }
  # the PBI ledger must exist (or be created by -Line in this call): a marker without it binds nothing
  $pbiFile = Join-Path $dir 'progress.md'
  if (-not $PSBoundParameters.ContainsKey('Line') -and -not (Test-Path -LiteralPath $pbiFile -PathType Leaf)) { throw "No PBI ledger ${pbiFile}: write its header first (-Line)." }
}
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$file = Join-Path $dir 'progress.md'
# A symlinked progress.md is refused as well (it could point outside the project).
if ((Test-Path -LiteralPath $file) -and (Get-Item -LiteralPath $file -Force).LinkTarget) { throw "Refusing symlinked path: $file" }
if ($PSBoundParameters.ContainsKey('Line')) {
  Add-LedgerAppend $file (Add-Timestamp $Line)
  # Renew the heartbeat of the checkout lease held by this issue (<state>/leases/*.json, written by Enter-Checkout.ps1); no lease: nothing.
  # Best effort and cheap: the ledger line is already written, a symlinked or unreadable lease is skipped.
  $leaseDir = Join-Path $base 'leases'
  if ($Issue -match '\A[0-9]+\z' -and (Test-Path -LiteralPath $leaseDir -PathType Container) -and -not (Test-Link $leaseDir)) {
    foreach ($lf in @(Get-ChildItem -LiteralPath $leaseDir -Filter '*.json' -File -Force)) {
      try {
        if (Test-Link $lf.FullName) { continue }
        $raw = Get-Content -LiteralPath $lf.FullName -Raw
        if ("$(($raw | ConvertFrom-Json).issue)" -ne $Issue) { continue }
        $stamp = [DateTime]::UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [cultureinfo]::InvariantCulture)
        $tmp = "$($lf.FullName).$PID.tmp"
        if (Test-Link $tmp) { continue }
        [IO.File]::WriteAllText($tmp, ($raw -replace '("heartbeat"\s*:\s*)"[^"]*"', "`$1`"$stamp`""))
        Move-Item -LiteralPath $tmp -Destination $lf.FullName -Force
      } catch { continue }
    }
  }
}
if ($binding) {
  # the start line first: a marker is live only while the last 'Loop: ' line is not 'Loop: stopped'
  Add-LedgerAppend $loopFile (Add-Timestamp "Loop: PBI #$Issue started")
  # third field: the issue number of the branch this runs on (the hooks do not treat that branch as foreign)
  $origin = ''
  try {
    $branch = & git -c core.fsmonitor=false -c core.hooksPath=/dev/null rev-parse --abbrev-ref HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and "$branch" -match '\A(feat|fix|chore|docs|refactor|test|perf|ci|build|style|revert|hotfix)/([^/]+/)*([1-9][0-9]{0,9})(-[^/]*)?\z' -and $Matches[3] -ne $Issue) { $origin = " $($Matches[3])" }
  } catch { $origin = '' } # no git: two-field marker
  New-Item -ItemType Directory -Path $markerDir -Force | Out-Null
  [IO.File]::WriteAllText($marker, "$Issue $Bind$origin`n")
}
Write-Output $file
