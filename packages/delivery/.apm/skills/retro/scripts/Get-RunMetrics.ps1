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
.PARAMETER Loop
  Multi-run: the PBIs of the loop ledger <state>/loop-<nr>/progress.md (every '#<n>' of a 'Loop: PBI #<n> ...' line, whatever the state word,
  in order of first appearance). Missing loop ledger: error.
.PARAMETER Issues
  Multi-run: the given issue numbers in the given order ('-Issues 1,2,3').
.PARAMETER Since
  Multi-run: every <state>/<n>/progress.md (numeric directory names only) whose first timestamped line is later than this ISO date/time
  (UTC when it names no offset), sorted by that timestamp; ledgers without timestamps are skipped with a warning.
  -Loop, -Issues and -Since exclude each other and -Transcript, -Issue and -Ledger. Multi-run reads no transcript and calls no agentlens; output:
  {source: "ledger", transcript: null, warnings, runs, aggregate}. A selected issue without ledger gives a run with ledger null and a warning.
.OUTPUTS
  JSON: source ("agentlens" when agentlens >= 0.11.0 on PATH answers for the transcript session, else "transcript" with a warning), transcript, ledger, warnings, main, subagents, fixRounds (all Fix round lines), unattributedFixRounds (the part of
  fixRounds no task could be charged with: unknown task id or no Task line above; fixRounds minus the tasks[] sum),
  roles[] (per subagent type: role, runs, requests, usd = measured cost when > 0 else estimated, measured), tasks[] (task = issue number or plan id such as "p1", model, status, fixRounds, escalated, escalatedTo, reviewRounds),
  escalationShare, rulings, gates, durations.
  durations: {total, phases: {read, explore, plan, implement, verify, review, pr}, tasks: [{task, seconds}], fixRounds: [{round, task, seconds}]}
  in seconds, from the optional ISO-8601 UTC prefix of ledger lines ('2026-10-21T15:19:46Z <text>'; lines without it are still read). A phase ends at its
  'Phase <name>: complete' line (verify: 'Phase verify: ok|fail — tests <n>/<m>') and starts at the previous such line (the first timestamped line for the first phase); a Task or Fix round ends at its own line and
  starts at the previous Phase-complete, Task or Fix round line. A missing timestamp, phase or a negative span gives null, never an error.
  runs[]: per PBI {issue, ledger, fixRounds, escalations (escalated tasks), gates (count), parked (the PBI's last 'Loop: PBI #<n> ...' line is
  'parked'; across loop ledgers the newest such line wins; -Loop reads only that loop ledger), rulings, durations, cost, source}; cost is null in multi-run mode, in the single-issue output (one run) the
  main plus subagents cost. aggregate: {fixRoundsPerPbi, escalationShare (escalated / all tasks of all runs), gateCount, parkedCount,
  repeatedRulings: [{text, count}] (rulings normalised by Get-RulingKey seen in >= 2 runs; count = runs)}.
