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
  Output of every run is appended to .agents/<issue>/run.log. The runner never merges (unless the opt-in -MergeApproved is given) and never answers a gate.
  Run it from the repository root. Exit codes: 0 all done/skipped, 1 failed, 2 gate, 3 nothing selectable (queue mode only).

  -Status <nr>: one-shot 'status <nr>' (no loop, no ledger); prints .agents/status-<nr>.md. Exit 0: file written during this run and
  'Status: .agents/status-<nr>.md' in the output; 2: 'Gate:' line; 1: otherwise. Output in .agents/status-<nr>.log. Not combinable with other selectors. Output and the table are printed with control characters stripped; the marker may be markdown-wrapped.

  -Feature <nr> / -Epic <nr> (queue mode): loops '<harness> --agent orchestrator -p "next <nr>"', one fresh process per
  iteration (selection stays in the orchestrator, github-issue/references/next-selection.md). Stops on:
    '<Feature|Epic> #<nr> is done.' (child exit 0)  -> state done, exit 0
    a 'Gate:' line or a new gate in the PBI ledger   -> state gate, exit 2 (a complete PBI ledger wins over a gate, as in
                                                         positional mode)
    'Nothing selectable' (next-selection.md)         -> state blocked, exit 3: open PBIs are held by blockers/decisions
    a failed run, or the same PBI selected twice in a row without progress -> state failed, exit 1
  -ContinueOnError continues after a failed PBI only if the next iteration selects a different PBI; the same PBI again
  stops the run. This is a process-level loop; it does NOT use the orchestrator 'loop' mode and its ledger
  .agents/loop-<nr>/progress.md. State is cached in .agents/queue-<nr>.json (GitHub stays the source of truth),
  output in .agents/queue-<nr>.log and per PBI in .agents/<pbi>/run.log.
  AGENTS_LEDGER is cleared before every child (also an inherited value) and set to the PBI ledger only in the runner after
  'Next PBI: #<n>' is parsed (a running child cannot be changed); the caller's value is restored at the end.
  A 'Gate:' line (at line start, may be markdown-wrapped: '**Gate**:', '> Gate:'; case-sensitive) in the output stops the queue even when the ledger has no new gate (the question must reach a human).
  -MergeApproved: after a done PBI (child exit 0) whose last 'Verdict:' line is exactly 'Verdict: APPROVE', merge the PBI's open PR (found via the ledger
  line 'Phase pull-request: complete - <url>' and 'gh pr list', head branch must contain '/<pbi>-') with
  'gh pr merge <pr> --squash --match-head-commit <sha>'. Base must be release/*, head must not be release/*
  (the release PR), not a fork PR, mergeable and CLEAN with green checks (configure branch protection with required
  checks so CLEAN means reviewed and tested). The reviewed commit is not recorded by the orchestrator; if the PBI
  branch exists locally its tip must equal the PR head, else the tip on origin (git ls-remote) must; unverifiable -> no merge.
  UNKNOWN mergeability is polled up to 3 times (QUEUE_POLL_SECONDS, default 5); an empty check list is skipped ('no checks reported').
  QUEUE_CALLER_CWD (set by the launcher) is the directory a relative -IssueFile is resolved against. Never after a gate, a block or a failure.
.PARAMETER Issue           Issue numbers (positional), '#12' or '12'.
.PARAMETER IssueFile       Text file with one issue number per line.
.PARAMETER Label           Process all open issues (no PRs) with this label, ascending.
.PARAMETER Mode            plan, implement or full (default), forwarded to the orchestrator. Not combinable with -Feature/-Epic (always 'next').
.PARAMETER Harness         Adapter in harness/<name>.ps1.
.PARAMETER Feature         Queue mode: loop 'next <nr>' for this Feature.
.PARAMETER Epic            Queue mode: same for an Epic.
.PARAMETER Status          One-shot: run 'status <nr>' headless and print .agents/status-<nr>.md. Exit 0 written, 1 missing or stale, 2 gate. No ledger.
.PARAMETER MergeApproved   Queue mode: squash-merge the PBI's open PR on an APPROVE verdict (default off).
.PARAMETER TrustedOnly     With -Label: only issues authored by OWNER, MEMBER or COLLABORATOR (issue text is untrusted input).
.PARAMETER ContinueOnError Continue with the next issue after a failed run.
.PARAMETER FixAdvisories Optional advisory policy (none, medium, all; optionally `:dim,dim`) passed to the orchestrator as `--fix-advisories <policy>` before the mode word.
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
  [ValidatePattern('\A#?[1-9][0-9]{0,9}\z')][string]$Feature,
  [ValidatePattern('\A#?[1-9][0-9]{0,9}\z')][string]$Epic,
  [ValidatePattern('\A#?[1-9][0-9]{0,9}\z')][string]$Status,
  [switch]$MergeApproved,
  [switch]$TrustedOnly,
  [ValidatePattern('\A[a-z]{1,20}\z')][string]$Harness = 'claude',
  [switch]$ContinueOnError,
  [ValidatePattern('(?-i)\A(none|medium|all)(:[a-z][a-z-]*(,[a-z][a-z-]*)*)?\z')][string]$FixAdvisories = '',
  [switch]$AllowAll,
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
$adv = $FixAdvisories ? @{ FixAdvisories = $FixAdvisories } : @{}
# The queue launcher cd's to the git toplevel and passes the caller's directory here, so a relative -IssueFile still
# resolves against where the user typed it. Not inherited by the children.
$callerCwd = $env:QUEUE_CALLER_CWD
[Environment]::SetEnvironmentVariable('QUEUE_CALLER_CWD', $null)
if ($IssueFile -and $callerCwd -and -not [IO.Path]::IsPathRooted($IssueFile)) { $IssueFile = Join-Path $callerCwd $IssueFile }

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
function Test-NotSymlink([string]$Path) {
  # Get-Item -Force (no Test-Path) also sees a dangling symlink.
  $i = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
  if ($i -and $i.LinkTarget) { throw "Refusing symlinked path: $Path" }
}
function Get-HarnessInvocation([string]$Nr, [string]$HarnessMode, [hashtable]$Extra) {
  $adapter = Join-Path $PSScriptRoot "harness/$Harness.ps1"
  if (-not (Test-Path -LiteralPath $adapter)) { throw "No adapter for harness '$Harness' (expected $adapter)." }
  $cmd = & $adapter -Issue $Nr -Mode $HarnessMode -AllowAll:$AllowAll @Extra
  $envVars = if ($cmd.PSObject.Properties['Environment'] -and $cmd.Environment) { $cmd.Environment } else { @{} }
  $line = (@($cmd.Executable) + @($cmd.Arguments) | ForEach-Object { Format-Arg $_ }) -join ' '
  $envText = (@($envVars.Keys | Sort-Object | ForEach-Object { "$_=$(Format-Arg $envVars[$_])" }) + $line) -join ' '
  @{ Cmd = $cmd; EnvVars = $envVars; EnvText = $envText }
}
# Untrusted text (issue titles, model output) must not reach the terminal with escape sequences: strip CSI, OSC (payload
# limited to one line) and other control characters. Same patterns as github-issue/scripts/Write-StatusTable.ps1: skills do not share code.
function Remove-ControlChar([string]$Text) {
  $t = [regex]::Replace($Text, '\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b\r\n]*(\x07|\x1b\\)|\x1b.?', '')
  [regex]::Replace($t, '[\x00-\x08\x0b-\x1f\x7f-\x9f]', '')
}
# Line markers may be markdown-wrapped: opening wrappers (spaces, list dash, quote, bold, code) before the word,
# closing wrappers between the word and the colon ('**Gate**:'). Case-sensitive, never mid-line ('See Gate:').
$MarkerStart = '\A[\s*`>_-]*'
$MarkerEnd = '[*`_]*:'
$GatePattern = $MarkerStart + 'Gate' + $MarkerEnd
function Get-Gates([string[]]$Lines) { @($Lines | ForEach-Object { "$_".Trim() } | Where-Object { $_ -cmatch $GatePattern }) }

if ($Status) {
  $bad = [ordered]@{ 'issue numbers' = ($Issue.Count -gt 0); '-IssueFile' = [bool]$IssueFile; '-Label' = [bool]$Label; '-Feature/-Epic' = [bool]($Feature -or $Epic)
    '-Mode' = $PSBoundParameters.ContainsKey('Mode'); '-MergeApproved' = [bool]$MergeApproved; '-ContinueOnError' = [bool]$ContinueOnError; '-FixAdvisories' = [bool]$FixAdvisories; '-TrustedOnly' = [bool]$TrustedOnly }
  $bad = @($bad.Keys | Where-Object { $bad[$_] })
  if ($bad) { throw "-Status cannot be combined with $($bad -join ', ')." }
  $nr = ConvertTo-IssueNumber $Status 'status'
  $inv = Get-HarnessInvocation $nr 'status' @{}
  $cmd = $inv.Cmd; $envVars = $inv.EnvVars; $envText = $inv.EnvText
  if ($DryRun) { Write-Host "[dry-run] Status #${nr}: $envText"; exit 0 }
  $bin = Get-Command $cmd.Executable -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $bin) { throw "'$($cmd.Executable)' not found on PATH (harness '$Harness'). Install it or pick another -Harness." }
  Test-NotSymlink '.agents'
  New-Item -ItemType Directory -Path '.agents' -Force | Out-Null
  $statusFile = Join-Path '.agents' "status-$nr.md"
  $log = Join-Path '.agents' "status-$nr.log"
  Test-NotSymlink $statusFile
  Test-NotSymlink $log
  $start = Get-Date
  Write-Host "[run] Status #${nr}: $envText"
  Add-Content -LiteralPath $log -Value "=== $($start.ToString('o')) $envText" -Encoding utf8
  $callerLedger = $env:AGENTS_LEDGER
  $saved = @{}
  foreach ($k in $envVars.Keys) { $saved[$k] = [Environment]::GetEnvironmentVariable($k); [Environment]::SetEnvironmentVariable($k, [string]$envVars[$k]) }
  [Environment]::SetEnvironmentVariable('AGENTS_LEDGER', $null)
  try { $out = @(& $bin.Source @($cmd.Arguments) 2>&1 | ForEach-Object { "$_" }); $code = $LASTEXITCODE }
  finally {
    foreach ($k in $saved.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k]) }
    [Environment]::SetEnvironmentVariable('AGENTS_LEDGER', $callerLedger)
  }
  $out = @($out | ForEach-Object { Remove-ControlChar $_ })
  $out | Out-Host
  Add-Content -LiteralPath $log -Value ($out + "=== exit code $code") -Encoding utf8
  $trimmed = @($out | ForEach-Object { $_.Trim() })
  $gateLine = @(Get-Gates $trimmed) | Select-Object -Last 1
  if ($gateLine) { Write-Host "Gate on status #${nr}: $gateLine"; exit 2 }
  Test-NotSymlink $statusFile
  $fi = Get-Item -LiteralPath $statusFile -Force -ErrorAction SilentlyContinue
  $marker = @($trimmed | Where-Object { $_ -cmatch ($MarkerStart + 'Status' + $MarkerEnd + '[\s*`_]*' + "\.agents/status-$nr\.md(?![\w./-])") }).Count -gt 0
  $why = if ($code -ne 0) { "child exit code $code" }
    elseif (-not $fi) { "no status file $statusFile" }
    elseif ($fi.LastWriteTime -lt $start) { "status file $statusFile is stale (not written by this run)" }
    elseif (-not $marker) { "no 'Status: .agents/status-$nr.md' line in the output" }
  if ($why) { Write-Host "Status #${nr} failed: $why"; exit 1 }
  Get-Content -LiteralPath $statusFile | ForEach-Object { Remove-ControlChar $_ } | Out-Host
  exit 0
}

if ($Feature -or $Epic) {
  if ($Feature -and $Epic) { throw 'Pass either -Feature or -Epic, not both.' }
  if ($Issue -or $IssueFile -or $Label) { throw '-Feature/-Epic cannot be combined with issue numbers, -IssueFile or -Label.' }
  if ($PSBoundParameters.ContainsKey('Mode')) { throw '-Mode cannot be combined with -Feature/-Epic (the mode is always next).' }
  $nr = ConvertTo-IssueNumber ($Feature ? $Feature : $Epic) 'queue'
  $kind = $Feature ? 'Feature' : 'Epic'
  $inv = Get-HarnessInvocation $nr 'next' $adv
  $cmd = $inv.Cmd; $envVars = $inv.EnvVars; $envText = $inv.EnvText
  if ($DryRun) { Write-Host "[dry-run] ${kind} #${nr}: $envText"; exit 0 }
  $bin = Get-Command $cmd.Executable -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $bin) { throw "'$($cmd.Executable)' not found on PATH (harness '$Harness'). Install it or pick another -Harness." }
  if ($MergeApproved -and -not (Get-Command gh -CommandType Application -ErrorAction SilentlyContinue)) { throw "'gh' not found on PATH (needed for -MergeApproved)." }

  Test-NotSymlink '.agents'
  New-Item -ItemType Directory -Path '.agents' -Force | Out-Null
  $queueFile = Join-Path '.agents' "queue-$nr.json"
  Test-NotSymlink $queueFile
  $log = Join-Path '.agents' "queue-$nr.log"
  Test-NotSymlink $log
  $started = Get-Date -Format o
  $pbis = [System.Collections.Generic.List[object]]::new()
  function Save-Queue([string]$State, [int]$Code) {
    $o = [ordered]@{ queue = [long]$nr; kind = $kind; harness = $Harness; state = $State; exitCode = $Code; started = $started
      ended = (Get-Date -Format o); mergeApproved = [bool]$MergeApproved; pbis = @($pbis) }
    Set-Content -LiteralPath $queueFile -Value ($o | ConvertTo-Json -Depth 6) -Encoding utf8
  }
  # right after PR creation GitHub may still compute mergeability (UNKNOWN): poll a bounded number of times.
  # QUEUE_POLL_SECONDS (default 5) is the sleep between polls; 0 disables sleeping (tests).
  function Wait-PrState($P) {
    $sec = if ($env:QUEUE_POLL_SECONDS -match '\A[0-9]{1,3}\z') { [int]$env:QUEUE_POLL_SECONDS } else { 5 }
    for ($i = 0; $i -lt 3 -and ($P.mergeable -eq 'UNKNOWN' -or $P.mergeStateStatus -eq 'UNKNOWN'); $i++) {
      if ($sec) { Start-Sleep -Seconds $sec }
      $j = & gh pr view "$($P.number)" --json mergeable,mergeStateStatus,statusCheckRollup 2>$null | Out-String
      if ($LASTEXITCODE -ne 0) { continue }
      try { $v = $j | ConvertFrom-Json } catch { continue }
      if (-not $v) { continue }
      foreach ($f in 'mergeable', 'mergeStateStatus', 'statusCheckRollup') {
        if ($v.PSObject.Properties[$f]) { $P | Add-Member -NotePropertyName $f -NotePropertyValue $v.$f -Force }
      }
    }
    $P
  }
  function Get-LastMatch([string[]]$Lines, [string]$Pattern) {
    $m = @($Lines | Select-String -CaseSensitive -Pattern $Pattern)
    if ($m.Count) { $m[-1].Matches[0] } else { $null }
  }
  # The PBI's open PR: from the ledger line 'Phase pull-request: complete - <url>' and 'gh pr list', never from free text.
  # Returns @{ Pr = <object|null>; Note = <string|null> }.
  function Resolve-PbiPr([string]$Pbi, [string[]]$LedgerLines) {
    $lm = Get-LastMatch $LedgerLines '\APhase pull-request: complete\b.*?/pull/(\d+)'
    $ledgerPr = if ($lm) { [long]$lm.Groups[1].Value } else { $null }
    $json = & gh pr list --state open --limit 100 --json number,state,headRefName,baseRefName,headRefOid,isCrossRepository,mergeable,mergeStateStatus,statusCheckRollup 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { return @{ Pr = $null; Note = 'not merged: gh pr list failed' } }
    try { $all = @($json | ConvertFrom-Json) } catch { return @{ Pr = $null; Note = 'not merged: gh pr list returned no JSON' } }
    $mine = @($all | Where-Object { $_.headRefName -match "(\A|/)$Pbi-" })
    $pick = if ($ledgerPr) { @($mine | Where-Object { $_.number -eq $ledgerPr }) } else { $mine }
    if ($pick.Count -ne 1) { return @{ Pr = $null; Note = "not merged: no single open PR of PBI #$Pbi found (ledger PR: $(if ($ledgerPr) { "#$ledgerPr" } else { 'none' }))" } }
    @{ Pr = $pick[0]; Note = $null }
  }
  $callerLedger = $env:AGENTS_LEDGER
  $exit = 0; $state = 'running'; $prev = $null
  Save-Queue $state 0
  try {
  while ($true) {
    $iterStart = Get-Date -Format o
    $gatesBefore = @{}
    $completeBefore = [System.Collections.Generic.List[string]]::new()
    foreach ($d in @(Get-ChildItem -LiteralPath '.agents' -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '\A[0-9]+\z' })) {
      $ll = Get-LedgerLines $d.Name
      $gatesBefore[$d.Name] = @(Get-Gates $ll).Count
      if (Test-Complete $ll) { $completeBefore.Add($d.Name) }
    }
    Write-Host "[run] ${kind} #${nr}: $envText"
    Add-Content -LiteralPath $log -Value "=== $iterStart $envText" -Encoding utf8
    $saved = @{}
    foreach ($k in $envVars.Keys) { $saved[$k] = [Environment]::GetEnvironmentVariable($k); [Environment]::SetEnvironmentVariable($k, [string]$envVars[$k]) }
    [Environment]::SetEnvironmentVariable('AGENTS_LEDGER', $null)
    try { $out = @(& $bin.Source @($cmd.Arguments) 2>&1 | ForEach-Object { "$_" }); $code = $LASTEXITCODE }
    finally { foreach ($k in $saved.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k]) } }
    $out | Out-Host
    $trailer = "=== exit code $code"
    Add-Content -LiteralPath $log -Value ($out + $trailer) -Encoding utf8

    $featureDone = $code -eq 0 -and @($out | Where-Object { $_ -cmatch "\A\W*$kind #$nr is done\b" }).Count -gt 0
    $mergedListed = @()
    $ml = Get-LastMatch $out "$kind #$nr is done.*merged, closes at release:\s*(.+)\z"
    if ($ml) { $mergedListed = @([regex]::Matches($ml.Groups[1].Value, '#(\d+)') | ForEach-Object { $_.Groups[1].Value }) }
    $np = Get-LastMatch $out '\A\W*Next PBI: #([0-9]{1,10})\b'
    $pbi = if ($np) { $np.Groups[1].Value } else { $null }
    $gm = @(Get-Gates $out) | Select-Object -Last 1
    $blockedLine = Get-LastMatch @($out | ForEach-Object { $_.Trim() }) '\A\W*Nothing selectable\b.*'
    $stop = $false

    if ($pbi) {
      $pbiDir = Join-Path '.agents' $pbi
      Test-NotSymlink $pbiDir
      New-Item -ItemType Directory -Path $pbiDir -Force | Out-Null
      Test-NotSymlink (Join-Path $pbiDir 'run.log')
      Add-Content -LiteralPath (Join-Path $pbiDir 'run.log') -Value (@("=== $iterStart $envText") + $out + $trailer) -Encoding utf8
      $env:AGENTS_LEDGER = Join-Path (Get-Location) (Join-Path $pbiDir 'progress.md')
      $after = Get-LedgerLines $pbi
      $newGate = @(Get-Gates $after).Count -gt [int]$gatesBefore[$pbi]
      $gate = if ($gm) { $gm } elseif ($newGate) { @(Get-Gates $after)[-1] } else { $null }
      $lp = Get-LastMatch $after '\APhase pull-request: complete\b.*?/pull/(\d+)'
      $pr = if ($lp) { [long]$lp.Groups[1].Value } else { $null }
      $entry = [ordered]@{ number = [long]$pbi; outcome = 'failed'; pr = $pr; ledger = ".agents/$pbi/progress.md"; gate = $gate; started = $iterStart; ended = $null; note = $null }
      if ($prev -eq $pbi) { $entry.note = 'selected twice in a row without progress; stopped'; $stop = $true; $exit = 1 }
      elseif (Test-Complete $after) { $entry.outcome = if ($completeBefore -contains $pbi) { 'skipped' } else { 'done' }; $entry.gate = $null }
      elseif ($gate) { $entry.outcome = 'gate'; $stop = $true; $exit = 2 }
      else { $entry.note = "run ended without 'Ledger complete.' (exit code $code)" }
      if ($entry.outcome -eq 'done' -and $MergeApproved) {
        $vm = Get-LastMatch $out '\A\W*Verdict:.*'
        if ($code -ne 0) { $entry.note = "not merged: child exit code $code" }
        elseif (-not $vm) { $entry.note = 'not merged: no Verdict: line in the output' }
        elseif ($vm.Value -cnotmatch '\A[\s*`>#_-]*Verdict:\s*APPROVE[\s*`_]*\z') { $entry.note = "not merged: verdict is not a plain APPROVE ($($vm.Value.Trim()))" }
        else {
          $res = Resolve-PbiPr $pbi $after
          $p = $res.Pr
          if ($p -and ($p.mergeable -eq 'UNKNOWN' -or $p.mergeStateStatus -eq 'UNKNOWN')) { $p = Wait-PrState $p }
          $why = $null
          if (-not $p) { $why = $res.Note }
          elseif ($p.state -ne 'OPEN') { $why = "PR #$($p.number) not merged: state $($p.state)" }
          elseif ($p.headRefName -match '\Arelease/') { $why = "PR #$($p.number) not merged: release PR" }
          elseif ($p.baseRefName -notmatch '\Arelease/') { $why = "PR #$($p.number) not merged: base $($p.baseRefName) is not the integration branch (release/*)" }
          elseif ($p.isCrossRepository -ne $false -or $p.headRefName -match ':') { $why = "PR #$($p.number) not merged: fork or cross-repository PR" }
          elseif (-not $p.headRefOid) { $why = "PR #$($p.number) not merged: head commit unknown" }
          elseif ($p.mergeable -eq 'UNKNOWN' -or $p.mergeStateStatus -eq 'UNKNOWN') { $why = "PR #$($p.number) not merged: mergeability still UNKNOWN after 3 polls" }
          elseif ($p.mergeable -ne 'MERGEABLE' -or $p.mergeStateStatus -ne 'CLEAN') { $why = "PR #$($p.number) not merged: not mergeable/clean ($($p.mergeable)/$($p.mergeStateStatus))" }
          elseif (-not $p.statusCheckRollup -or @($p.statusCheckRollup).Count -eq 0) { $why = "PR #$($p.number) not merged: no checks reported" }
          elseif (@($p.statusCheckRollup | Where-Object { $_ -and -not (($_.conclusion -in 'SUCCESS', 'NEUTRAL', 'SKIPPED') -or ($_.state -eq 'SUCCESS')) }).Count) { $why = "PR #$($p.number) not merged: checks are not green" }
          else {
            # The reviewed commit is not recorded by the orchestrator: compare with the local branch tip when it exists,
            # otherwise with the tip of the branch on origin. Not verifiable -> no merge.
            $tip = (& git rev-parse --verify --quiet "refs/heads/$($p.headRefName)" 2>$null)
            if ($LASTEXITCODE -eq 0 -and $tip) { $where = 'local branch'; $tip = $tip.Trim() }
            else {
              $where = 'origin branch'
              $rl = @(& git ls-remote origin "refs/heads/$($p.headRefName)" 2>$null)
              $tip = if ($LASTEXITCODE -eq 0 -and $rl.Count -eq 1 -and "$($rl[0])" -match '\A([0-9a-f]{40,64})\s') { $Matches[1] } else { $null }
            }
            if (-not $tip) { $why = "PR #$($p.number) not merged: head $($p.headRefOid) cannot be verified (no local branch, not found on origin)" }
            elseif ($tip -ne $p.headRefOid) { $why = "PR #$($p.number) not merged: head $($p.headRefOid) differs from $where tip $tip" }
          }
          if ($why) { $entry.note = $why }
          else {
            $entry.pr = [long]$p.number
            & gh pr merge "$($p.number)" --squash --match-head-commit $p.headRefOid 2>&1 | Out-Host
            if ($LASTEXITCODE -eq 0) { $entry.outcome = 'merged' }
            else { $entry.outcome = 'failed'; $entry.note = "gh pr merge #$($p.number) failed"; $stop = $true; $exit = 1 }
          }
        }
      }
      $entry.ended = Get-Date -Format o
      $pbis.Add([pscustomobject]$entry)
      $prev = $pbi
      if ($entry.outcome -eq 'failed' -and -not $stop) {
        $exit = 1
        if (-not $ContinueOnError) { $stop = $true }
      }
    } elseif (-not $featureDone) {
      $gate = if ($gm) { $gm } else { $null }
      $blocked = (-not $gate) -and $blockedLine -and $code -eq 0
      $pbis.Add([pscustomobject][ordered]@{ number = $null; outcome = $(if ($gate) { 'gate' } elseif ($blocked) { 'blocked' } else { 'failed' }); pr = $null; ledger = $null; gate = $gate
        started = $iterStart; ended = (Get-Date -Format o)
        note = $(if ($gate) { $null } elseif ($blocked) { $blockedLine.Value } else { "no 'Next PBI:' or '$kind #$nr is done.' in the output (exit code $code)" }) })
      $stop = $true; $exit = if ($gate) { 2 } elseif ($blocked) { 3 } else { 1 }
    }
    if ($featureDone -and $exit -ne 2) {
      foreach ($m in $mergedListed) {
        if (-not ($pbis | Where-Object { "$($_.number)" -eq $m })) {
          $pbis.Add([pscustomobject][ordered]@{ number = [long]$m; outcome = 'merged'; pr = $null; ledger = $null; gate = $null; started = $iterStart; ended = (Get-Date -Format o); note = 'merged, closes at release' })
        }
      }
      $stop = $true
    }
    $state = switch ($exit) { 0 { 'done' } 2 { 'gate' } 3 { 'blocked' } default { 'failed' } }
    Save-Queue $(if ($stop) { $state } else { 'running' }) $exit
    if ($stop) { break }
  }
  } catch {
    # unexpected error: leave a truthful cache, then fail
    $exit = 1
    try { $pbis.Add([pscustomobject][ordered]@{ number = $null; outcome = 'failed'; pr = $null; ledger = $null; gate = $null; started = $started; ended = (Get-Date -Format o); note = "runner error: $($_.Exception.Message)" }); Save-Queue 'failed' 1 } catch { Write-Warning "Could not write ${queueFile}: $($_.Exception.Message)" }
    throw
  } finally {
    [Environment]::SetEnvironmentVariable('AGENTS_LEDGER', $callerLedger)
  }
  foreach ($e in $pbis) { Write-Host "$(if ($e.number) { "#$($e.number)" } else { '-' }) $($e.outcome)$(if ($e.pr) { " (PR #$($e.pr))" })$(if ($e.note) { " - $($e.note)" })" }
  if ($exit -eq 2) { Write-Host "Gate on ${kind} #${nr}, queue stopped (answer it, then run the queue again): $($pbis[-1].gate)" }
  if ($exit -eq 3) { Write-Host "Nothing selectable in ${kind} #${nr}: open PBIs are held by blockers or decisions, see the output above." }
  if ($exit -eq 0) { Write-Host "$kind #$nr is done." }
  exit $exit
}

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
  $jq = '.[] | select(.pull_request | not)' + $(if ($TrustedOnly) { ' | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR"))' } else { '' }) + ' | .number'
  $found = @(& gh api --method GET --paginate $q --jq $jq)
  if ($LASTEXITCODE -ne 0) { throw "gh api failed for label '$Label'." }
  foreach ($n in ($found | ForEach-Object { [int]$_ } | Sort-Object)) { $issues.Add("$n") }
}
$queue = @($issues | Select-Object -Unique)
if ($queue.Count -eq 0) { throw 'No issues: pass issue numbers, -IssueFile or -Label.' }

$adapter = Join-Path $PSScriptRoot "harness/$Harness.ps1"
if (-not (Test-Path -LiteralPath $adapter)) { throw "No adapter for harness '$Harness' (expected $adapter)." }

if (-not $DryRun) {
  $probe = & $adapter -Issue $queue[0] -Mode $Mode -AllowAll:$AllowAll @adv
  if (-not (Get-Command $probe.Executable -CommandType Application -ErrorAction SilentlyContinue)) { throw "'$($probe.Executable)' not found on PATH (harness '$Harness'). Install it or pick another -Harness." }
  Test-NotSymlink '.agents'
}
$results = [ordered]@{}
$exit = 0
$stopped = $false
foreach ($n in $queue) {
  if ($stopped) { $results[$n] = 'not-run'; continue }
  if (Test-Complete (Get-LedgerLines $n)) { $results[$n] = 'skipped'; continue }
  $cmd = & $adapter -Issue $n -Mode $Mode -AllowAll:$AllowAll @adv
  $line = (@($cmd.Executable) + @($cmd.Arguments) | ForEach-Object { Format-Arg $_ }) -join ' '
  $envVars = if ($cmd.PSObject.Properties['Environment'] -and $cmd.Environment) { $cmd.Environment } else { @{} }
  $envText = (@($envVars.Keys | Sort-Object | ForEach-Object { "$_=$(Format-Arg $envVars[$_])" }) + $line) -join ' '
  if ($DryRun) { Write-Host "[dry-run] #${n}: $envText"; $results[$n] = 'dry-run'; continue }
  $bin = Get-Command $cmd.Executable -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $bin) { throw "'$($cmd.Executable)' not found on PATH (harness '$Harness'). Install it or pick another -Harness." }
  $gatesBefore = @(Get-Gates (Get-LedgerLines $n)).Count
  $dir = Join-Path '.agents' $n
  Test-NotSymlink $dir
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  $log = Join-Path $dir 'run.log'
  Test-NotSymlink $log
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
