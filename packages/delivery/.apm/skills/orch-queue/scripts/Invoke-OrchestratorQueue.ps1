#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Works through issues one by one, starting a fresh headless orchestrator process per issue.
.DESCRIPTION
  Issues come from positional arguments, -IssueFile (one number per line) or -Label (open issues via gh api GET).
  The ledger .agents/<issue>/progress.md is the source of truth, not the exit code:
    last line 'Ledger complete.'        -> done (before the run: skipped, nothing is started)
    new 'Gate: <question>' line         -> gate: the queue stops, the question is printed, exit 2
    neither                             -> failed: the queue stops (exit 1) unless -ContinueOnError
  Output of every run is appended to .agents/<issue>/run.log. The runner never merges and never answers a gate.
  Run it from the repository root. Exit codes: 0 all done/skipped, 1 failed, 2 gate.
.PARAMETER Issue           Issue numbers (positional), '#12' or '12'.
.PARAMETER IssueFile       Text file with one issue number per line.
.PARAMETER Label           Process all open issues (no PRs) with this label, ascending.
.PARAMETER Mode            plan, implement or full (default), forwarded to the orchestrator.
.PARAMETER Harness         Adapter in harness/<name>.ps1.
.PARAMETER ContinueOnError Continue with the next issue after a failed run.
.PARAMETER AllowAll        Opt in to the harness' unrestricted permission mode (default: narrow set).
.PARAMETER DryRun          Print the exact commands and run nothing.
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0, ValueFromRemainingArguments)]
  [ValidatePattern('\A#?[1-9][0-9]{0,9}\z')][string[]]$Issue,
  [string]$IssueFile,
  [ValidatePattern('\A[A-Za-z0-9][A-Za-z0-9 ._:/-]{0,49}\z')][string]$Label,
  [ValidateSet('plan', 'implement', 'full')][string]$Mode = 'full',
  [ValidatePattern('\A[a-z]{1,20}\z')][string]$Harness = 'claude',
  [switch]$ContinueOnError,
  [switch]$AllowAll,
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'

function ConvertTo-IssueNumber([string]$Text, [string]$Where) {
  $t = $Text.Trim() -replace '\A#', ''
  if ($t -notmatch '\A[1-9][0-9]{0,9}\z') { throw "Invalid issue number '$Text' ($Where)." }
  $t
}
function Format-Arg([string]$a) { if ($a -match '[\s"''()]' -or $a -eq '') { '"' + ($a -replace '"', '\"') + '"' } else { $a } }
function Get-LedgerLines([string]$n) {
  $f = Join-Path (Join-Path '.agents' $n) 'progress.md'
  if (Test-Path -LiteralPath $f) { @(Get-Content -LiteralPath $f | Where-Object { $_.Trim() }) } else { @() }
}
function Test-Complete([string[]]$Lines) { $Lines.Count -gt 0 -and $Lines[-1].Trim() -eq 'Ledger complete.' }
function Get-Gates([string[]]$Lines) { @($Lines | Where-Object { $_ -match '\AGate:' }) }

$issues = [System.Collections.Generic.List[string]]::new()
foreach ($i in $Issue) { $issues.Add((ConvertTo-IssueNumber $i 'argument')) }
if ($IssueFile) {
  if (-not (Test-Path -LiteralPath $IssueFile -PathType Leaf)) { throw "Issue file not found: $IssueFile" }
  $ln = 0
  foreach ($l in Get-Content -LiteralPath $IssueFile) { $ln++; if ($l.Trim()) { $issues.Add((ConvertTo-IssueNumber $l "$IssueFile line $ln")) } }
}
if ($Label) {
  if (-not (Get-Command gh -CommandType Application -ErrorAction SilentlyContinue)) { throw "'gh' not found on PATH (needed for -Label)." }
  $q = "repos/{owner}/{repo}/issues?state=open&per_page=100&labels=$([uri]::EscapeDataString($Label))"
  $found = @(& gh api --method GET --paginate $q --jq '.[] | select(.pull_request | not) | .number')
  if ($LASTEXITCODE -ne 0) { throw "gh api failed for label '$Label'." }
  foreach ($n in ($found | ForEach-Object { [int]$_ } | Sort-Object)) { $issues.Add("$n") }
}
$queue = @($issues | Select-Object -Unique)
if ($queue.Count -eq 0) { throw 'No issues: pass issue numbers, -IssueFile or -Label.' }

$adapter = Join-Path $PSScriptRoot "harness/$Harness.ps1"
if (-not (Test-Path -LiteralPath $adapter)) { throw "No adapter for harness '$Harness' (expected $adapter)." }

$results = [ordered]@{}
$exit = 0
$stopped = $false
foreach ($n in $queue) {
  if ($stopped) { $results[$n] = 'not-run'; continue }
  if (Test-Complete (Get-LedgerLines $n)) { $results[$n] = 'skipped'; continue }
  $cmd = & $adapter -Issue $n -Mode $Mode -AllowAll:$AllowAll
  $line = (@($cmd.Executable) + @($cmd.Arguments) | ForEach-Object { Format-Arg $_ }) -join ' '
  $envVars = if ($cmd.PSObject.Properties['Environment'] -and $cmd.Environment) { $cmd.Environment } else { @{} }
  $envText = (@($envVars.Keys | Sort-Object | ForEach-Object { "$_=$(Format-Arg $envVars[$_])" }) + $line) -join ' '
  if ($DryRun) { Write-Host "[dry-run] #${n}: $envText"; $results[$n] = 'dry-run'; continue }
  $bin = Get-Command $cmd.Executable -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $bin) { throw "'$($cmd.Executable)' not found on PATH (harness '$Harness'). Install it or pick another -Harness." }
  $gatesBefore = @(Get-Gates (Get-LedgerLines $n)).Count
  $dir = Join-Path '.agents' $n
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  $log = Join-Path $dir 'run.log'
  Write-Host "[run] #${n}: $envText"
  Add-Content -LiteralPath $log -Value "=== $(Get-Date -Format o) $envText" -Encoding utf8
  $saved = @{}
  foreach ($k in $envVars.Keys) { $saved[$k] = [Environment]::GetEnvironmentVariable($k); [Environment]::SetEnvironmentVariable($k, [string]$envVars[$k]) }
  try { & $bin.Source @($cmd.Arguments) 2>&1 | Tee-Object -FilePath $log -Append | Out-Host; $code = $LASTEXITCODE }
  finally { foreach ($k in $saved.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k]) } }
  Add-Content -LiteralPath $log -Value "=== exit code $code" -Encoding utf8
  $after = Get-LedgerLines $n
  $gates = @(Get-Gates $after)
  if (Test-Complete $after) { $results[$n] = 'done' }
  elseif ($gates.Count -gt $gatesBefore) {
    $results[$n] = 'gate'
    Write-Host "Gate on #${n}, queue stopped (answer it, then run the queue again): $($gates[-1])"
    $exit = 2; $stopped = $true
  } else {
    $results[$n] = 'failed'
    if ($exit -eq 0) { $exit = 1 }
    if (-not $ContinueOnError) { $stopped = $true }
  }
}
foreach ($k in $results.Keys) { Write-Host "#$k $($results[$k])" }
exit $exit
