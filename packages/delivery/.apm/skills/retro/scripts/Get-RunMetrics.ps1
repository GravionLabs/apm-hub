#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Run metrics from a Claude Code transcript, its subagent metas and the orchestrator ledger. JSON on stdout.
.PARAMETER Transcript
  Main-thread transcript JSONL. Default: newest session of the current project under ~/.claude/projects.
.PARAMETER Issue
  Issue number; reads <state>/<issue>/progress.md (state dir: DROMOS_STATE_DIR, else <git common dir>/agents). Without it the newest progress.md under the state dir is used.
.PARAMETER Ledger
  Explicit ledger path (overrides -Issue).
.PARAMETER SubagentsDir
  Default: <transcript without .jsonl>/subagents.
.OUTPUTS
  JSON: source ("agentlens" when agentlens >= 0.11.0 on PATH answers for the transcript session, else "transcript" with a warning), transcript, ledger, warnings, main, subagents, fixRounds (all Fix round lines), unattributedFixRounds (the part of
  fixRounds no task could be charged with: unknown task id or no Task line above; fixRounds minus the tasks[] sum),
  roles[] (per subagent type: role, runs, requests, usd = measured cost when > 0 else estimated, measured), tasks[] (task = issue number or plan id such as "p1", model, status, fixRounds, escalated, escalatedTo, reviewRounds),
  escalationShare, rulings, gates, durations.
  durations: {total, phases: {read, explore, plan, implement, verify, review, pr}, tasks: [{task, seconds}], fixRounds: [{round, task, seconds}]}
  in seconds, from the optional ISO-8601 UTC prefix of ledger lines ('2026-10-21T15:19:46Z <text>'; lines without it are still read). A phase ends at its
  'Phase <name>: complete' line (verify: 'Phase verify: ok|fail — tests <n>/<m>') and starts at the previous such line (the first timestamped line for the first phase); a Task or Fix round ends at its own line and
  starts at the previous Phase-complete, Task or Fix round line. A missing timestamp, phase or a negative span gives null, never an error.
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
# Oldest agentlens with `cost --by session` (GravionLabs/agentlens#400) and `efficiency --section roles` (#402).
$minAgentLens = [version]'0.11.0'
$usageFields = 'input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens', 'cache_1h'
$warnings = [System.Collections.Generic.List[string]]::new()

function Get-Family([string]$model) {
  foreach ($f in $prices.Keys) { if ($model -match $f) { return $f } }
  return $null
}

# Path of the agentlens executable or $null.
function Get-AgentLens {
  $c = Get-Command agentlens -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { return $c.Source }
  return $null
}

# Runs agentlens and returns stdout; throws with the reason on a non-zero exit.
function Invoke-AgentLens([string]$exe, [string[]]$arguments) {
  $out = & $exe @arguments 2>$null
  if ($LASTEXITCODE -ne 0) { throw "agentlens $($arguments[0]) exited with $LASTEXITCODE" }
  return ($out -join "`n")
}

function ConvertFrom-LensJson([string]$text, [string]$what) {
  try { $j = $text | ConvertFrom-Json -Depth 20 } catch { throw "agentlens $what returned invalid JSON" }
  if ($j -is [System.Management.Automation.PSCustomObject]) { foreach ($k in 'rows', 'sessions', 'roles') { if ($null -ne $j.$k) { return , @($j.$k) } } }
  return , @($j)
}

