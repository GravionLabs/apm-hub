#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Decides where a run works (main checkout when free, <root>/.worktrees/<nr> when busy), writes the checkout lease and prints {path, worktree, branch, base, lease} as JSON.
.DESCRIPTION
  The lease <state>/leases/<key>.json ({path, issue, branch, host, started, heartbeat}, UTC ISO 8601; <key> = first 16 hex of the SHA-256 of the
  absolute checkout path) coordinates apm-hub runs only: a human or a foreign agent without these scripts is detected only through the dirty tree.
  <state> is resolved like Add-LedgerLine.ps1 (DROMOS_STATE_DIR, else <git common dir>/agents, shared by all worktrees). Add-LedgerLine.ps1 renews
  'heartbeat' of the lease held by its -Issue, Exit-Checkout.ps1 releases it. Symlinked leases directories or lease files are refused.
  Decision, in this order:
    1. a lease of the same issue (any checkout) whose directory exists: reuse it ('resume'), heartbeat renewed
    2. the main checkout (parent of the git common dir) has no live lease of another issue and 'git status --porcelain --untracked-files=no' is empty:
       'git fetch origin <base>', check out <branch> (created from origin/<base> when missing), lease, worktree=false
    3. otherwise New-Worktree.ps1 -> .worktrees/<nr> (an existing registered worktree of that name is reused), lease, worktree=true
  A lease older than -LeaseTtlMinutes is stale: it counts as free and is taken over (stderr: 'stale lease of #<n> taken over').
  Race safety: the lease of the main checkout is claimed BEFORE the dirty check and the checkout, by exclusive create (O_EXCL: it fails when
  <key>.json exists; a file younger than 10 s that cannot be parsed yet counts as a lease being written). A stale lease is first moved away
  (only one taker wins the move). The loser re-evaluates, sees the winner's live lease and gets a worktree: two runs starting at the same instant cannot both
  take the free main checkout.
