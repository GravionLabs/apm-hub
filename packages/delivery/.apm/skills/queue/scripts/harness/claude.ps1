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
.PARAMETER Mode     plan, implement, full, next or status.
.PARAMETER FixAdvisories Optional advisory policy (none, medium, all; optionally `:dim,dim`) passed to the orchestrator as `--fix-advisories <policy>` before the mode word.
.PARAMETER PbiParallel Optional 1-4, passed as `--pbi-parallel <m>` before the mode word (after `--fix-advisories`).
.PARAMETER Parallel Optional Task-wave width 1-4, passed to the orchestrator as `--parallel <n>` after `--fix-advisories`; 0 = not given.
.PARAMETER AllowAll Skip all permission checks.
.OUTPUTS PSCustomObject with Executable and Arguments.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidatePattern('\A[1-9][0-9]{0,9}\z')][string]$Issue,
  [ValidateSet('plan', 'implement', 'full', 'next', 'status')][string]$Mode = 'full',
  [ValidatePattern('(?-i)\A(none|medium|all)(:[a-z][a-z-]*(,[a-z][a-z-]*)*)?\z')][string]$FixAdvisories = '',
  [ValidateRange(1, 4)][int]$PbiParallel,
  [ValidateRange(1, 4)][int]$Parallel = 0,
  [switch]$AllowAll
)
$ErrorActionPreference = 'Stop'
$prompt = ($FixAdvisories ? "--fix-advisories $FixAdvisories " : '') + ($PbiParallel ? "--pbi-parallel $PbiParallel " : '') + ($Parallel ? "--parallel $Parallel " : '') + "$Mode $Issue"
$tools = @('Read', 'Grep', 'Glob', 'Edit', 'Write', 'Agent', 'Skill', 'SendMessage') +
  @(& (Join-Path $PSScriptRoot 'allowed-commands.ps1') | ForEach-Object { "Bash($_`:*)" })
$cliArgs = @('--agent', 'orchestrator', '-p', $prompt, '--allowedTools', ($tools -join ','))
if ($AllowAll) { $cliArgs += '--dangerously-skip-permissions' }
[pscustomobject]@{ Executable = 'claude'; Arguments = $cliArgs }
