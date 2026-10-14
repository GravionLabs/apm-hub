#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Headless smoke test of the orchestrator ledger on OpenCode and Claude Code.
.DESCRIPTION
  Creates a throwaway git repo (no remote, so nothing is written to GitHub), starts the orchestrator
  headless with a ledger-only prompt (create .agents/<issue>/ and append the ledger header) and asserts that
  .agents/<issue>/progress.md exists and that the output holds no permission prompt. A client whose CLI is
  missing is skipped. Exits non-zero on any failure. Not run in CI (needs the CLIs, a model and the agent
  installed: apm install). OpenCode runs the agent from the project fixture (permission map taken from
  packages/agents/.apm/agents/orchestrator.agent.md); Claude Code uses the installed orchestrator agent.
  See docs/working-mode.md.
.PARAMETER Client  opencode, claude or both (default both).
.PARAMETER Issue   Issue number used for the ledger folder (default 999).
.PARAMETER TimeoutSec Per run timeout (default 180).
.PARAMETER Keep    Keep the fixture directories.
#>
[CmdletBinding()]
param(
  [ValidateSet('opencode', 'claude', 'both')][string]$Client = 'both',
  [int]$Issue = 999,
  [int]$TimeoutSec = 180,
  [switch]$Keep
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$prompt = "Ledger check only, no GitHub access: create .agents/$Issue/ and append the single line '# orchestrator ledger - issue #$Issue - branch main' to .agents/$Issue/progress.md using shell commands. Use relative paths and echo with >>. Do not read the file back, then stop."
$promptRx = 'permission requested|auto-rejecting|requires approval|asked for approval|blocked the command'

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
  $dir
}

function Get-OpenCodeAgent {
  # Sanitized project agent: flat frontmatter from metadata.opencode, body omitted (ledger check only).
  $src = Get-Content (Join-Path $root 'packages/agents/.apm/agents/orchestrator.agent.md') -Raw
  $m = [regex]::Match($src, '(?s)    mode: primary\r?\n    permission:\r?\n(.*?)\r?\n---')
  if (-not $m.Success) { throw 'metadata.opencode.permission not found in orchestrator.agent.md' }
  $perm = ($m.Groups[1].Value -split "\r?\n" | ForEach-Object { $_.Substring(4) }) -join "`n"
  "---`ndescription: orchestrator smoke`nmode: primary`npermission:`n$perm`n---`nYou run the issue lifecycle. The ledger is .agents/<issue>/progress.md, written with shell commands.`n"
}

function Invoke-Client([string]$Name, [string]$Dir) {
  $bin = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $bin) { $bin = Get-Command (Join-Path $HOME ($Name -eq 'opencode' ? '.opencode/bin/opencode' : '.local/bin/claude')) -ErrorAction SilentlyContinue }
  if (-not $bin) { return $null }
  # Claude Code has no per-agent bash allow list: the run must be allowed the ledger commands and the .agents/ redirect
  # (--allowedTools here; permissions.allow in the project settings in real use, see docs/working-mode.md).
  $cliArgs = $Name -eq 'opencode' ? @('run', '--agent', 'orchestrator', $prompt) : @('-p', '--agent', 'orchestrator', '--allowedTools', 'Bash(mkdir -p *)', 'Bash(echo *)', 'Bash(printf *)', 'Edit(.agents/**)', '--', $prompt)
  if ($Name -eq 'opencode') {
    New-Item -ItemType Directory -Path (Join-Path $Dir '.opencode/agents') -Force | Out-Null
    Set-Content (Join-Path $Dir '.opencode/agents/orchestrator.md') (Get-OpenCodeAgent) -NoNewline
  }
  # Empty XDG config: a user-level agents directory in an older format must not break the run.
  $env:XDG_CONFIG_HOME = (New-Item -ItemType Directory -Force (Join-Path $Dir '.xdg-config')).FullName
  foreach ($attempt in 1..2) {
  $psi = [Diagnostics.ProcessStartInfo]::new($bin.Source)
  foreach ($x in $cliArgs) { $psi.ArgumentList.Add($x) }
  $psi.WorkingDirectory = $Dir
  $psi.Environment['PWD'] = $Dir   # clients read $PWD, not the process cwd: without it they run in the caller's repo
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
$failed = 0
foreach ($c in $clients) {
  $dir = New-Fixture $c
  $out = Invoke-Client $c $dir
  $ledger = Join-Path $dir ".agents/$Issue/progress.md"
  if ($null -eq $out) { Write-Host "SKIP $c (CLI not found)"; continue }
  $problems = @()
  if ($out -eq 'TIMEOUT') { $problems += "no result within ${TimeoutSec}s" }
  elseif ($out -match $promptRx) { $problems += 'permission prompt in output' }
  if (-not (Test-Path $ledger)) { $problems += "missing $ledger" }
  if ($problems) { $failed++; Write-Host "FAIL $c : $($problems -join "; ")"; $flat = "$out" -replace '\s+', ' '; Write-Host ('  output tail: ' + $flat.Substring([Math]::Max(0, $flat.Length - 6000))) } else { Write-Host "PASS $c" }
  if (-not $Keep) { Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue } else { Write-Host "  fixture: $dir" }
}
exit ($failed ? 1 : 0)
