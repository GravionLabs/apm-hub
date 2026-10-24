#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Creates the worktree <repo root>/.worktrees/<nr> on a new branch from origin/<base> and prints {path, branch, base} as JSON.
.DESCRIPTION
  The only way apm-hub creates a worktree. Whether a run needs one at all is decided by Enter-Checkout.ps1.
  The repository root is the parent of 'git rev-parse --path-format=absolute --git-common-dir', so the script resolves the main checkout
  also when it runs inside a worktree (the new worktree lands beside the others, never nested).
  -Issue is '<nr>', 'loop-<nr>' or '<nr>-t<nr>'. The script never edits tracked files and never deletes anything. It refuses (exit non-zero,
  nothing created) when .worktrees/ is not git-ignored (run Enable-Worktrees.ps1 once per repository), when .worktrees or the target is a
  symlink or escapes the root, and when the target path or the branch already exists.
.PARAMETER Issue   Issue number, 'loop-<nr>' or '<nr>-t<nr>'.
.PARAMETER Branch  New branch name (default: feat/<Issue>).
.PARAMETER Base    Branch on origin to start from (required: the caller passes the integration branch, there is no guessing).
.PARAMETER From    Local ref (branch or SHA) to start from instead of origin/<Base>, e.g. the current PBI HEAD for a Task worktree (task-waves.md); nothing is fetched. -Base is still required and printed.
#>
[CmdletBinding()]
param(
  [string]$Issue,
  [string]$Branch,
  [string]$Base,
  [string]$From
)
# No Mandatory: a headless run must exit non-zero with a message instead of prompting.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
function Test-Link([string]$Path) { [bool]([IO.FileInfo]::new($Path).LinkTarget) } # also true for a dangling link
function Invoke-Git([string]$Root, [string[]]$GitArgs) {
  $out = & git -C $Root @GitArgs 2>&1
  if ($LASTEXITCODE -ne 0) { throw "git $($GitArgs -join ' ') failed: $(($out | ForEach-Object { "$_" }) -join ' ')" }
}
if ($Issue -notmatch '\A([0-9]{1,10}|loop-[0-9]{1,10}|[0-9]{1,10}-t[0-9]{1,10})\z') { throw "Invalid -Issue '$Issue': expected '<nr>', 'loop-<nr>' or '<nr>-t<nr>'." }
if (-not $Base) { throw 'Missing -Base: pass the integration branch (no default is guessed).' }
if ($Base -notmatch '\A[A-Za-z0-9][A-Za-z0-9._/-]{0,199}\z' -or $Base -match '\.\.|//|\.lock\z|/\z') { throw "Invalid -Base '$Base': expected a branch name on origin." }
if (-not $Branch) { $Branch = "feat/$Issue" }
if ($Branch -notmatch '\A[A-Za-z0-9][A-Za-z0-9._/-]{0,199}\z' -or $Branch -match '\.\.|//|\.lock\z|/\z') { throw "Invalid -Branch '$Branch'." }
& git check-ref-format --branch $Branch *> $null
if ($LASTEXITCODE -ne 0) { throw "Invalid -Branch '$Branch'." }

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
if (Test-Path -LiteralPath $target) { throw "Worktree path already exists: $target" }

& git -C $root check-ignore -q '.worktrees/x' 2>$null
if ($LASTEXITCODE -ne 0) { throw "'.worktrees/' is not ignored in $root. Run Enable-Worktrees.ps1 once per repository and commit the result." }
& git -C $root show-ref --verify --quiet "refs/heads/$Branch"
if ($LASTEXITCODE -eq 0) { throw "Branch already exists: $Branch" }

$start = "origin/$Base"
if ($From) {
  if ($From -notmatch '\A[A-Za-z0-9][A-Za-z0-9._/-]{0,199}\z' -or $From -match '\.\.|//') { throw "Invalid -From '$From'." }
  & git -C $root rev-parse --verify --quiet "$From^{commit}" *> $null
  if ($LASTEXITCODE -ne 0) { throw "Unknown -From ref '$From'." }
  $start = $From
} else { Invoke-Git $root @('fetch', 'origin', $Base) }
Invoke-Git $root @('worktree', 'add', '--no-track', '-b', $Branch, $target, $start)
[ordered]@{ path = $target; branch = $Branch; base = $Base } | ConvertTo-Json -Compress
