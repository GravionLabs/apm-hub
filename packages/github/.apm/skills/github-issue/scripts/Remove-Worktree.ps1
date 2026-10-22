#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Removes the worktree <repo root>/.worktrees/<nr> with 'git worktree remove' and prunes; prints {path, removed} as JSON.
.DESCRIPTION
  A dirty worktree is refused unless -Force is given (then 'git worktree remove --force'). A worktree that does not exist is not an error
  ({removed: false}). The directory is never deleted by hand; a directory under .worktrees/ that git does not know is refused.
  The root is resolved like New-Worktree.ps1 (also from inside a worktree); .worktrees or the target as symlink or an escaping path is refused.
.PARAMETER Issue  Issue number, 'loop-<nr>' or '<nr>-t<nr>'.
.PARAMETER Force  Remove a worktree with local changes too.
#>
[CmdletBinding()]
param(
  [string]$Issue,
  [switch]$Force
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
function Test-Link([string]$Path) { [bool]([IO.FileInfo]::new($Path).LinkTarget) } # also true for a dangling link
if ($Issue -notmatch '\A([0-9]{1,10}|loop-[0-9]{1,10}|[0-9]{1,10}-t[0-9]{1,10})\z') { throw "Invalid -Issue '$Issue': expected '<nr>', 'loop-<nr>' or '<nr>-t<nr>'." }
$common = ''
try { $common = "$(& git -C (Get-Location).Path rev-parse --path-format=absolute --git-common-dir 2>$null)".Trim() } catch { $common = '' }
if ($LASTEXITCODE -ne 0 -or -not $common) { throw 'Not inside a git repository.' }
$common = [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($common))
if ((Split-Path -Leaf $common) -ne '.git') { throw "Unsupported repository layout (git common dir $common is not <root>/.git)." }
$root = Split-Path -Parent $common
$sep = [IO.Path]::DirectorySeparatorChar
$wtRoot = Join-Path $root '.worktrees'
$target = [IO.Path]::GetFullPath((Join-Path $wtRoot $Issue))
if (-not $target.StartsWith($wtRoot + $sep)) { throw "Path escapes ${wtRoot}: $target" }
foreach ($p in @($wtRoot, $target)) { if (Test-Link $p) { throw "Refusing symlinked path: $p" } }

$registered = @(& git -C $root worktree list --porcelain | Where-Object { $_ -like 'worktree *' } | ForEach-Object { [IO.Path]::GetFullPath($_.Substring(9)) })
$known = $registered -contains $target
if (-not $known -and (Test-Path -LiteralPath $target)) { throw "Not a registered worktree, refusing to touch it: $target" }
$removed = $false
if ($known) {
  $gitArgs = @('worktree', 'remove') + $(if ($Force) { @('--force') } else { @() }) + @($target)
  $out = & git -C $root @gitArgs 2>&1
  if ($LASTEXITCODE -ne 0) { throw "git $($gitArgs -join ' ') failed (use -Force for local changes): $(($out | ForEach-Object { "$_" }) -join ' ')" }
  $removed = $true
}
& git -C $root worktree prune
if ($LASTEXITCODE -ne 0) { throw 'git worktree prune failed.' }
[ordered]@{ path = $target; removed = $removed } | ConvertTo-Json -Compress
