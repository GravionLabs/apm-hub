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
  then runs: pwsh -NoProfile -File <runner> <args>. The env var QUEUE_RUNNER (full path to Invoke-OrchestratorQueue.ps1) is
  checked first. A project-local runner is announced on stderr and runs with your rights: do not run 'queue' in a repository
  you do not trust. The caller's directory is passed as QUEUE_CALLER_CWD so a relative -IssueFile still resolves. The cmd
  variant restores the caller's directory and returns the runner's exit code (setlocal / endlocal).
  Idempotent: identical content is a no-op. A different existing file (an older launcher or a foreign file without the marker
  comment 'apm-hub queue launcher') is only overwritten with -Force. A symlinked launcher file is never followed (error).
  -Uninstall removes only a file that carries the marker. PATH and shell profiles are never edited; a hint is printed when
  -Dir is not on PATH. Supports -WhatIf and -Confirm.
.PARAMETER Dir        Target directory (default ~/.local/bin; a leading ~ is expanded; created if missing).
.PARAMETER Flavor     sh or cmd; default by platform. With -Show it selects which launcher text is printed.
.PARAMETER Show       Print the launcher text and exit; writes nothing (used by the tests to check the cmd variant).
.PARAMETER Force      Overwrite an existing different launcher or foreign file.
.PARAMETER Uninstall  Remove the launcher instead of installing it.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [ValidateNotNullOrEmpty()][string]$Dir = (Join-Path $HOME '.local/bin'),
  [switch]$Force,
  [switch]$Uninstall,
  [ValidateSet('sh', 'cmd')][string]$Flavor,
  [switch]$Show
)
$ErrorActionPreference = 'Stop'
if ($Dir -eq '~' -or $Dir -match '\A~[/\\]') { $Dir = Join-Path $HOME $Dir.Substring(1).TrimStart('/', '\') }

$marker = 'apm-hub queue launcher'
$runnerRel = 'queue/scripts/Invoke-OrchestratorQueue.ps1'
$sh = @'
#!/bin/sh
# apm-hub queue launcher
top=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "queue: not inside a git repository" >&2; exit 1; }
runner=
if [ -n "$QUEUE_RUNNER" ]; then
  [ -f "$QUEUE_RUNNER" ] || { echo "queue: QUEUE_RUNNER is not a file: $QUEUE_RUNNER" >&2; exit 1; }
  runner=$QUEUE_RUNNER
else
  for base in "$top/.claude/skills" "$top/.opencode/skills" "$top/.agents/skills" "$top/.github/skills" \
    "$HOME/.claude/skills" "$HOME/.agents/skills" "$HOME/.config/opencode/skills"; do
    if [ -f "$base/queue/scripts/Invoke-OrchestratorQueue.ps1" ]; then runner="$base/queue/scripts/Invoke-OrchestratorQueue.ps1"; break; fi
  done
  case "$runner" in "$top"/*) echo "queue: using project-local runner $runner" >&2 ;; esac
fi
[ -n "$runner" ] || { echo "queue: Invoke-OrchestratorQueue.ps1 not found; install the delivery package (apm install)" >&2; exit 1; }
QUEUE_CALLER_CWD=$(pwd); export QUEUE_CALLER_CWD
cd "$top" || exit 1
exec pwsh -NoProfile -File "$runner" "$@"
'@
$cmd = @'
@echo off
setlocal
rem apm-hub queue launcher
set "TOP="
for /f "delims=" %%i in ('git rev-parse --show-toplevel 2^>nul') do set "TOP=%%i"
if not defined TOP (
  echo queue: not inside a git repository 1>&2
  exit /b 1
)
set "RUNNER="
if defined QUEUE_RUNNER (
  if not exist "%QUEUE_RUNNER%" (
    echo queue: QUEUE_RUNNER is not a file: %QUEUE_RUNNER% 1>&2
    exit /b 1
  )
  set "RUNNER=%QUEUE_RUNNER%"
)
for %%b in ("%TOP%\.claude\skills" "%TOP%\.opencode\skills" "%TOP%\.agents\skills" "%TOP%\.github\skills" "%USERPROFILE%\.claude\skills" "%USERPROFILE%\.agents\skills" "%USERPROFILE%\.config\opencode\skills") do (
  if not defined RUNNER if exist "%%~b\queue\scripts\Invoke-OrchestratorQueue.ps1" set "RUNNER=%%~b\queue\scripts\Invoke-OrchestratorQueue.ps1"
)
if not defined RUNNER (
  echo queue: Invoke-OrchestratorQueue.ps1 not found; install the delivery package ^(apm install^) 1>&2
  exit /b 1
)
if not defined QUEUE_RUNNER (
  call set "REL=%%RUNNER:%TOP%=%%"
)
if not defined QUEUE_RUNNER if not "%REL%"=="%RUNNER%" echo queue: using project-local runner %RUNNER% 1>&2
set "QUEUE_CALLER_CWD=%CD%"
cd /d "%TOP%"
pwsh -NoProfile -File "%RUNNER%" %*
endlocal & exit /b %ERRORLEVEL%
'@

$flavor = if ($Flavor) { $Flavor } elseif ($IsWindows) { 'cmd' } else { 'sh' }
$name = if ($flavor -eq 'cmd') { 'queue.cmd' } else { 'queue' }
$content = if ($flavor -eq 'cmd') { ($cmd -replace "`r?`n", "`r`n") + "`r`n" } else { ($sh -replace "`r`n", "`n") + "`n" }
if ($Show) { Write-Output $content; return }
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
  if ($flavor -eq 'sh') { & chmod 755 $target; if ($LASTEXITCODE -ne 0) { throw "chmod failed for $target" } }
  Write-Host "Installed $target"
  try {  # the hint must never fail the install
    $onPath = ($env:PATH -split [IO.Path]::PathSeparator) | Where-Object { $_ -and ([IO.Path]::GetFullPath($_).TrimEnd('/', '\') -eq $dirFull.TrimEnd('/', '\')) }
    if (-not $onPath) { Write-Host "Note: $dirFull is not on PATH. Add it to your PATH yourself; this script does not edit PATH or profiles." }
  } catch { Write-Verbose "PATH hint skipped: $($_.Exception.Message)" }
}
