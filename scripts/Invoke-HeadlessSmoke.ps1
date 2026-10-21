#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Headless smoke test of the orchestrator ledger on OpenCode and Claude Code.
.DESCRIPTION
  Creates a throwaway git repo (no remote, so nothing is written to GitHub) per client and stage and starts the
  orchestrator headless. Stage 'ledger': append the ledger header with Add-LedgerLine.ps1; asserts the header line in
  .agents/<issue>/progress.md and no permission prompt. Stage 'plan': `plan <description>` with the full agent body;
  asserts no permission prompt and a ledger with a `Gate:` line or a completed phase (opt-in, model-dependent). A client whose CLI is
  missing is skipped. Exits 1 on any failure and 2 when every client was skipped. Not run in CI (needs the CLIs, a model and the agent
  installed: apm install). OpenCode runs the agent from the project fixture (permission map taken from
  packages/agents/.apm/agents/orchestrator.agent.md); Claude Code uses the installed orchestrator agent.
  See docs/working-mode.md.
.PARAMETER Client  opencode, claude or both (default both).
.PARAMETER Stage   ledger (default), plan (experimental: model-dependent, see docs/working-mode.md) or all.
.PARAMETER Issue   Issue number used for the ledger folder (default 999).
.PARAMETER TimeoutSec Per run timeout (default 180).
.PARAMETER Keep    Keep the fixture directories.
#>
[CmdletBinding()]
param(
  [ValidateSet('opencode', 'claude', 'both')][string]$Client = 'both',
  [ValidateSet('ledger', 'plan', 'all')][string]$Stage = 'ledger',
  [int]$Issue = 999,
  [int]$TimeoutSec = 180,
  [switch]$Keep
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$helper = Join-Path $root 'packages/github/.apm/skills/github-issue/scripts/Add-LedgerLine.ps1'
$header = "# orchestrator ledger — issue #$Issue — branch main"
# Installed location per client (the permission map pins these paths).
function Get-HelperRel([string]$Name) { ($Name -eq 'opencode' ? '.opencode' : '.claude') + '/skills/github-issue/scripts/Add-LedgerLine.ps1' }
function Get-LedgerPrompt([string]$Name) { "Ledger check only, no GitHub access: write the single line '$header' to the ledger of issue $Issue with: pwsh $(Get-HelperRel $Name) -Issue $Issue -Line '$header'. Run only that command, do not read anything back, then stop." }
$planPrompt = 'plan add a greet(name) function to the fixture project in src/greet.ts'
$promptRx = 'permission requested|auto-rejecting|requires approval|asked for approval|blocked the command|needs approval'

function New-Fixture([string]$Name) {
  $dir = Join-Path ([IO.Path]::GetTempPath()) "apm-hub-smoke-$Name-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
  New-Item -ItemType Directory -Path $dir | Out-Null
  Push-Location $dir
  try {
    git init -q
    '{ "name": "fixture", "version": "0.0.0" }' | Set-Content package.json
    git add package.json
    git -c user.email=smoke@example.com -c user.name=smoke commit -qm init
  } finally { Pop-Location }
  $rel = Get-HelperRel ($Name -replace '-.*$', '')
  New-Item -ItemType Directory -Path (Join-Path $dir (Split-Path $rel)) -Force | Out-Null
  Copy-Item $helper (Join-Path $dir $rel)
  $dir
}

function Get-OpenCodeAgent([bool]$Full) {
  # Sanitized project agent: flat frontmatter from metadata.opencode; the body only for the plan stage.
  $src = Get-Content (Join-Path $root 'packages/agents/.apm/agents/orchestrator.agent.md') -Raw
  $m = [regex]::Match($src, '(?s)    mode: primary\r?\n    permission:\r?\n(.*?)\r?\n---\r?\n(.*)$')
  if (-not $m.Success) { throw 'metadata.opencode.permission not found in orchestrator.agent.md' }
  $perm = ($m.Groups[1].Value -split "\r?\n" | ForEach-Object { $_.Substring(4) }) -join "`n"
  $body = $Full ? $m.Groups[2].Value : 'You run the issue lifecycle. Write the ledger only with the Add-LedgerLine.ps1 command you are given.'
  "---`ndescription: orchestrator smoke`nmode: primary`npermission:`n$perm`n---`n$body`n"
}

function Invoke-Client([string]$Name, [string]$Dir, [string]$Prompt, [bool]$Full) {
  $bin = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $bin) { $bin = Get-Command (Join-Path $HOME ($Name -eq 'opencode' ? '.opencode/bin/opencode' : '.local/bin/claude')) -ErrorAction SilentlyContinue }
  if (-not $bin) { return $null }
  # Claude Code has no per-agent bash allow list: the run is allowed the ledger helper (--allowedTools here;
  # permissions.allow in the project settings in real use, see docs/working-mode.md). Plan stage: git/gh read access too.
  $allow = @('Bash(pwsh .claude/skills/github-issue/scripts/Add-LedgerLine.ps1 *)') + ($Full ? @('Bash(git *)', 'Bash(gh *)', 'Bash(pwsh .claude/skills/detect-techstack/scripts/Detect-TechStack.ps1 *)') : @())
  $cliArgs = $Name -eq 'opencode' ? @('run', '--agent', 'orchestrator', $Prompt) : @('-p', '--agent', 'orchestrator', '--allowedTools') + $allow + @('--', $Prompt)
  if ($Name -eq 'opencode') {
    New-Item -ItemType Directory -Path (Join-Path $Dir '.opencode/agents') -Force | Out-Null
    Set-Content (Join-Path $Dir '.opencode/agents/orchestrator.md') (Get-OpenCodeAgent $Full) -NoNewline
  }
  foreach ($attempt in 1..2) {
    $psi = [Diagnostics.ProcessStartInfo]::new($bin.Source)
    foreach ($x in $cliArgs) { $psi.ArgumentList.Add($x) }
    $psi.WorkingDirectory = $Dir
    $psi.Environment['PWD'] = $Dir   # clients read $PWD, not the process cwd: without it they run in the caller's repo
    # Empty user config: an agents directory in an older format must not break the run (set on the child only).
    $psi.Environment['XDG_CONFIG_HOME'] = (New-Item -ItemType Directory -Force (Join-Path $Dir '.xdg-config')).FullName
    $psi.RedirectStandardInput = $psi.RedirectStandardOutput = $psi.RedirectStandardError = $true
    $proc = [Diagnostics.Process]::Start($psi)
    $proc.StandardInput.Close()
    $stdout = $proc.StandardOutput.ReadToEndAsync(); $stderr = $proc.StandardError.ReadToEndAsync()
    if (-not $proc.WaitForExit($TimeoutSec * 1000)) { $proc.Kill($true); return 'TIMEOUT' }
    $result = $stdout.Result + "`n" + $stderr.Result
    if ($result -notmatch 'Unexpected server error') { break }   # transient provider error: retry once
  }
  $result
}