# The ONLY place that knows agentlens' JSON field names (GravionLabs/agentlens#400 session row, #402 roles rows).
# Session row: session, requests, main_requests, peak_context, output, cost (null = n/a), measured, subagent_share (0..1 of cost).
# Roles row: agent_type, runs, requests, cost (null = n/a), measured; a row with agent_type "main" is the main thread and not a role.
function Pick($o, [string[]]$names, $default = $null) { foreach ($n in $names) { if ($null -ne $o.$n) { return $o.$n } }; return $default }
function Convert-LensRows($sessionRow, [object[]]$roleRows) {
  # cost null (n/a) stays unknown: measured/usd are null, the totals count it as 0 in neither bucket
  $split = {
    param($cost, $measured)
    $c = if ($null -ne $cost) { [double]$cost } else { 0.0 }
    if ($measured -eq $true) { @($c, 0.0) } else { @(0.0, $c) }
  }
  $mainReq = Pick $sessionRow @('main_requests', 'mainRequests')
  $shareRaw = Pick $sessionRow @('subagent_share', 'subagentShare')
  if ($null -eq $mainReq -or $null -eq $shareRaw) { throw 'agentlens session row lacks main_requests or subagent_share' }
  $share = [double]$shareRaw
  $total = Pick $sessionRow @('cost', 'cost_usd')
  # main cost = session cost minus the subagent share (not the roles "main" row)
  $mainCost = if ($null -ne $total) { [double]$total * (1 - $share) } else { $null }
  $mainFlag = Pick $sessionRow @('measured', 'cost_measured')
  $mc = & $split $mainCost $mainFlag
  $main = [pscustomobject]@{
    requests = [int]$mainReq; peakContext = [int64](Pick $sessionRow @('peak_context', 'peakContext') 0)
    outputTokens = [int64](Pick $sessionRow @('output', 'output_tokens', 'outputTokens') 0)
    costMeasured = $(if ($null -eq $mainCost) { $null } else { [math]::Round($mc[0], 4) })
    costEstimated = $(if ($null -eq $mainCost) { $null } else { [math]::Round($mc[1], 4) })
    measured = $(if ($null -eq $mainCost) { $null } else { $mainFlag -eq $true })
  }
  $list = @()
  foreach ($r in $roleRows) {
    $name = [string](Pick $r @('agent_type', 'agentType', 'role'))
    if (-not $name -or $name -eq 'main') { continue }
    if ($name -notmatch '^[A-Za-z0-9_.-]+$') { $name = 'unknown' }
    $cost = Pick $r @('cost', 'cost_usd')
    $flag = Pick $r @('measured', 'cost_measured')
    $rc = & $split $cost $flag
    $list += [pscustomobject]@{
      role = $name; count = [int](Pick $r @('runs', 'count') 0); requests = [int](Pick $r @('requests') 0)
      costMeasured = [math]::Round($rc[0], 4); costEstimated = [math]::Round($rc[1], 4)
      usd = $(if ($null -eq $cost) { $null } else { [math]::Round([double]$cost, 4) }); measured = $(if ($null -eq $cost) { $null } else { $flag -eq $true })
    }
  }
  [pscustomobject]@{ main = $main; roles = @($list | Sort-Object role) }
}

# Main thread and roles from agentlens for the session; throws "<reason>" for the fallback warning.
function Read-AgentLens([string]$exe, [string]$sessionId) {
  $v = Invoke-AgentLens $exe @('--version')
  if ($v -notmatch '\d+\.\d+\.\d+') { throw "agentlens version not recognised ('$($v.Trim())')" }
  if ([version]$Matches[0] -lt $minAgentLens) { throw "agentlens $($Matches[0]) is older than $minAgentLens" }
  $cost = ConvertFrom-LensJson (Invoke-AgentLens $exe @('cost', '--by', 'session', '--format', 'json')) 'cost'
  $row = @($cost | Where-Object { [string](Pick $_ @('session', 'session_id', 'sessionId', 'id')) -eq $sessionId }) | Select-Object -First 1
  if (-not $row) { throw "agentlens has no session row for $sessionId" }
  $eff = ConvertFrom-LensJson (Invoke-AgentLens $exe @('efficiency', '--section', 'roles', '--format', 'json', '--session', $sessionId)) 'efficiency'
  Convert-LensRows $row $eff
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

$agentLens = Get-AgentLens

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
# BEGIN Resolve-StateDir (identical in every script that defines it; test/repo/state-dir-resolver.test.ts)
function Resolve-StateDir {
  if ($env:DROMOS_STATE_DIR) { return [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($env:DROMOS_STATE_DIR, (Get-Location).Path)) }
  $common = $null
  try { $common = "$(& git -C (Get-Location).Path rev-parse --path-format=absolute --git-common-dir 2>$null)".Trim() } catch { $common = $null }
  if ($LASTEXITCODE -ne 0 -or -not $common) { throw 'No state directory: not inside a git repository (set DROMOS_STATE_DIR)' }
  [IO.Path]::GetFullPath((Join-Path $common 'agents'))
}
# END Resolve-StateDir
  $state = try { Resolve-StateDir } catch { $null }
  if ($Issue -and $state) { $Ledger = Join-Path $state "$Issue/progress.md" }
  elseif (-not $Issue -and $state -and (Test-Path -LiteralPath $state)) {
    $l = Get-ChildItem -LiteralPath $state -Recurse -Filter progress.md | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($l) { $Ledger = $l.FullName }
  }
}

# --- agentlens (never mixed with the price table below: either all figures come from it or none)
$lens = $null; $source = 'transcript'
if (-not $agentLens) { $warnings.Add("agentlens not on PATH: cost from the transcript with the script's own price table (estimates)") }
else {
  try { $lens = Read-AgentLens $agentLens ([IO.Path]::GetFileNameWithoutExtension($Transcript)) }
  catch { $warnings.Add("agentlens not used ($($_.Exception.Message)): cost from the transcript with the script's own price table (estimates)") }
}

