#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Releases the checkout lease of an issue and removes its worktree when that is clean; prints {released, path, worktree, removed, kept} as JSON.
.DESCRIPTION
  Counterpart of Enter-Checkout.ps1. Removes <state>/leases/<key>.json of the lease whose 'issue' is -Issue (state dir resolved like
  Add-LedgerLine.ps1; a symlinked leases directory or lease file is refused). When the leased checkout is a worktree (not the main checkout)
  and clean (git status --porcelain without output), Remove-Worktree.ps1 removes it ('removed' = true); a dirty worktree is kept and reported
  ('kept' = its path, so the user can resume there). The main checkout is never touched. No lease for the issue: no-op ({released: false}).
.PARAMETER Issue  Issue number.
#>
[CmdletBinding()]
param(
  [string]$Issue
)
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
function Write-Result($Released, $CheckoutPath, $IsWorktree, $Removed, $Kept) {
  [ordered]@{ released = $Released; path = $CheckoutPath; worktree = $IsWorktree; removed = $Removed; kept = $Kept } | ConvertTo-Json -Compress
}

if ($Issue -notmatch '\A[0-9]{1,10}\z') { throw "Invalid -Issue '$Issue': expected the issue number." }
$state = Resolve-StateDir
$leaseDir = [IO.Path]::GetFullPath((Join-Path $state 'leases'))
if (-not $leaseDir.StartsWith($state + [IO.Path]::DirectorySeparatorChar)) { throw "Path escapes the state directory: $leaseDir" }
foreach ($p in @($state, $leaseDir)) { if (Test-Link $p) { throw "Refusing symlinked path: $p" } }
if (-not (Test-Path -LiteralPath $leaseDir -PathType Container)) { Write-Result $false $null $false $false $null; return }

$mine = @(Get-ChildItem -LiteralPath $leaseDir -Filter '*.json' -File -Force | ForEach-Object {
    if (Test-Link $_.FullName) { throw "Refusing symlinked path: $($_.FullName)" }
    try {
      $o = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
      if ("$($o.issue)" -eq $Issue) { [pscustomobject]@{ File = $_.FullName; Path = "$($o.path)" } }
    } catch { $null }
  } | Where-Object { $_ })
if ($mine.Count -eq 0) { Write-Result $false $null $false $false $null; return }

$common = ''
try { $common = "$(& git -C (Get-Location).Path rev-parse --path-format=absolute --git-common-dir 2>$null)".Trim() } catch { $common = '' }
$root = if ($LASTEXITCODE -eq 0 -and $common) { Split-Path -Parent ([IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($common))) } else { $null }
$cmp = if ($IsWindows) { [StringComparison]::OrdinalIgnoreCase } else { [StringComparison]::Ordinal }

# the caller may stand inside the worktree that is about to go away
if ($root) { Set-Location -LiteralPath $root }
foreach ($l in $mine) {
  Remove-Item -LiteralPath $l.File -Force
  $isWorktree = [bool]$root -and -not [string]::Equals([IO.Path]::TrimEndingDirectorySeparator($l.Path), $root, $cmp)
  if (-not $isWorktree) { Write-Result $true $l.Path $false $false $null; continue }
  $expected = [IO.Path]::GetFullPath((Join-Path (Join-Path $root '.worktrees') $Issue))
  if (-not (Test-Path -LiteralPath $l.Path -PathType Container)) {
    # directory gone: let git forget the registration
    & (Join-Path $PSScriptRoot 'Remove-Worktree.ps1') -Issue $Issue | Out-Null
    Write-Result $true $l.Path $true $false $null
    continue
  }
  $dirty = @(& git -C $l.Path status --porcelain)
  if ($LASTEXITCODE -ne 0 -or $dirty.Count -gt 0 -or -not [string]::Equals($l.Path, $expected, $cmp)) { Write-Result $true $l.Path $true $false $l.Path; continue }
  & (Join-Path $PSScriptRoot 'Remove-Worktree.ps1') -Issue $Issue | Out-Null
  Write-Result $true $l.Path $true $true $null
}