$clients = $Client -eq 'both' ? @('opencode', 'claude') : @($Client)
$stages = $Stage -eq 'all' ? @('ledger', 'plan') : @($Stage)
$failed = 0; $ran = 0
foreach ($c in $clients) {
  foreach ($st in $stages) {
    $full = $st -eq 'plan'
    $dir = New-Fixture "$c-$st"
    $out = Invoke-Client $c $dir ($full ? $planPrompt : (Get-LedgerPrompt $c)) $full
    if ($null -eq $out) { Write-Host "SKIP $c/$st (CLI not found)"; Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue; continue }
    $ran++
    $problems = @()
    # The fixture is a git repo: its state dir is <git common dir>/agents unless DROMOS_STATE_DIR is set (relative: against the fixture).
    $stateDir = $env:DROMOS_STATE_DIR ? [IO.Path]::GetFullPath($env:DROMOS_STATE_DIR, $dir) : (Join-Path (& git -C $dir rev-parse --path-format=absolute --git-common-dir).Trim() 'agents')
    $dirs = @(Get-ChildItem $stateDir -Directory -ErrorAction SilentlyContinue)
    $ledgerFile = $full ? ($dirs | ForEach-Object { Join-Path $_.FullName 'progress.md' } | Where-Object { Test-Path $_ } | Select-Object -First 1) : (Join-Path $stateDir "$Issue/progress.md")
    $ledgerText = ($ledgerFile -and (Test-Path $ledgerFile)) ? (Get-Content $ledgerFile -Raw) : ''
    if ($out -eq 'TIMEOUT') { $problems += "no result within ${TimeoutSec}s" }
    elseif ($out -match $promptRx) { $problems += 'permission prompt in output' }
    if (-not $ledgerText) { $problems += 'no ledger written' }
    elseif (-not $full -and $ledgerText -notmatch [regex]::Escape($header)) { $problems += 'ledger lacks the header line' }
    elseif ($full -and $ledgerText -notmatch '(?m)^(Gate: .+|Phase \S+: complete — .+)$') { $problems += 'ledger has neither a Gate: line nor a completed phase' }
    if ($problems) {
      $failed++; Write-Host "FAIL $c/$st : $($problems -join '; ')"
      $flat = "$out" -replace '\s+', ' '; Write-Host ('  output tail: ' + $flat.Substring([Math]::Max(0, $flat.Length - 400)))
    } else { Write-Host "PASS $c/$st" }
    if ($Keep) { Write-Host "  fixture: $dir" } else { Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue }
  }
}
if ($ran -eq 0) { Write-Host 'No client CLI found: nothing was tested.'; exit 2 }
exit ($failed ? 1 : 0)
