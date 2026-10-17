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
  [ValidatePattern('^\d+$')][string]$Issue,
  [string]$Ledger,
  [string]$SubagentsDir
)
$ErrorActionPreference = 'Stop'

# USD per million tokens (input, output). Opus 4.5+ = 5/25 (Opus 4/4.1 were 15/75; not modelled), Sonnet = 3/15, Haiku 4.5 = 1/5.
# Cache read = 0.1 x input, 5-minute cache write = 1.25 x input, 1-hour cache write = 2 x input. Estimates only.
$prices = @{ opus = @(5.0, 25.0); sonnet = @(3.0, 15.0); haiku = @(1.0, 5.0) }
$usageFields = 'input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens', 'cache_1h'
$warnings = [System.Collections.Generic.List[string]]::new()

function Get-Family([string]$model) {
  foreach ($f in $prices.Keys) { if ($model -match $f) { return $f } }
  return $null
}

function Hide-Secrets([string]$text) {
  $t = $text
  foreach ($re in 'ghp_\w+', 'gh[osu]_\w+', 'github_pat_\w+', 'sk-[\w-]{8,}', '(?i)Bearer\s+\S+', '(?i)\b\w*(token|secret|password|key)\s*[=:]\s*\S+') {
    $t = [regex]::Replace($t, $re, '[REDACTED]')
  }
  return $t
}

function Hide-Path([string]$path) {
  $p = $path
  $cwd = (Get-Location).Path
  if ($cwd -and $p.StartsWith($cwd + [IO.Path]::DirectorySeparatorChar)) { return $p.Substring($cwd.Length + 1) }
  if ($HOME -and $p.StartsWith($HOME)) { return '~' + $p.Substring($HOME.Length) }
  return $p
}

function Get-Num($o, [string]$name) { if ($null -ne $o -and $null -ne $o.$name) { [double]$o.$name } else { 0.0 } }

function Read-Usage([string]$path, [switch]$SkipSidechain) {
  # Streamed blocks repeat message.id with partial usage: take the per-field max per id.
  $byId = [ordered]@{}
  foreach ($line in [System.IO.File]::ReadLines($path)) {
    if (-not $line.Trim()) { continue }
    try { $e = $line | ConvertFrom-Json -Depth 20 } catch { continue }
    if ($SkipSidechain -and $e.isSidechain -eq $true) { continue }
    $m = $e.message
    if (-not $m -or $m.role -ne 'assistant' -or -not $m.usage -or -not $m.id) { continue }
    $id = [string]$m.id
    if (-not $byId.Contains($id)) {
      $byId[$id] = [pscustomobject]@{ Model = [string]$m.model; Usage = @{}; Cost = $null }
      foreach ($f in $usageFields) { $byId[$id].Usage[$f] = 0.0 }
      $byId[$id].Usage['has1h'] = $false
    }
    $r = $byId[$id]
    if ($m.model) { $r.Model = [string]$m.model }
    foreach ($f in $usageFields[0..3]) { $r.Usage[$f] = [math]::Max($r.Usage[$f], (Get-Num $m.usage $f)) }
    $cc = $m.usage.cache_creation
    if ($cc -and $null -ne $cc.ephemeral_1h_input_tokens) {
      $r.Usage['has1h'] = $true
      $r.Usage['cache_1h'] = [math]::Max($r.Usage['cache_1h'], [double]$cc.ephemeral_1h_input_tokens)
    }
    if ($null -ne $e.costUSD) { $r.Cost = if ($null -eq $r.Cost) { [double]$e.costUSD } else { [math]::Max($r.Cost, [double]$e.costUSD) } }
  }
  return , @($byId.Values)
}

function Measure-Requests([AllowEmptyCollection()][object[]]$requests) {
  $peak = 0.0; $measured = 0.0; $estimated = 0.0; $out = 0.0
  foreach ($r in $requests) {
    $in = $r.Usage['input_tokens']; $cw = $r.Usage['cache_creation_input_tokens']
    $cr = $r.Usage['cache_read_input_tokens']; $o = $r.Usage['output_tokens']
    $out += $o
    $ctx = $in + $cw + $cr
    if ($ctx -gt $peak) { $peak = $ctx }
    if ($null -ne $r.Cost) { $measured += $r.Cost; continue }
    $fam = Get-Family $r.Model
    if ($fam) {
      $p = $prices[$fam]
      $cw1 = if ($r.Usage['has1h']) { [math]::Min($r.Usage['cache_1h'], $cw) } else { 0.0 }
      $estimated += ($in * $p[0] + ($cw - $cw1) * $p[0] * 1.25 + $cw1 * $p[0] * 2 + $cr * $p[0] * 0.1 + $o * $p[1]) / 1e6
    }
  }
  [pscustomobject]@{
    requests = $requests.Count; peakContext = [int64]$peak; outputTokens = [int64]$out
    costMeasured = [math]::Round($measured, 4); costEstimated = [math]::Round($estimated, 4)
  }
}

