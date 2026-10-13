#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Run metrics from a Claude Code transcript, its subagent metas and the orchestrator ledger. JSON on stdout.
.PARAMETER Transcript
  Main-thread transcript JSONL. Default: newest session of the current project under ~/.claude/projects.
.PARAMETER Issue
  Issue number; reads .agents/<issue>/progress.md. Without it the newest .agents/*/progress.md is used.
.PARAMETER Ledger
  Explicit ledger path (overrides -Issue).
.PARAMETER SubagentsDir
  Default: <transcript without .jsonl>/subagents.
#>
[CmdletBinding()]
param(
  [string]$Transcript,
  [string]$Issue,
  [string]$Ledger,
  [string]$SubagentsDir
)
$ErrorActionPreference = 'Stop'

# USD per million tokens (input, output); cache read = 0.1 x input, cache write = 1.25 x input. Estimates only.
$prices = @{ opus = @(15.0, 75.0); sonnet = @(3.0, 15.0); haiku = @(1.0, 5.0) }

function Get-Family([string]$model) {
  foreach ($f in $prices.Keys) { if ($model -match $f) { return $f } }
  return $null
}

function Read-Usage([string]$path) {
  # Deduplicate by message.id (streamed blocks repeat the id); the last record of an id holds the final usage.
  $byId = [ordered]@{}
  foreach ($line in [System.IO.File]::ReadLines($path)) {
    if (-not $line.Trim()) { continue }
    try { $e = $line | ConvertFrom-Json -Depth 20 } catch { continue }
    $m = $e.message
    if (-not $m -or $m.role -ne 'assistant' -or -not $m.usage -or -not $m.id) { continue }
    $byId[$m.id] = [pscustomobject]@{ Model = [string]$m.model; Usage = $m.usage; Cost = $e.costUSD }
  }
  return @($byId.Values)
}

function Get-Num($o, [string]$name) { if ($null -ne $o.$name) { [double]$o.$name } else { 0.0 } }

function Measure-Requests($requests) {
  $peak = 0; $measured = 0.0; $estimated = 0.0; $out = 0
  foreach ($r in $requests) {
    $in = Get-Num $r.Usage 'input_tokens'
    $cw = Get-Num $r.Usage 'cache_creation_input_tokens'
    $cr = Get-Num $r.Usage 'cache_read_input_tokens'
    $o = Get-Num $r.Usage 'output_tokens'
    $out += $o
    $ctx = $in + $cw + $cr
    if ($ctx -gt $peak) { $peak = $ctx }
    if ($null -ne $r.Cost) { $measured += [double]$r.Cost; continue }
    $fam = Get-Family $r.Model
    if ($fam) {
      $p = $prices[$fam]
      $estimated += ($in * $p[0] + $cw * $p[0] * 1.25 + $cr * $p[0] * 0.1 + $o * $p[1]) / 1e6
    }
  }
  [pscustomobject]@{
    requests = @($requests).Count; peakContext = [int64]$peak; outputTokens = [int64]$out
    costMeasured = [math]::Round($measured, 4); costEstimated = [math]::Round($estimated, 4)
  }
}

# --- locate inputs
if (-not $Transcript) {
  $dir = Join-Path $HOME ".claude/projects/$((Get-Location).Path -replace '[\\/:._]', '-')"
  $latest = if (Test-Path $dir) { Get-ChildItem $dir -Filter *.jsonl | Sort-Object LastWriteTime -Descending | Select-Object -First 1 }
  if (-not $latest) { throw "No transcript found; pass -Transcript." }
  $Transcript = $latest.FullName
}
if (-not (Test-Path $Transcript)) { throw "Transcript not found: $Transcript" }
if (-not $SubagentsDir) { $SubagentsDir = Join-Path (Split-Path $Transcript) ([IO.Path]::GetFileNameWithoutExtension($Transcript) + '/subagents') }
if (-not $Ledger) {
  if ($Issue) { $Ledger = ".agents/$Issue/progress.md" }
  elseif (Test-Path .agents) {
    $l = Get-ChildItem .agents -Recurse -Filter progress.md | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($l) { $Ledger = $l.FullName }
  }
}

# --- main thread
$main = Measure-Requests (Read-Usage $Transcript)

# --- subagents
$roles = @{}
if (Test-Path $SubagentsDir) {
  foreach ($meta in Get-ChildItem $SubagentsDir -Filter *.meta.json) {
    $m = Get-Content $meta.FullName -Raw | ConvertFrom-Json
    $role = if ($m.agentType) { [string]$m.agentType } else { 'unknown' }
    $jsonl = $meta.FullName -replace '\.meta\.json$', '.jsonl'
    $stats = if (Test-Path $jsonl) { Measure-Requests (Read-Usage $jsonl) } else { Measure-Requests @() }
    if (-not $roles.ContainsKey($role)) { $roles[$role] = [pscustomobject]@{ role = $role; count = 0; requests = 0; costMeasured = 0.0; costEstimated = 0.0 } }
    $r = $roles[$role]
    $r.count++; $r.requests += $stats.requests
    $r.costMeasured = [math]::Round($r.costMeasured + $stats.costMeasured, 4)
    $r.costEstimated = [math]::Round($r.costEstimated + $stats.costEstimated, 4)
  }
}
$roleList = @($roles.Values | Sort-Object role)

# --- ledger
$fix = 0; $rulings = @(); $gates = @(); $ledgerOut = $null
if ($Ledger -and (Test-Path $Ledger)) {
  $ledgerOut = $Ledger
  foreach ($line in Get-Content $Ledger) {
    if ($line -match '^Fix round\b') { $fix++ }
    elseif ($line -match '^Ruling:\s*(.*)$') { $rulings += $Matches[1] }
    elseif ($line -match '^Gate:\s*(.*)$') { $gates += $Matches[1] }
  }
}

[ordered]@{
  transcript = $Transcript
  ledger = $ledgerOut
  main = $main
  subagents = [ordered]@{
    count = ($roleList | Measure-Object count -Sum).Sum -as [int]
    costMeasured = [math]::Round(($roleList | Measure-Object costMeasured -Sum).Sum, 4)
    costEstimated = [math]::Round(($roleList | Measure-Object costEstimated -Sum).Sum, 4)
    byRole = $roleList
  }
  fixRounds = $fix
  rulings = [ordered]@{ count = $rulings.Count; items = $rulings }
  gates = [ordered]@{ count = $gates.Count; items = $gates }
} | ConvertTo-Json -Depth 8
