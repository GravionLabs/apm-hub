#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  OpenCode adapter for Invoke-OrchestratorQueue.ps1: returns the executable, arguments and environment for one headless run.
.DESCRIPTION
  opencode run --agent orchestrator "<mode> <issue>". The narrow permission set travels in the OPENCODE_PERMISSION
  environment variable (JSON merged into the config): edits (not under .git/; the state dir <git common dir>/agents or DROMOS_STATE_DIR stays writable via an absolute allow entry, resolved at harness time), subagents and skills allowed, bash only for git, gh, pwsh
  and the common build and test runners, everything else denied, so the run fails closed. -AllowAll uses --auto
  (auto-approves permissions that are not explicitly denied) and sets no environment (explicit opt-in).
.PARAMETER Issue    Issue number.
.PARAMETER Mode     plan, implement, full, next or status.
.PARAMETER FixAdvisories Optional advisory policy (none, medium, all; optionally `:dim,dim`) passed to the orchestrator as `--fix-advisories <policy>` before the mode word.
.PARAMETER AllowAll Auto-approve permissions.
.OUTPUTS PSCustomObject with Executable, Arguments and Environment (hashtable, may be empty).
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidatePattern('\A[1-9][0-9]{0,9}\z')][string]$Issue,
  [ValidateSet('plan', 'implement', 'full', 'next', 'status')][string]$Mode = 'full',
  [ValidatePattern('(?-i)\A(none|medium|all)(:[a-z][a-z-]*(,[a-z][a-z-]*)*)?\z')][string]$FixAdvisories = '',
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
  $edit = [ordered]@{ '*' = 'allow'; '.git/**' = 'deny' }
  # The state dir lives inside .git/ for a normal checkout: allow it by absolute pattern (listed last so it wins over the deny).
  $stateDir = $null
  if ($env:DROMOS_STATE_DIR) { $stateDir = [IO.Path]::GetFullPath($env:DROMOS_STATE_DIR, (Get-Location).Path) }
  else {
    $common = $null
    try { $common = "$(& git -C (Get-Location).Path rev-parse --path-format=absolute --git-common-dir 2>$null)".Trim() } catch { $common = $null }
    if ($LASTEXITCODE -eq 0 -and $common) { $stateDir = [IO.Path]::GetFullPath((Join-Path $common 'agents')) }
  }
  # the allow glob must be one concrete directory: no wildcard characters, never the filesystem root
  if ($stateDir) { $stateDir = [IO.Path]::TrimEndingDirectorySeparator($stateDir) }
  if ($stateDir -and ($stateDir -match '[*?\[\]{}]' -or $stateDir -eq [IO.Path]::GetPathRoot($stateDir))) { throw "Refusing the edit allow entry for state directory '$stateDir': wildcard characters or a filesystem root." }
  if ($stateDir) { $edit[($stateDir.TrimEnd('/', '\') -replace '\\', '/') + '/**'] = 'allow' }
  $envVars['OPENCODE_PERMISSION'] = [ordered]@{ edit = $edit; task = 'allow'; skill = 'allow'; bash = $bash } | ConvertTo-Json -Compress -Depth 5
}
$cliArgs += $prompt
[pscustomobject]@{ Executable = 'opencode'; Arguments = $cliArgs; Environment = $envVars }