# --- locate inputs
if (-not $Transcript) {
  $dir = Join-Path $HOME ".claude/projects/$((Get-Location).Path -replace '[^A-Za-z0-9]', '-')"
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
$main = Measure-Requests (Read-Usage $Transcript -SkipSidechain)

# --- subagents
$roles = @{}; $skipped = 0
if (Test-Path $SubagentsDir) {
  foreach ($meta in Get-ChildItem $SubagentsDir -Filter *.meta.json) {
    try { $m = Get-Content $meta.FullName -Raw | ConvertFrom-Json } catch { $skipped++; continue }
    $role = if ($m.agentType -and ([string]$m.agentType) -match '^[A-Za-z0-9_.-]+$') { [string]$m.agentType } else { 'unknown' }
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
function Sum-Of($items, [string]$prop) { $t = 0.0; foreach ($i in $items) { $t += $i.$prop }; return $t }

# --- ledger
$fix = 0; $rulings = @(); $gates = @(); $ledgerOut = $null
$taskMap = [ordered]@{}; $lastTask = $null; $reviewPasses = 0
# Optional ' — model <name>' suffix (older ledgers have none): null when absent.
function Get-LedgerModel([string]$line) { if ($line -match '(?i)\bmodel\s+([A-Za-z0-9_.:/-]+)\s*$') { return $Matches[1] } return $null }
if ($Ledger -and (Test-Path $Ledger)) {
  $ledgerOut = Hide-Path (Resolve-Path $Ledger).Path
  foreach ($line in Get-Content $Ledger) {
    if ($line -match '^\s*(?:[-*]\s+)?Task\s+#(\d+):\s*([A-Za-z_]+)') {
      $n = $Matches[1]; $st = $Matches[2]; $lastTask = $n
      $taskMap[$n] = [pscustomobject]@{ n = [int]$n; model = (Get-LedgerModel $line); status = $st; fixRounds = 0; escalated = $false }
    }
    elseif ($line -match '^\s*(?:[-*]\s+)?Fix round\s+(\d+)\b') {
      $round = [int]$Matches[1]; $fix++
      # A fix round belongs to the task it names (#<nr>), else to the last Task line above it.
      $target = $lastTask
      if ($line -match '#(\d+)' -and $taskMap.Contains($Matches[1])) { $target = $Matches[1] }
      if ($target) {
        $t = $taskMap[$target]; $t.fixRounds++
        $fm = Get-LedgerModel $line
        # Escalation: a fix round on a different model than the Task line, or fix round >= 3 (fresh implementer one tier up).
        if ($round -ge 3 -or ($fm -and $t.model -and $fm -ne $t.model)) { $t.escalated = $true }
      }
    }
    elseif ($line -match '^\s*(?:[-*]\s+)?Fix round\b') { $fix++ }
    elseif ($line -match '^\s*(?:[-*]\s+)?(Phase review|Review round)\b') { $reviewPasses++ }
    elseif ($line -match '^\s*(?:[-*]\s+)?Ruling:\s*(.*)$') { $rulings += Hide-Secrets $Matches[1] }
    elseif ($line -match '^\s*(?:[-*]\s+)?Gate:\s*(.*)$') { $gates += Hide-Secrets $Matches[1] }
  }
} else {
  $warnings.Add('Ledger not found; fixRounds, rulings and gates are 0.')
}

# Review passes cover the whole PBI range, so every task reports the run's count.
$taskList = @($taskMap.Values | ForEach-Object {
  [ordered]@{ task = $_.n; model = $_.model; status = $_.status; fixRounds = $_.fixRounds; reviewRounds = $reviewPasses }
})
$escalated = @($taskMap.Values | Where-Object { $_.escalated }).Count
$escalationShare = if ($taskMap.Count -gt 0) { [math]::Round($escalated / $taskMap.Count, 4) } else { 0 }

[ordered]@{
  transcript = Hide-Path (Resolve-Path $Transcript).Path
  ledger = $ledgerOut
  warnings = @($warnings)
  main = $main
  subagents = [ordered]@{
    count = [int](Sum-Of $roleList 'count')
    skipped = $skipped
    costMeasured = [math]::Round((Sum-Of $roleList 'costMeasured'), 4)
    costEstimated = [math]::Round((Sum-Of $roleList 'costEstimated'), 4)
    byRole = $roleList
  }
  fixRounds = $fix
  tasks = $taskList
  escalationShare = $escalationShare
  rulings = [ordered]@{ count = $rulings.Count; items = @($rulings) }
  gates = [ordered]@{ count = $gates.Count; items = @($gates) }
} | ConvertTo-Json -Depth 8
