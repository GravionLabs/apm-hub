#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Writes .agents/status-<issue>.md (the headless output of the orchestrator mode 'status'), replacing an existing file.
.DESCRIPTION
  The only shell command the orchestrator is allowed to use for the status table on OpenCode: the agent permission
  map cannot restrict a shell redirect target, so the path is validated here. -Issue must be a positive integer
  without leading zeros; the target is <current directory>/.agents/status-<issue>.md and a symlinked .agents/ or
  target is refused. The content comes from -Path (a file) or, without -Path, from stdin. The write is atomic:
  a temp file in .agents/ is moved over the target.
.PARAMETER Issue Feature or Epic number.
.PARAMETER Path  File that holds the table. Without it the table is read from stdin.
#>
[CmdletBinding()]
param(
  [string]$Issue,
  [string]$Path
)
# No Mandatory: a headless run must exit non-zero with a message instead of prompting.
$ErrorActionPreference = 'Stop'
if ($Issue -notmatch '\A[1-9][0-9]{0,9}\z') { throw "Invalid -Issue '$Issue': expected a positive integer without leading zeros." }
$text = if ($PSBoundParameters.ContainsKey('Path')) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Content file not found: $Path" }
  Get-Content -LiteralPath $Path -Raw
} else { [Console]::In.ReadToEnd() }
if ([string]::IsNullOrWhiteSpace($text)) { throw 'No content: pass -Path or pipe the table on stdin.' }
$text = $text.TrimEnd("`r", "`n") + "`n"
$base = [IO.Path]::GetFullPath((Join-Path (Get-Location).Path '.agents'))
$file = [IO.Path]::GetFullPath((Join-Path $base "status-$Issue.md"))
if (-not $file.StartsWith($base + [IO.Path]::DirectorySeparatorChar)) { throw "Path escapes .agents/: $file" }
# A symlinked .agents/ or target is refused (it could point outside the project).
# Get-Item -Force (not Test-Path) also sees a dangling symlink.
foreach ($p in @($base, $file)) { $i = Get-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue; if ($i -and $i.LinkTarget) { throw "Refusing symlinked path: $p" } }
New-Item -ItemType Directory -Path $base -Force | Out-Null
$tmp = Join-Path $base ".status-$Issue.$([guid]::NewGuid().ToString('N')).tmp"
try {
  [IO.File]::WriteAllText($tmp, $text, [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $tmp -Destination $file -Force
} finally { if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force } }