#>
[CmdletBinding()]
param(
  [string]$Transcript,
  [ValidatePattern('^\d+$')][string]$Issue,
  [string]$Ledger,
  [string]$SubagentsDir,
  [ValidatePattern('^\d+$')][string]$Loop,
  # strings, split at commas: `-Issues 1,2,3` inside pwsh and `pwsh -File ... -Issues 1,2,3` (one string) both work
  [string[]]$Issues,
  [string]$Since
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

# BEGIN Resolve-StateDir (identical in every script that defines it; test/repo/state-dir-resolver.test.ts)
function Resolve-StateDir {
  if ($env:DROMOS_STATE_DIR) { return [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($env:DROMOS_STATE_DIR, (Get-Location).Path)) }
  $common = $null
  try { $common = "$(& git -C (Get-Location).Path rev-parse --path-format=absolute --git-common-dir 2>$null)".Trim() } catch { $common = $null }
  if ($LASTEXITCODE -ne 0 -or -not $common) { throw 'No state directory: not inside a git repository (set DROMOS_STATE_DIR)' }
  [IO.Path]::GetFullPath((Join-Path $common 'agents'))
}
# END Resolve-StateDir

# --- ledger parsing (one ledger per call; used by the single-issue and the multi-run path)
$tsRe = '^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\s+(.*)$'
$phaseNames = 'read', 'explore', 'plan', 'implement', 'verify', 'review', 'pr'
function Get-Span($from, $to) { if ($null -eq $from -or $null -eq $to) { return $null }; $d = ($to - $from).TotalSeconds; if ($d -lt 0) { return $null }; return [int][math]::Round($d) }
function Add-Sec($sum, $add) { if ($null -eq $add) { return $sum }; if ($null -eq $sum) { return $add }; return $sum + $add }
function Get-PhaseKey([string]$name) {
  $k = ($name.ToLowerInvariant() -replace '[\s_-]+', '')
  if ($k -in 'pullrequest', 'pr') { return 'pr' }
  if ($k -in 'read', 'explore', 'plan', 'implement', 'verify', 'review') { return $k }
  return $null
}
# Optional ' — model <name>' suffix (older ledgers have none): null when absent.
# Comparable model key: the tier family when the id names one (haiku/sonnet/opus: 'sonnet', 'claude-sonnet-5.5', 'anthropic/claude-sonnet-5-5' are one), else the lowercased id.
function Get-ModelKey([string]$m) {
  $l = $m.ToLowerInvariant()
  foreach ($f in 'haiku', 'sonnet', 'opus') { if ($l -match "(?:^|[/\-])$f(?:$|[-.\d])") { return $f } }
  return $l
}
function Get-LedgerModel([string]$line) { if ($line -match '(?i)(?:^|\s)model\s+([A-Za-z0-9_.:/-]+)\s*$') { return Hide-Secrets $Matches[1] } return $null }

# Parses one ledger; a missing path gives the empty result with ledger $null.
function Read-Ledger([string]$path) {
  $fix = 0; $rulings = @(); $gates = @(); $ledgerOut = $null
  $taskMap = [ordered]@{}; $lastTask = $null; $reviewPasses = 0; $unattributed = 0
  $phaseSec = [ordered]@{}; foreach ($p in $phaseNames) { $phaseSec[$p] = $null }
  $taskSec = [ordered]@{}; $fixList = [System.Collections.Generic.List[object]]::new()
  $isFirst = $true; $firstTs = $null; $lastTs = $null; $prevPhaseTs = $null; $prevMark = $null
  if ($path -and (Test-Path -LiteralPath $path)) {
    $ledgerOut = Hide-Path (Resolve-Path -LiteralPath $path).Path
    foreach ($rawLine in Get-Content -LiteralPath $path) {
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
          # Escalation: the fix round line names a different model than the Task line (new ledgers, escalation at fix round 2).
          # Legacy ledgers (fix line without a model, or `inherit`) escalated at fix round >= 3: keep that check for them only.
          $fmNamed = $fm -and $fm -ne 'inherit'
          $changed = $fmNamed -and $t.model -and $t.model -ne 'inherit' -and (Get-ModelKey $fm) -ne (Get-ModelKey $t.model)
          if ($changed -or (-not $fmNamed -and $round -ge 3)) { $t.escalated = $true; if ($fmNamed) { $t.escalatedTo = $fm } }
        }
      }
      elseif ($line -match '^\s*(?:[-*]\s+)?Fix round\b') { $fix++; $unattributed++; $fixList.Add([ordered]@{ round = $null; task = $null; seconds = (Get-Span $prevMark $ts) }); $prevMark = $ts }
      elseif ($line -match '^\s*(?:[-*]\s+)?Phase review\b') { $reviewPasses++ }
      elseif ($line -match '^\s*(?:[-*]\s+)?Ruling:\s*(.*)$') { $rulings += Hide-Secrets $Matches[1] }
      elseif ($line -match '^\s*(?:[-*]\s+)?Gate:\s*(.*)$') { $gates += Hide-Secrets $Matches[1] }
    }
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
  [pscustomobject]@{
    ledger = $ledgerOut; fixRounds = $fix; unattributedFixRounds = $unattributed; tasks = $taskList
    escalationShare = $(if ($taskMap.Count -gt 0) { [math]::Round($escalated / $taskMap.Count, 4) } else { 0 })
    escalations = $escalated; rulings = @($rulings); gates = @($gates); durations = $durations; firstTs = $firstTs
  }
}

# Ledger line without its optional timestamp prefix.
function Get-LineText([string]$raw) { if ($raw -match $tsRe) { return $Matches[2] }; return $raw }

# Loop ledgers <state>/loop-*/progress.md (none without a state dir).
function Get-LoopLedgers($stateDir) {
  if (-not $stateDir -or -not (Test-Path -LiteralPath $stateDir)) { return , @() }
  return , @(Get-ChildItem -LiteralPath $stateDir -Directory -Filter 'loop-*' | ForEach-Object { Join-Path $_.FullName 'progress.md' } | Where-Object { Test-Path -LiteralPath $_ })
}

