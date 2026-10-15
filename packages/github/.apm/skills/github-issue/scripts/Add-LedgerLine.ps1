#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Creates .agents/<issue>/ and appends one line to its progress.md (the orchestrator ledger).
.DESCRIPTION
  The only shell command the orchestrator is allowed to use for ledger writes on OpenCode: the agent permission
  map cannot restrict a shell redirect target, so the path is validated here. -Issue must be a positive integer or
  'adhoc'; the resolved path must stay under <current directory>/.agents/. Without -Line only the directory is created.
.PARAMETER Issue Issue number or 'adhoc'.
.PARAMETER Line  One line of text (no line breaks).
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Issue,
  [string]$Line
)
$ErrorActionPreference = 'Stop'
if ($Issue -notmatch '^([1-9][0-9]{0,9}|adhoc)$') { throw "Invalid -Issue '$Issue': expected a positive integer or 'adhoc'." }
if ($PSBoundParameters.ContainsKey('Line') -and $Line -match '[\r\n]') { throw 'Invalid -Line: must be a single line.' }
$base = [IO.Path]::GetFullPath((Join-Path (Get-Location).Path '.agents'))
$dir = [IO.Path]::GetFullPath((Join-Path $base $Issue))
if (-not $dir.StartsWith($base + [IO.Path]::DirectorySeparatorChar)) { throw "Path escapes .agents/: $dir" }
New-Item -ItemType Directory -Path $dir -Force | Out-Null
if ($PSBoundParameters.ContainsKey('Line')) { Add-Content -LiteralPath (Join-Path $dir 'progress.md') -Value $Line -Encoding utf8 }
