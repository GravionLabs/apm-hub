#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  GitHub Copilot CLI adapter for Invoke-OrchestratorQueue.ps1: returns the executable and arguments for one headless run.
.DESCRIPTION
  copilot -p "<mode> <issue>" --agent=orchestrator --no-ask-user --allow-tool=<narrow set>.
  --no-ask-user keeps the run from waiting on the ask_user tool. In -p mode tools that are not allowed are denied,
  so the run fails closed. The narrow set allows file edits ('write') and git, gh, pwsh and the common build and
  test runners; the Copilot CLI has no per-call subagent permission, delegation to subagents needs no entry.
  -AllowAll adds --allow-all-tools (explicit opt-in).
.PARAMETER Issue    Issue number.
.PARAMETER Mode     plan, implement, full or next.
.PARAMETER AllowAll Allow every tool without confirmation.
.OUTPUTS PSCustomObject with Executable and Arguments.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidatePattern('\A[1-9][0-9]{0,9}\z')][string]$Issue,
  [ValidateSet('plan', 'implement', 'full', 'next')][string]$Mode = 'full',
  [switch]$AllowAll
)
$ErrorActionPreference = 'Stop'
$shell = 'git', 'gh', 'pwsh', 'pnpm', 'npm', 'npx', 'node', 'dotnet', 'uv', 'python', 'ng'
$cliArgs = @('-p', "$Mode $Issue", '--agent=orchestrator', '--no-ask-user')
if ($AllowAll) { $cliArgs += '--allow-all-tools' }
else {
  $cliArgs += '--allow-tool=write'
  foreach ($s in $shell) { $cliArgs += "--allow-tool=shell($s`:*)" }
}
[pscustomobject]@{ Executable = 'copilot'; Arguments = $cliArgs }