# --- main thread
$roles = @{}; $skipped = 0
if ($lens) {
  $source = 'agentlens'
  $main = $lens.main
  foreach ($r in $lens.roles) { $roles[$r.role] = $r }
} else {
$main = Measure-Requests (Read-Usage $Transcript -SkipSidechain)

# --- subagents
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
}
$roleList = @($roles.Values | Sort-Object role)
$roleRows = @($roleList | ForEach-Object {
  if ($lens) { [ordered]@{ role = $_.role; runs = $_.count; requests = $_.requests; usd = $_.usd; measured = $_.measured } }  # agentlens flags, never derived from the amounts
  else { [ordered]@{ role = $_.role; runs = $_.count; requests = $_.requests; usd = $(if ($_.costMeasured -gt 0) { $_.costMeasured } else { $_.costEstimated }); measured = ($_.costMeasured -gt 0) } }
})
function Sum-Of($items, [string]$prop) { $t = 0.0; foreach ($i in $items) { $t += $i.$prop }; return $t }

# --- ledger
$fix = 0; $rulings = @(); $gates = @(); $ledgerOut = $null
$taskMap = [ordered]@{}; $lastTask = $null; $reviewPasses = 0; $unattributed = 0
$phaseNames = 'read', 'explore', 'plan', 'implement', 'verify', 'review', 'pr'
$phaseSec = [ordered]@{}; foreach ($p in $phaseNames) { $phaseSec[$p] = $null }
$taskSec = [ordered]@{}; $fixList = [System.Collections.Generic.List[object]]::new()
$isFirst = $true; $firstTs = $null; $lastTs = $null; $prevPhaseTs = $null; $prevMark = $null
$tsRe = '^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\s+(.*)$'
function Get-Span($from, $to) { if ($null -eq $from -or $null -eq $to) { return $null }; $d = ($to - $from).TotalSeconds; if ($d -lt 0) { return $null }; return [int][math]::Round($d) }
function Add-Sec($sum, $add) { if ($null -eq $add) { return $sum }; if ($null -eq $sum) { return $add }; return $sum + $add }
function Get-PhaseKey([string]$name) {
  $k = ($name.ToLowerInvariant() -replace '[\s_-]+', '')
  if ($k -in 'pullrequest', 'pr') { return 'pr' }
  if ($k -in 'read', 'explore', 'plan', 'implement', 'verify', 'review') { return $k }
  return $null
}
# Optional ' — model <name>' suffix (older ledgers have none): null when absent.
function Get-LedgerModel([string]$line) { if ($line -match '(?i)(?:^|\s)model\s+([A-Za-z0-9_.:/-]+)\s*$') { return Hide-Secrets $Matches[1] } return $null }
if ($Ledger -and (Test-Path $Ledger)) {
  $ledgerOut = Hide-Path (Resolve-Path $Ledger).Path
  foreach ($rawLine in Get-Content $Ledger) {
    # optional timestamp prefix (older ledgers have none): $ts is $null without it or when unparsable
    $line = $rawLine; $ts = $null
    if ($rawLine -match $tsRe) {
      $line = $Matches[2]
      $parsed = [DateTimeOffset]::MinValue
      if ([DateTimeOffset]::TryParse($Matches[1], [cultureinfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal, [ref]$parsed)) { $ts = $parsed }
    }
    # the first ledger line (the header) is the origin of the first phase and task, but only when it is timestamped itself
    if ($isFirst) { $isFirst = $false; if ($ts) { $prevMark = $ts; $prevPhaseTs = $ts } }
    if ($ts) { if ($null -eq $firstTs) { $firstTs = $ts }; $lastTs = $ts }
    if ($line -match '^\s*(?:[-*]\s+)?Phase\s+([A-Za-z][A-Za-z _-]*?)\s*:\s*(?:complete|ok|fail)\b') {
      $pk = Get-PhaseKey $Matches[1]
      if ($pk) { $phaseSec[$pk] = Add-Sec $phaseSec[$pk] (Get-Span $prevPhaseTs $ts) }
      $prevPhaseTs = $ts; $prevMark = $ts
    }
    # Task id: the Task issue number, or the plan id (p1) of a single task without issue.
    if ($line -match '^\s*(?:[-*]\s+)?Task\s+#(\d{1,9}|p\d{1,9}):\s*([A-Za-z_]+)') {
      $n = $Matches[1]; $st = $Matches[2]; $lastTask = $n
      $taskSec[$n] = Add-Sec $taskSec[$n] (Get-Span $prevMark $ts); $prevMark = $ts
      if ($taskMap.Contains($n)) {  # repeated line: latest status wins, a model is never replaced by null, counters stay
        $nm = Get-LedgerModel $line
        if ($nm) { $taskMap[$n].model = $nm }
        $taskMap[$n].status = $st
      }
      else { $taskMap[$n] = [pscustomobject]@{ n = $(if ($n -match '^\d+$') { [int]$n } else { $n }); model = (Get-LedgerModel $line); status = $st; fixRounds = 0; escalated = $false; escalatedTo = $null } }
    }
    elseif ($line -match '^\s*(?:[-*]\s+)?Fix round\s+(\d{1,9})(?:\s*\(#(\w+)\))?') {
      $round = [int]$Matches[1]; $fix++
      $fixSpan = Get-Span $prevMark $ts; $prevMark = $ts
      # `Fix round <r> (#<task>): ...` names its task and counts only for a known Task line; an unknown id stays unattributed.
      # A legacy line without `(#...)` is attributed to the last Task line above it (old ledgers); none above: unattributed.
      $target = $null
      if ($Matches[2]) { if ($taskMap.Contains($Matches[2])) { $target = $Matches[2] } }
      else { $target = $lastTask }
      $fixList.Add([ordered]@{ round = $round; task = $(if ($target -and $target -match '^\d+$') { [int]$target } else { $target }); seconds = $fixSpan })
      if (-not $target) { $unattributed++ }
      else {
        $t = $taskMap[$target]; $t.fixRounds++
        $fm = Get-LedgerModel $line
        # Escalation: a fix round on a different named model than the Task line (`inherit` is not a model name), or fix round >= 3 (fresh implementer one tier up).
        $named = $fm -and $t.model -and $fm -ne 'inherit' -and $t.model -ne 'inherit'
        if ($round -ge 3 -or ($named -and $fm -ne $t.model)) { $t.escalated = $true; if ($fm -and $fm -ne 'inherit') { $t.escalatedTo = $fm } }
      }
    }
    elseif ($line -match '^\s*(?:[-*]\s+)?Fix round\b') { $fix++; $unattributed++; $fixList.Add([ordered]@{ round = $null; task = $null; seconds = (Get-Span $prevMark $ts) }); $prevMark = $ts }
    elseif ($line -match '^\s*(?:[-*]\s+)?Phase review\b') { $reviewPasses++ }
    elseif ($line -match '^\s*(?:[-*]\s+)?Ruling:\s*(.*)$') { $rulings += Hide-Secrets $Matches[1] }
    elseif ($line -match '^\s*(?:[-*]\s+)?Gate:\s*(.*)$') { $gates += Hide-Secrets $Matches[1] }
  }
} else {
  $warnings.Add('Ledger not found; fixRounds, rulings and gates are 0.')
}

# reviewRounds is run-wide by design: review runs once over the whole PBI range, not per task.
# Review passes cover the whole PBI range, so every task reports the run's count.
$taskList = @($taskMap.Values | ForEach-Object {
  [ordered]@{ task = $_.n; model = $_.model; status = $_.status; fixRounds = $_.fixRounds; escalated = $_.escalated; escalatedTo = $_.escalatedTo; reviewRounds = $reviewPasses }
})
$durations = [ordered]@{
  total = Get-Span $firstTs $lastTs
  phases = $phaseSec
  tasks = @($taskSec.Keys | ForEach-Object { [ordered]@{ task = $(if ($_ -match '^\d+$') { [int]$_ } else { $_ }); seconds = $taskSec[$_] } })
  fixRounds = @($fixList)
}
$escalated = @($taskMap.Values | Where-Object { $_.escalated }).Count
$escalationShare = if ($taskMap.Count -gt 0) { [math]::Round($escalated / $taskMap.Count, 4) } else { 0 }

[ordered]@{
  source = $source
  transcript = Hide-Path (Resolve-Path $Transcript).Path
  ledger = $ledgerOut
  warnings = @($warnings)
  main = $main
  subagents = [ordered]@{
    count = [int](Sum-Of $roleList 'count')
    skipped = $skipped
    costMeasured = [math]::Round((Sum-Of $roleList 'costMeasured'), 4)
    costEstimated = [math]::Round((Sum-Of $roleList 'costEstimated'), 4)
    byRole = @($roleList | ForEach-Object { $_ | Select-Object role, count, requests, costMeasured, costEstimated })
  }
  roles = $roleRows
  fixRounds = $fix
  unattributedFixRounds = $unattributed
  tasks = $taskList
  escalationShare = $escalationShare
  rulings = [ordered]@{ count = $rulings.Count; items = @($rulings) }
  gates = [ordered]@{ count = $gates.Count; items = @($gates) }
  durations = $durations
} | ConvertTo-Json -Depth 8
