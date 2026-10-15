#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Creates .agents/<issue>/ and appends one line to its progress.md (the orchestrator ledger).
.DESCRIPTION
  The only shell command the orchestrator is allowed to use for ledger writes on OpenCode: the agent permission
  map cannot restrict a shell redirect target, so the path is validated here. -Issue must be a positive integer,
  'adhoc' or 'loop-<nr>' (the loop ledger); the resolved path must stay under <current directory>/.agents/ and a symlinked .agents/ or issue directory is refused. Without -Line only the directory is created.
.PARAMETER Issue Issue number, 'adhoc' or 'loop-<nr>'.
.PARAMETER Line  One line of text (no line breaks).
#>
[CmdletBinding()]
param(
  [string]$Issue,
  [string]$Line
)
# No Mandatory: a headless run must exit non-zero with a message instead of prompting.
$ErrorActionPreference = 'Stop'
if ($Issue -notmatch '\A([1-9][0-9]{0,9}|adhoc|loop-[1-9][0-9]{0,9})\z') { throw "Invalid -Issue '$Issue': expected a positive integer without leading zeros, 'adhoc' or 'loop-<nr>'." }
if ($PSBoundParameters.ContainsKey('Line') -and $Line -match '[\r\n\u0085  ]') { throw 'Invalid -Line: must be a single line.' }
$base = [IO.Path]::GetFullPath((Join-Path (Get-Location).Path '.agents'))
$dir = [IO.Path]::GetFullPath((Join-Path $base $Issue))
if (-not $dir.StartsWith($base + [IO.Path]::DirectorySeparatorChar)) { throw "Path escapes .agents/: $dir" }
# A symlinked .agents/ or issue directory is refused (it could point outside the project).
foreach ($p in @($base, $dir)) { if ((Test-Path -LiteralPath $p) -and (Get-Item -LiteralPath $p -Force).LinkTarget) { throw "Refusing symlinked path: $p" } }
New-Item -ItemType Directory -Path $dir -Force | Out-Null
if ($PSBoundParameters.ContainsKey('Line')) { Add-Content -LiteralPath (Join-Path $dir 'progress.md') -Value $Line -Encoding utf8 }
