#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Writes <state directory>/status-<issue>.md (the headless output of the orchestrator mode 'status'), replacing an existing file.
.DESCRIPTION
  The only shell command the orchestrator is allowed to use for the status table on OpenCode: the agent permission
  map cannot restrict a shell redirect target, so the path is validated here. -Issue must be a positive integer
  without leading zeros; the target is <state directory>/status-<issue>.md (state directory: DROMOS_STATE_DIR, else <git common dir>/agents) and a symlinked state directory or
  target is refused. Control characters and escape sequences are stripped from the content. The content comes from -Path (a file) or, without -Path, from stdin. The write is atomic:
  a temp file in the state directory is moved over the target.
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
# Issue titles are untrusted data: strip CSI, OSC (BEL or ST terminated, payload limited to one line so an unterminated
# OSC cannot swallow later rows), other ESC sequences and control characters (C0 except tab and newline, DEL, C1).
# Same patterns as Remove-ControlChar in delivery/skills/queue/scripts/Invoke-OrchestratorQueue.ps1: skills do not share code.
$text = [regex]::Replace($text, '\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b\r\n]*(\x07|\x1b\\)|\x1b.?', '')
$text = [regex]::Replace($text, '[\x00-\x08\x0b-\x1f\x7f-\x9f]', '')
$text = $text.TrimEnd("`r", "`n") + "`n"
# BEGIN Resolve-StateDir (identical in every script that defines it; test/repo/state-dir-resolver.test.ts)
function Resolve-StateDir {
  if ($env:DROMOS_STATE_DIR) { return [IO.Path]::GetFullPath($env:DROMOS_STATE_DIR, (Get-Location).Path) }
  $common = $null
  try { $common = "$(& git -C (Get-Location).Path rev-parse --path-format=absolute --git-common-dir 2>$null)".Trim() } catch { $common = $null }
  if ($LASTEXITCODE -ne 0 -or -not $common) { throw 'No state directory: not inside a git repository (set DROMOS_STATE_DIR)' }
  [IO.Path]::GetFullPath((Join-Path $common 'agents'))
}
# END Resolve-StateDir
$base = Resolve-StateDir
$file = [IO.Path]::GetFullPath((Join-Path $base "status-$Issue.md"))
if (-not $file.StartsWith($base + [IO.Path]::DirectorySeparatorChar)) { throw "Path escapes the state directory: $file" }
# A symlinked state directory or target is refused (it could point outside the project).
# Get-Item -Force (not Test-Path) also sees a dangling symlink.
foreach ($p in @($base, $file)) { $i = Get-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue; if ($i -and $i.LinkTarget) { throw "Refusing symlinked path: $p" } }
New-Item -ItemType Directory -Path $base -Force | Out-Null
$tmp = Join-Path $base ".status-$Issue.$([guid]::NewGuid().ToString('N')).tmp"
try {
  [IO.File]::WriteAllText($tmp, $text, [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $tmp -Destination $file -Force
} finally { if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force } }