# True when the PBI's last state is parked (`Loop: PBI #<n> parked — <question>`, written by Set-ParkedGate.ps1): the last
# `Loop: PBI #<n> <state>` line of a loop ledger wins, so a later started/done/merged line clears it. Across several loop ledgers
# the one whose last such line is newest wins (its timestamp, else the file's write time).
function Test-Parked($n, [AllowEmptyCollection()][string[]]$loopFiles) {
  if ($null -eq $n) { return $false }
  $best = $null; $parked = $false
  foreach ($f in $loopFiles) {
    $last = $null; $at = $null
    foreach ($raw in Get-Content -LiteralPath $f) {
      if ((Get-LineText $raw) -notmatch "^Loop: PBI #$n(?!\d)\s*(\S.*)?$") { continue }
      $last = "$($Matches[1])"; $at = $null
      $ts = [DateTimeOffset]::MinValue
      if ($raw -match $tsRe -and [DateTimeOffset]::TryParse($Matches[1], [cultureinfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal, [ref]$ts)) { $at = $ts }
    }
    if ($null -eq $last) { continue }
    if ($null -eq $at) { $at = [DateTimeOffset](Get-Item -LiteralPath $f).LastWriteTimeUtc }
    if ($null -eq $best -or $at -gt $best) { $best = $at; $parked = $last -match '^parked\b' }
  }
  return $parked
}

# Comparable ruling: the decision before the first ' — ' (drops ' — <why> — <cost>'), then paths -> PATH, SHAs -> SHA, #<n> -> #N, numbers -> N.
function Get-RulingKey([string]$text) {
  $t = ($text -split ' — ', 2)[0]
  $tokens = foreach ($tok in @($t -split '\s+' | Where-Object { $_ })) {
    $null = $tok -match '^(.*?)([,;:)\]]*)$'; $core = $Matches[1]; $tail = $Matches[2]
    if ($core -match '[\\/]' -or $core -match '\.[A-Za-z0-9]{1,5}$') { "PATH$tail" } else { $tok }
  }
  $t = @($tokens) -join ' '
  # a SHA needs a digit, so a 7-letter word of hex letters ('defaced') stays a word
  $t = [regex]::Replace($t, '\b(?=[0-9a-f]*[0-9])[0-9a-f]{7,40}\b', 'SHA')
  $t = [regex]::Replace($t, '#\d+', '#N')
  $t = [regex]::Replace($t, '\b\d+\b', 'N')
  return ($t -replace '\s+', ' ').Trim()
}

function New-Run($n, $led, [bool]$parked, $cost, [string]$src) {
  [ordered]@{
    issue = $n; ledger = $led.ledger; fixRounds = $led.fixRounds; escalations = $led.escalations; gates = $led.gates.Count
    parked = $parked; rulings = @($led.rulings); durations = $led.durations; cost = $cost; source = $src
  }
}

# Run-wide figures over the parsed ledgers ($items: {run, led}).
function Get-Aggregate([AllowEmptyCollection()][object[]]$items) {
  $fix = 0; $tasks = 0; $esc = 0; $gateSum = 0; $parked = 0
  $seen = [System.Collections.Generic.Dictionary[string, int]]::new([StringComparer]::Ordinal)
  foreach ($i in $items) {
    $fix += $i.led.fixRounds; $tasks += @($i.led.tasks).Count; $esc += $i.led.escalations; $gateSum += $i.led.gates.Count
    if ($i.run.parked) { $parked++ }
    $keys = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($r in $i.led.rulings) { $k = Get-RulingKey $r; if ($k) { $null = $keys.Add($k) } }
    foreach ($k in $keys) { $seen[$k] = 1 + $(if ($seen.ContainsKey($k)) { $seen[$k] } else { 0 }) }
  }
  $repeated = @($seen.Keys | Where-Object { $seen[$_] -ge 2 } | ForEach-Object { [ordered]@{ text = $_; count = $seen[$_] } } |
    Sort-Object @{ Expression = { $_.count }; Descending = $true }, @{ Expression = { $_.text }; Descending = $false })
  [ordered]@{
    fixRoundsPerPbi = $(if ($items.Count -gt 0) { [math]::Round($fix / $items.Count, 2) } else { 0 })
    escalationShare = $(if ($tasks -gt 0) { [math]::Round($esc / $tasks, 4) } else { 0 })
    gateCount = $gateSum; parkedCount = $parked; repeatedRulings = $repeated
  }
}

$state = $null

# --- multi-run (-Loop, -Issues, -Since): ledgers only, no transcript, no agentlens
$bound = $PSBoundParameters
$multi = @('Loop', 'Issues', 'Since' | Where-Object { $bound.ContainsKey($_) })
if ($multi.Count -gt 1) { throw '-Loop, -Issues and -Since exclude each other' }
if ($multi.Count -eq 1) {
  if ($Transcript -or $Issue -or $Ledger) { throw '-Transcript, -Issue and -Ledger apply to a single issue only' }
  $sinceTs = $null
  if ($Since) {
    $p = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse($Since, [cultureinfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal, [ref]$p)) { throw "-Since is not an ISO date: $Since" }
    $sinceTs = $p
  } elseif ($multi[0] -eq 'Since') { throw "-Since is not an ISO date: $Since" }
  $state = Resolve-StateDir
  $loopFiles = Get-LoopLedgers $state
  $selected = [System.Collections.Generic.List[object]]::new()  # {n, led}
  if ($Loop) {
    $lf = Join-Path $state "loop-$Loop/progress.md"
    if (-not (Test-Path -LiteralPath $lf)) { throw "Loop ledger not found: $lf" }
    $loopFiles = @($lf)
    $order = [System.Collections.Generic.List[int]]::new()
    foreach ($raw in Get-Content -LiteralPath $lf) {
      if ((Get-LineText $raw) -match '^Loop: PBI #(\d+)\b' -and -not $order.Contains([int]$Matches[1])) { $order.Add([int]$Matches[1]) }
    }
    foreach ($n in $order) { $selected.Add([pscustomobject]@{ n = $n; led = $null }) }
  } elseif ($bound.ContainsKey('Issues')) {
    foreach ($v in @($Issues | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })) {
      if ($v -notmatch '^\d+$') { throw "-Issues takes issue numbers: $v" }
      $selected.Add([pscustomobject]@{ n = [int]$v; led = $null })
    }
  } else {
    $found = @()
    if (Test-Path -LiteralPath $state) {
      foreach ($d in Get-ChildItem -LiteralPath $state -Directory | Where-Object { $_.Name -match '^\d+$' }) {
        $f = Join-Path $d.FullName 'progress.md'
        if (-not (Test-Path -LiteralPath $f)) { continue }
        $led = Read-Ledger $f
        if ($null -eq $led.firstTs) { $warnings.Add("$($d.Name): no timestamps, skipped by -Since"); continue }
        if ($led.firstTs -gt $sinceTs) { $found += [pscustomobject]@{ n = [int]$d.Name; led = $led } }
      }
    }
    foreach ($s in @($found | Sort-Object @{ Expression = { $_.led.firstTs } }, @{ Expression = { $_.n } })) { $selected.Add($s) }
  }
  $items = @(foreach ($s in $selected) {
    $led = if ($s.led) { $s.led } else { Read-Ledger (Join-Path $state "$($s.n)/progress.md") }
    if (-not $led.ledger) { $warnings.Add("Ledger not found for #$($s.n)") }
    [pscustomobject]@{ run = (New-Run $s.n $led (Test-Parked $s.n $loopFiles) $null 'ledger'); led = $led }
  })
  [ordered]@{
    source = 'ledger'; transcript = $null; warnings = @($warnings)
    runs = @($items | ForEach-Object { $_.run }); aggregate = (Get-Aggregate $items)
  } | ConvertTo-Json -Depth 8
  return
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
$led = Read-Ledger $Ledger
if (-not $led.ledger) { $warnings.Add('Ledger not found; fixRounds, rulings and gates are 0.') }
$runIssue = if ($Issue) { [int]$Issue } elseif ($Ledger -and (Split-Path (Split-Path $Ledger) -Leaf) -match '^\d+$') { [int]$Matches[0] } else { $null }
if (-not $state) { $state = try { Resolve-StateDir } catch { $null } }
$mainCost = Get-Num $main 'costMeasured'; $mainEst = Get-Num $main 'costEstimated'
$subCost = Sum-Of $roleList 'costMeasured'; $subEst = Sum-Of $roleList 'costEstimated'
# agentlens splits each amount into one of the two buckets by its own flag, so its total is their sum; the transcript prefers measured cost
$runCost = if ($source -eq 'agentlens') { $mainCost + $mainEst + $subCost + $subEst }
  elseif ($mainCost + $subCost -gt 0) { $mainCost + $subCost } else { $mainEst + $subEst }
$run = New-Run $runIssue $led (Test-Parked $runIssue (Get-LoopLedgers $state)) ([math]::Round($runCost, 4)) $source
[ordered]@{
  source = $source
  transcript = Hide-Path (Resolve-Path $Transcript).Path
  ledger = $led.ledger
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
  fixRounds = $led.fixRounds
  unattributedFixRounds = $led.unattributedFixRounds
  tasks = $led.tasks
  escalationShare = $led.escalationShare
  rulings = [ordered]@{ count = $led.rulings.Count; items = @($led.rulings) }
  gates = [ordered]@{ count = $led.gates.Count; items = @($led.gates) }
  durations = $led.durations
  runs = @($run)
  aggregate = Get-Aggregate @([pscustomobject]@{ run = $run; led = $led })
} | ConvertTo-Json -Depth 8