.PARAMETER Issue           Issue number.
.PARAMETER Branch          Branch of the run.
.PARAMETER Base            Integration branch on origin the branch starts from.
.PARAMETER LeaseTtlMinutes Heartbeat age after which a lease is stale (default 120).
#>
[CmdletBinding()]
param(
  [string]$Issue,
  [string]$Branch,
  [string]$Base,
  [ValidateRange(1, 525600)][int]$LeaseTtlMinutes = 120
)
# No Mandatory: a headless run must exit non-zero with a message instead of prompting.
Set-StrictMode -Version Latest
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
function Get-Stamp { [DateTime]::UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [cultureinfo]::InvariantCulture) }
function ConvertTo-Utc($Value) {
  # ConvertFrom-Json turns ISO strings into DateTime; keep both forms working
  if ($Value -is [DateTime]) { return $Value.ToUniversalTime() }
  [DateTime]::Parse("$Value", [cultureinfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal)
}
function Get-LeaseKey([string]$CheckoutPath) {
  $hash = [Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($CheckoutPath))
  ([BitConverter]::ToString($hash) -replace '-', '').Substring(0, 16).ToLowerInvariant()
}
function Write-Lease([string]$File, $Lease, [switch]$Exclusive) {
  # -Exclusive: true when this call created the file (O_EXCL), false when it already exists
  if (Test-Link $File) { throw "Refusing symlinked path: $File" }
  $text = ($Lease | ConvertTo-Json -Compress) + "`n"
  if ($Exclusive) {
    # File.Move(overwrite: false) is not atomic on Unix (measured: several winners), CreateNew is; readers ignore the short empty window
    try { $fs = [IO.File]::Open($File, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read) } catch [IO.IOException] { return $false }
    try { $bytes = [Text.UTF8Encoding]::new($false).GetBytes($text); $fs.Write($bytes, 0, $bytes.Length) } finally { $fs.Dispose() }
    return $true
  }
  $tmp = "$File.$PID.tmp"
  if (Test-Link $tmp) { throw "Refusing symlinked path: $tmp" }
  [IO.File]::WriteAllText($tmp, $text)
  Move-Item -LiteralPath $tmp -Destination $File -Force
  return $true
}
function Test-Same([string]$A, [string]$B) {
  $cmp = if ($IsWindows) { [StringComparison]::OrdinalIgnoreCase } else { [StringComparison]::Ordinal }
  [string]::Equals([IO.Path]::TrimEndingDirectorySeparator($A), [IO.Path]::TrimEndingDirectorySeparator($B), $cmp)
}

if ($Issue -notmatch '\A[0-9]{1,10}\z') { throw "Invalid -Issue '$Issue': expected the issue number." }
if (-not $Base) { throw 'Missing -Base: pass the integration branch (no default is guessed).' }
if ($Base -notmatch '\A[A-Za-z0-9][A-Za-z0-9._/-]{0,199}\z' -or $Base -match '\.\.|//|\.lock\z|/\z') { throw "Invalid -Base '$Base': expected a branch name on origin." }
if (-not $Branch) { throw 'Missing -Branch.' }
if ($Branch -notmatch '\A[A-Za-z0-9][A-Za-z0-9._/-]{0,199}\z' -or $Branch -match '\.\.|//|\.lock\z|/\z') { throw "Invalid -Branch '$Branch'." }
& git check-ref-format --branch $Branch *> $null
if ($LASTEXITCODE -ne 0) { throw "Invalid -Branch '$Branch'." }

$common = ''
try { $common = "$(& git -C (Get-Location).Path rev-parse --path-format=absolute --git-common-dir 2>$null)".Trim() } catch { $common = '' }
if ($LASTEXITCODE -ne 0 -or -not $common) { throw 'Not inside a git repository.' }
$common = [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($common))
if ((Split-Path -Leaf $common) -ne '.git') { throw "Unsupported repository layout (git common dir $common is not <root>/.git)." }
$root = Split-Path -Parent $common

$state = Resolve-StateDir
$leaseDir = [IO.Path]::GetFullPath((Join-Path $state 'leases'))
if (-not $leaseDir.StartsWith($state + [IO.Path]::DirectorySeparatorChar)) { throw "Path escapes the state directory: $leaseDir" }
foreach ($p in @($state, $leaseDir)) { if (Test-Link $p) { throw "Refusing symlinked path: $p" } }
New-Item -ItemType Directory -Path $leaseDir -Force | Out-Null

# all leases; a symlinked lease file is refused, an unreadable one is ignored
function Get-Leases {
  $now = [DateTime]::UtcNow
  @(Get-ChildItem -LiteralPath $leaseDir -Filter '*.json' -File -Force | ForEach-Object {
      if (Test-Link $_.FullName) { throw "Refusing symlinked path: $($_.FullName)" }
      try {
        $raw = Get-Content -LiteralPath $_.FullName -Raw
        $o = $raw | ConvertFrom-Json
        $age = ($now - (ConvertTo-Utc $o.heartbeat)).TotalMinutes
        [pscustomobject]@{ File = $_.FullName; Raw = $raw; Data = $o; Issue = "$($o.issue)"; Path = "$($o.path)"; Live = ($age -lt $LeaseTtlMinutes) }
      } catch { $null }
    } | Where-Object { $_ })
}
$leases = Get-Leases

function Save-Lease([string]$CheckoutPath, [string]$LeaseBranch, $Existing, [switch]$Exclusive) {
  $file = Join-Path $leaseDir ((Get-LeaseKey $CheckoutPath) + '.json')
  $stamp = Get-Stamp
  $started = if ($Existing -and $Existing.PSObject.Properties['started'] -and $Existing.started) { (ConvertTo-Utc $Existing.started).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [cultureinfo]::InvariantCulture) } else { $stamp }
  $created = Write-Lease $file ([ordered]@{ path = $CheckoutPath; issue = [long]$Issue; branch = $LeaseBranch; host = [Environment]::MachineName; started = $started; heartbeat = $stamp }) -Exclusive:$Exclusive
  if (-not $created) { return $null }
  $file
}
function Write-Result([string]$CheckoutPath, [bool]$IsWorktree, [string]$ResultBranch, [string]$LeaseFile) {
  [ordered]@{ path = $CheckoutPath; worktree = $IsWorktree; branch = $ResultBranch; base = $Base; lease = $LeaseFile } | ConvertTo-Json -Compress
}

# 1. resume: a lease of the same issue whose checkout still exists
foreach ($l in @($leases | Where-Object { $_.Issue -eq $Issue })) {
  if (-not (Test-Path -LiteralPath $l.Path -PathType Container)) { continue }
  if (-not $l.Live) { [Console]::Error.WriteLine("stale lease of #$Issue taken over") }
  $leaseBranch = if ($l.Data.PSObject.Properties['branch'] -and $l.Data.branch) { "$($l.Data.branch)" } else { $Branch }
  $file = Save-Lease $l.Path $leaseBranch $l.Data
  if ($file -ne $l.File) { Remove-Item -LiteralPath $l.File -Force }
  Write-Result $l.Path (-not (Test-Same $l.Path $root)) $leaseBranch $file
  return
}

