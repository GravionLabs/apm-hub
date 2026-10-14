#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Runs the skill trigger evals headless with `claude -p` and scores which skill was chosen.
.DESCRIPTION
  Reads evals/skill-triggers.json, sends every prompt -Runs times to
  `claude -p --output-format stream-json --verbose`, detects Skill tool_use calls and scores them
  with the TypeScript scorer (dist/generators/skill-trigger-score.js; run `pnpm run build` first).
  -DryRun / -WhatIf lists the prompts and the command without calling claude. Skills must be installed
  (apm install) in the directory the script runs from. See docs/usage/trigger-evals.md.
.PARAMETER Runs     Repeats per prompt (default 3).
.PARAMETER Out      Results JSON (default evals/results/trigger-results.json).
.PARAMETER Baseline Earlier results JSON; fail when a rate drops more than 5 points.
.PARAMETER Skill    Only evaluate these skills.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [int]$Runs = 3,
  [string]$Out = 'evals/results/trigger-results.json',
  [string]$Baseline,
  [string[]]$Skill,
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$evals = Get-Content (Join-Path $root 'evals/skill-triggers.json') -Raw | ConvertFrom-Json
if ($Skill) { $evals = $evals | Where-Object { $_.skill -in $Skill } }
$claudeArgs = @('-p', '<prompt>', '--output-format', 'stream-json', '--verbose')
$scorer = Join-Path $root 'dist/generators/skill-trigger-score.js'

$cases = foreach ($e in $evals) {
  foreach ($p in $e.shouldTrigger) { [pscustomobject]@{ skill = $e.skill; kind = 'positive'; prompt = $p } }
  foreach ($p in $e.shouldNotTrigger) { [pscustomobject]@{ skill = $e.skill; kind = 'negative'; prompt = $p } }
}

if ($DryRun -or $WhatIfPreference) {
  Write-Host "Command: claude $($claudeArgs -join ' ')  (x$Runs per prompt, $(@($cases).Count * $Runs) calls)"
  foreach ($c in $cases) { Write-Host "[$($c.kind)] $($c.skill): $($c.prompt)" }
  return
}

if (-not (Test-Path $scorer)) { throw "Missing $scorer; run 'pnpm run build' first." }
$tmp = Join-Path ([IO.Path]::GetTempPath()) "trigger-evals-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory $tmp | Out-Null
try {
  $records = foreach ($c in $cases) {
    foreach ($i in 1..$Runs) {
      $t = Join-Path $tmp 'transcript.jsonl'
      & claude -p $c.prompt --output-format stream-json --verbose > $t
      $invoked = @(node $scorer extract $t | ConvertFrom-Json)
      [pscustomobject]@{ skill = $c.skill; kind = $c.kind; prompt = $c.prompt; invoked = $invoked }
    }
  }
  $recFile = Join-Path $tmp 'records.json'
  ConvertTo-Json -InputObject @($records) -Depth 5 | Set-Content $recFile
  New-Item -ItemType Directory (Split-Path ([IO.Path]::GetFullPath($Out)) -Parent) -Force | Out-Null
  $scoreArgs = @('score', $recFile, $Out)
  if ($Baseline) { $scoreArgs += $Baseline }
  node $scorer @scoreArgs
  exit $LASTEXITCODE
}
finally { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
