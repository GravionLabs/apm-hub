#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Claude Code adapter for Invoke-OrchestratorQueue.ps1: returns the executable and arguments for one headless run.
.DESCRIPTION
  claude --agent orchestrator -p "<mode> <issue>" --allowedTools "<narrow set>".
  The narrow set lets the pipeline read, edit, delegate to subagents and run git, gh and pwsh (ledger and skill
  scripts) plus the common build and test runners; anything else is denied in -p mode, so the run fails closed
  instead of hanging on a prompt. -AllowAll adds --dangerously-skip-permissions (explicit opt-in).
.PARAMETER Issue    Issue number.
.PARAMETER Mode     plan, implement, full or next.
.PARAMETER AllowAll Skip all permission checks.
.OUTPUTS PSCustomObject with Executable and Arguments.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidatePattern('\A[1-9][0-9]{0,9}\z')][string]$Issue,
  [ValidateSet('plan', 'implement', 'full', 'next')][string]$Mode = 'full',
  [switch]$AllowAll
)
$ErrorActionPreference = 'Stop'
$tools = @('Read', 'Grep', 'Glob', 'Edit', 'Write', 'Agent', 'Skill', 'SendMessage') +
  @(& (Join-Path $PSScriptRoot 'allowed-commands.ps1') | ForEach-Object { "Bash($_`:*)" })
$cliArgs = @('--agent', 'orchestrator', '-p', "$Mode $Issue", '--allowedTools', ($tools -join ','))
if ($AllowAll) { $cliArgs += '--dangerously-skip-permissions' }
[pscustomobject]@{ Executable = 'claude'; Arguments = $cliArgs }