# 2. the main checkout, when no live lease of another issue holds it and no tracked file is modified.
# The lease is claimed first (exclusive create), then the tree is checked and the branch checked out: a concurrent run sees the live lease.
$rootFile = Join-Path $leaseDir ((Get-LeaseKey $root) + '.json')
$claimed = $null
for ($attempt = 0; $attempt -lt 5 -and -not $claimed; $attempt++) {
  if ($attempt -gt 0) { $leases = Get-Leases }
  $onRoot = @($leases | Where-Object { Test-Same $_.Path $root })
  if (@($onRoot | Where-Object { $_.Live -and $_.Issue -ne $Issue }).Count -gt 0) { break } # busy
  $previous = @($onRoot | Where-Object { $_.File -eq $rootFile } | Select-Object -First 1)
  if (-not $previous.Count -and (Test-Path -LiteralPath $rootFile) -and ([DateTime]::UtcNow - (Get-Item -LiteralPath $rootFile -Force).LastWriteTimeUtc).TotalSeconds -lt 10) {
    Start-Sleep -Milliseconds 150 # a lease being written by a concurrent run: look again, it is live by then
    continue
  }
  $existing = if ($previous.Count) { $previous[0].Data } else { $null }
  if (Test-Path -LiteralPath $rootFile) {
    # a stale (or unreadable) lease: move it away first, only one taker wins the move; a lease that changed meanwhile is put back
    if (Test-Link $rootFile) { throw "Refusing symlinked path: $rootFile" }
    $before = if ($previous.Count) { $previous[0].Raw } else { $null }
    $gone = "$rootFile.$PID.stale"
    try { [IO.File]::Move($rootFile, $gone) } catch [IO.IOException] { continue }
    $after = try { Get-Content -LiteralPath $gone -Raw } catch { $null }
    if ($null -ne $before -and $after -ne $before) {
      try { [IO.File]::Move($gone, $rootFile, $false) } catch [IO.IOException] { Remove-Item -LiteralPath $gone -Force -ErrorAction SilentlyContinue }
      continue
    }
    Remove-Item -LiteralPath $gone -Force -ErrorAction SilentlyContinue
    foreach ($l in @($onRoot | Where-Object { -not $_.Live -and $_.Issue -ne $Issue })) { [Console]::Error.WriteLine("stale lease of #$($l.Issue) taken over") }
  }
  $claimed = Save-Lease $root $Branch $existing -Exclusive
}
if ($claimed) {
  $dirty = @(& git -C $root status --porcelain --untracked-files=no)
  if ($LASTEXITCODE -ne 0) { Remove-Item -LiteralPath $claimed -Force -ErrorAction SilentlyContinue; throw 'git status failed.' }
  if ($dirty.Count -gt 0) { Remove-Item -LiteralPath $claimed -Force -ErrorAction SilentlyContinue; $claimed = $null }
}
if ($claimed) {
  try {
    $out = & git -C $root fetch origin $Base 2>&1
    if ($LASTEXITCODE -ne 0) { throw "git fetch origin $Base failed: $(($out | ForEach-Object { "$_" }) -join ' ')" }
    $current = "$(& git -C $root rev-parse --abbrev-ref HEAD 2>$null)".Trim()
    if ($current -ne $Branch) {
      & git -C $root show-ref --verify --quiet "refs/heads/$Branch"
      $gitArgs = if ($LASTEXITCODE -eq 0) { @('checkout', $Branch) } else { @('checkout', '--no-track', '-b', $Branch, "origin/$Base") }
      $out = & git -C $root @gitArgs 2>&1
      if ($LASTEXITCODE -ne 0) { throw "git $($gitArgs -join ' ') failed: $(($out | ForEach-Object { "$_" }) -join ' ')" }
    }
  } catch {
    Remove-Item -LiteralPath $claimed -Force -ErrorAction SilentlyContinue # a failed checkout does not keep the main checkout busy
    throw
  }
  Write-Result $root $false $Branch $claimed
  return
}

# 3. busy: .worktrees/<nr> (an already registered worktree of that name is reused)
$target = [IO.Path]::GetFullPath((Join-Path (Join-Path $root '.worktrees') $Issue))
$registered = @(& git -C $root worktree list --porcelain | Where-Object { $_ -like 'worktree *' } | ForEach-Object { [IO.Path]::GetFullPath($_.Substring(9)) })
if ($registered -contains $target) {
  if (Test-Link $target) { throw "Refusing symlinked path: $target" }
  $wtBranch = "$(& git -C $target rev-parse --abbrev-ref HEAD 2>$null)".Trim()
  if (-not $wtBranch) { $wtBranch = $Branch }
} else {
  $created = & (Join-Path $PSScriptRoot 'New-Worktree.ps1') -Issue $Issue -Branch $Branch -Base $Base | Select-Object -Last 1 | ConvertFrom-Json
  $target = "$($created.path)"
  $wtBranch = "$($created.branch)"
}
$file = Save-Lease $target $wtBranch $null
Write-Result $target $true $wtBranch $file
