#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  OpenCode adapter for Invoke-OrchestratorQueue.ps1: returns the executable, arguments and environment for one headless run.
.DESCRIPTION
  opencode run --agent orchestrator "<mode> <issue>". The narrow permission set travels in the OPENCODE_PERMISSION
  environment variable (JSON merged into the config): edits (not under .git/; .agents/ stays writable for reports), subagents and skills allowed, bash only for git, gh, pwsh
  and the common build and test runners, everything else denied, so the run fails closed. -AllowAll uses --auto
  (auto-approves permissions that are not explicitly denied) and sets no environment (explicit opt-in).
.PARAMETER Issue    Issue number.
.PARAMETER Mode     plan, implement, full or next.
.PARAMETER FixAdvisories Optional advisory policy (none, medium, all; optionally `:dim,dim`) passed to the orchestrator as `--fix-advisories <policy>` before the mode word.
.PARAMETER AllowAll Auto-approve permissions.
.OUTPUTS PSCustomObject with Executable, Arguments and Environment (hashtable, may be empty).
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidatePattern('\A[1-9][0-9]{0,9}\z')][string]$Issue,
  [ValidateSet('plan', 'implement', 'full', 'next')][string]$Mode = 'full',
  [ValidatePattern('\A(none|medium|all)(:[A-Za-z0-9_-]+(,[A-Za-z0-9_-]+)*)?\z')][string]$FixAdvisories = '',
  [switch]$AllowAll
)
$ErrorActionPreference = 'Stop'
$prompt = ($FixAdvisories ? "--fix-advisories $FixAdvisories " : '') + "$Mode $Issue"
$cliArgs = @('run', '--agent', 'orchestrator')
$envVars = @{}
if ($AllowAll) { $cliArgs += '--auto' }
else {
  $bash = [ordered]@{ '*' = 'deny' }
  foreach ($s in & (Join-Path $PSScriptRoot 'allowed-commands.ps1')) { $bash["$s *"] = 'allow' }
  $envVars['OPENCODE_PERMISSION'] = [ordered]@{ edit = [ordered]@{ '*' = 'allow'; '.git/**' = 'deny' }; task = 'allow'; skill = 'allow'; bash = $bash } | ConvertTo-Json -Compress -Depth 5
}
$cliArgs += $prompt
[pscustomobject]@{ Executable = 'opencode'; Arguments = $cliArgs; Environment = $envVars }
