#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Installs (or removes) a small 'queue' launcher that runs Invoke-OrchestratorQueue.ps1 from any directory.
.DESCRIPTION
  Writes one file into -Dir: 'queue' (POSIX sh, chmod +x) on Linux/macOS, 'queue.cmd' on Windows. The runner itself is never
  copied. At call time the launcher cd's to the git toplevel (error outside a git repository) and looks for
  skills/queue/scripts/Invoke-OrchestratorQueue.ps1 in, in this order:
    <git toplevel>/.claude/skills, .opencode/skills, .agents/skills, .github/skills, ~/.claude/skills, ~/.agents/skills,
    ~/.config/opencode/skills
  then runs: pwsh -NoProfile -File <runner> <args>.
  Idempotent: identical content is a no-op. A different existing file (an older launcher or a foreign file without the marker
  comment 'apm-hub queue launcher') is only overwritten with -Force. A symlinked launcher file is never followed (error).
  -Uninstall removes only a file that carries the marker. PATH and shell profiles are never edited; a hint is printed when
  -Dir is not on PATH. Supports -WhatIf and -Confirm.
.PARAMETER Dir        Target directory (default ~/.local/bin; created if missing).
.PARAMETER Force      Overwrite an existing different launcher or foreign file.
.PARAMETER Uninstall  Remove the launcher instead of installing it.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [ValidateNotNullOrEmpty()][string]$Dir = (Join-Path $HOME '.local/bin'),
  [switch]$Force,
  [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'

$marker = 'apm-hub queue launcher'
$runnerRel = 'queue/scripts/Invoke-OrchestratorQueue.ps1'
$sh = @'
#!/bin/sh
# apm-hub queue launcher
top=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "queue: not inside a git repository" >&2; exit 1; }
runner=
for base in "$top/.claude/skills" "$top/.opencode/skills" "$top/.agents/skills" "$top/.github/skills" \
  "$HOME/.claude/skills" "$HOME/.agents/skills" "$HOME/.config/opencode/skills"; do
  if [ -f "$base/queue/scripts/Invoke-OrchestratorQueue.ps1" ]; then runner="$base/queue/scripts/Invoke-OrchestratorQueue.ps1"; break; fi
done
[ -n "$runner" ] || { echo "queue: Invoke-OrchestratorQueue.ps1 not found; install the delivery package (apm install)" >&2; exit 1; }
cd "$top" || exit 1
exec pwsh -NoProfile -File "$runner" "$@"
'@
$cmd = @'
@echo off
rem apm-hub queue launcher
set "TOP="
for /f "delims=" %%i in ('git rev-parse --show-toplevel 2^>nul') do set "TOP=%%i"
if not defined TOP (
  echo queue: not inside a git repository 1>&2
  exit /b 1
)
set "RUNNER="
for %%b in ("%TOP%\.claude\skills" "%TOP%\.opencode\skills" "%TOP%\.agents\skills" "%TOP%\.github\skills" "%USERPROFILE%\.claude\skills" "%USERPROFILE%\.agents\skills" "%USERPROFILE%\.config\opencode\skills") do (
  if not defined RUNNER if exist "%%~b\queue\scripts\Invoke-OrchestratorQueue.ps1" set "RUNNER=%%~b\queue\scripts\Invoke-OrchestratorQueue.ps1"
)
if not defined RUNNER (
  echo queue: Invoke-OrchestratorQueue.ps1 not found; install the delivery package ^(apm install^) 1>&2
  exit /b 1
)
cd /d "%TOP%"
pwsh -NoProfile -File "%RUNNER%" %*
exit /b %ERRORLEVEL%
'@

$name = if ($IsWindows) { 'queue.cmd' } else { 'queue' }
$content = if ($IsWindows) { ($cmd -replace "`r?`n", "`r`n") + "`r`n" } else { ($sh -replace "`r`n", "`n") + "`n" }
$dirFull = [IO.Path]::GetFullPath($Dir, $PWD.Path)
$target = Join-Path $dirFull $name

$item = Get-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
if ($item) {
  if ($item.LinkType) { throw "$target is a symlink; refusing to follow it." }
  if ($item.PSIsContainer) { throw "$target is a directory." }
  $existing = [IO.File]::ReadAllText($target)
  $ours = $existing -match "(?m)^(# |rem )$([regex]::Escape($marker))\s*$"
}

if ($Uninstall) {
  if (-not $item) { Write-Host "Nothing to remove: $target does not exist."; return }
  if (-not $ours) { Write-Warning "$target is not an apm-hub queue launcher; left untouched."; return }
  if ($PSCmdlet.ShouldProcess($target, 'Remove queue launcher')) { Remove-Item -LiteralPath $target; Write-Host "Removed $target" }
  return
}

if ($item) {
  if ($existing -ceq $content) { Write-Host "Up to date: $target"; return }
  if (-not $Force) {
    $why = if ($ours) { 'a different version of the launcher' } else { 'not an apm-hub queue launcher' }
    throw "$target exists and is $why. Use -Force to overwrite."
  }
}

if ($PSCmdlet.ShouldProcess($target, 'Write queue launcher')) {
  New-Item -ItemType Directory -Path $dirFull -Force | Out-Null
  [IO.File]::WriteAllText($target, $content, [Text.UTF8Encoding]::new($false))
  if (-not $IsWindows) { & chmod 755 $target; if ($LASTEXITCODE -ne 0) { throw "chmod failed for $target" } }
  Write-Host "Installed $target"
  $onPath = ($env:PATH -split [IO.Path]::PathSeparator) | Where-Object { $_ -and ([IO.Path]::GetFullPath($_).TrimEnd('/', '\') -eq $dirFull.TrimEnd('/', '\')) }
  if (-not $onPath) { Write-Host "Note: $dirFull is not on PATH. Add it to your PATH yourself; this script does not edit PATH or profiles." }
}
