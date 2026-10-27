#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Works through issues one by one, starting a fresh headless orchestrator process per issue.
.DESCRIPTION
  Issues come from positional arguments, -IssueFile (one number per line) or -Label (open issues via gh api GET).
  Files live in the state dir (DROMOS_STATE_DIR, else <git common dir>/agents, shared by all worktrees), shown as <state>/.
  The ledger <state>/<issue>/progress.md is the source of truth, not the exit code:
    last line 'Ledger complete.'        -> done (before the run: skipped, nothing is started)
    new 'Gate: <question>' line         -> gate: the queue stops, the question is printed, exit 2 (issue-list mode; -Feature/-Epic park it, see below)
    neither                             -> failed: the queue stops (exit 1) unless -ContinueOnError
  Output of every run is appended to <state>/<issue>/run.log. In -Feature/-Epic mode the runner merges the approved PR of every done PBI (unless -NoMerge) and never answers a gate.
  Feature/Epic mode runs github-project/scripts/Sync-ProjectNeeds.ps1 -Issue <pbi> -IncludeParents after each 'Next PBI:' and after the PBI entry is decided
  (best effort, result in <state>/<pbi>/run.log, never changes the exit code; PROJECT_SYNC_OFF=1 disables, NEEDS_SYNC_SCRIPT overrides the script path).
  Run it from the repository root. Exit codes: 0 all done/skipped, 1 failed, 2 gate, 3 nothing selectable (queue mode only).

  -Status <nr>: one-shot 'status <nr>' (no loop, no ledger); prints <state>/status-<nr>.md. Exit 0: file written during this run and
  'Status: <path>/status-<nr>.md' in the output (matched on the basename); 2: 'Gate:' line; 1: otherwise. Output in <state>/status-<nr>.log. Not combinable with other selectors. Output and the table are printed with control characters stripped; the marker may be markdown-wrapped.

  -Feature <nr> / -Epic <nr> (queue mode): loops '<harness> --agent orchestrator -p "next <nr>"', one fresh process per
  iteration (selection stays in the orchestrator, github-issue/references/next-selection.md). Stops on:
    '<Feature|Epic> #<nr> is done.' (child exit 0)  -> state done, exit 0
    a 'Gate:' line or a new gate in the PBI ledger   -> the PBI is parked and the queue continues: github-issue/scripts/Set-ParkedGate.ps1
                                                         -Issue <pbi> -Question <gate text> (PARK_SCRIPT overrides; a failure is the entry note),
                                                         outcome parked, listed under 'parked' in queue-<nr>.json before the next child starts
                                                         (a complete PBI ledger wins over a gate, as in positional mode)
    a gate without a 'Next PBI:' line                -> state gate, exit 2 (terminal)
    'Nothing selectable' (next-selection.md)         -> state blocked, exit 3: open PBIs are held by blockers/decisions
    a failed run, the same PBI selected twice in a row without progress, or a parked PBI selected again -> state failed, exit 1
  At the end, one or more parked PBIs turn exit 0 or 3 into state gate, exit 2 ('#<n> parked - <question>' per PBI and
  'Parked in <kind> #<nr>: answer with /ruling <option> on each PBI, then run the queue again'); a failure (exit 1, also an earlier
  one under -ContinueOnError) still wins.
  -ContinueOnError continues after a failed PBI only if the next iteration selects a different PBI; the same PBI again
  stops the run. This is a process-level loop; it does NOT use the orchestrator 'loop' mode and its ledger
  <state>/loop-<nr>/progress.md. State is cached in <state>/queue-<nr>.json (GitHub stays the source of truth),
  output in <state>/queue-<nr>.log and per PBI in <state>/<pbi>/run.log.
  AGENTS_LEDGER is cleared before every child (also an inherited value) and set to the PBI ledger only in the runner after
  'Next PBI: #<n>' is parsed (a running child cannot be changed); the caller's value is restored at the end.
  A 'Gate:' line (at line start, may be markdown-wrapped: '**Gate**:', '> Gate:'; case-sensitive) in the output parks the PBI (or, without a selected PBI, stops the queue) even when the ledger has no new gate (the question must reach a human).
  Merge (default in -Feature/-Epic mode): after a done PBI (child exit 0) the runner calls github-pull-request/scripts/Merge-ApprovedPr.ps1
  -Issue <pbi> -Ledger <state>/<pbi>/progress.md (MERGE_SCRIPT overrides). That script owns every precondition (review.json APPROVE, one open PR,
  release/* base, mergeable and CLEAN, green checks, head verification). 'merged <sha>' -> outcome merged; 'skipped: <reason>' -> note 'not merged: <reason>'
  (label needs-review and a comment are set on the PBI); exit 1 -> outcome failed, the queue stops. -NoMerge never merges but still calls the script with
  -NoMerge (label and comment). -MergeApproved is the old opt-in flag, accepted as an alias (no-op); with -NoMerge it is an error.
  Issue-list mode inside a repository: per issue Enter-Checkout.ps1 (github-issue/scripts) chooses the working directory of the child (the main
  checkout when no live lease of another issue holds it and no tracked file is modified, else .worktrees/<nr>) and Exit-Checkout.ps1 releases it after the
  ledger verdict (a clean worktree is removed, a dirty one kept). A gate keeps lease and worktree and prints the path to resume in. Outside a repository
  (DROMOS_STATE_DIR only) the child runs in the current directory. -Feature/-Epic and -Status do not use leases.
  QUEUE_CALLER_CWD (set by the launcher) is the directory a relative -IssueFile is resolved against. Never after a gate, a block or a failure.
.PARAMETER Issue           Issue numbers (positional), '#12' or '12'.
.PARAMETER IssueFile       Text file with one issue number per line.
.PARAMETER Label           Process all open issues (no PRs) with this label, ascending.
.PARAMETER Mode            plan, implement or full (default), forwarded to the orchestrator. Not combinable with -Feature/-Epic (always 'next').
.PARAMETER Harness         Adapter in harness/<name>.ps1.
.PARAMETER Feature         Queue mode: loop 'next <nr>' for this Feature.
.PARAMETER Epic            Queue mode: same for an Epic.
.PARAMETER Status          One-shot: run 'status <nr>' headless and print <state>/status-<nr>.md. Exit 0 written, 1 missing or stale, 2 gate. No ledger.
.PARAMETER MergeApproved   Alias of the default: queue mode merges the approved PR of a done PBI (error together with -NoMerge).
.PARAMETER NoMerge         Queue mode: never merge; the script still labels needs-review and comments.
.PARAMETER TrustedOnly     With -Label: only issues authored by OWNER, MEMBER or COLLABORATOR (issue text is untrusted input).
.PARAMETER ContinueOnError Continue with the next issue after a failed run.
.PARAMETER FixAdvisories Optional advisory policy (none, medium, all; optionally `:dim,dim`) passed to the orchestrator as `--fix-advisories <policy>` before the mode word.
.PARAMETER PbiParallel     -Feature/-Epic only: 1-4, forwarded as `--pbi-parallel <m>` before the mode word (the orchestrator's loop mode reads it; 'next' ignores it).
.PARAMETER Parallel Optional Task-wave width 1-4, passed to the orchestrator as `--parallel <n>` after `--fix-advisories`; 0 = not given.
.PARAMETER AllowAll        Opt in to the harness' unrestricted permission mode (default: narrow set).
.PARAMETER Base            Issue-list mode: integration branch on origin that Enter-Checkout.ps1 starts the run branch feat/<nr> from (default: release/next when origin has it, else the default branch of origin, else main).
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
  [switch]$NoMerge,
  [switch]$TrustedOnly,
  [ValidatePattern('\A[a-z]{1,20}\z')][string]$Harness = 'claude',
  [switch]$ContinueOnError,
  [ValidatePattern('(?-i)\A(none|medium|all)(:[a-z][a-z-]*(,[a-z][a-z-]*)*)?\z')][string]$FixAdvisories = '',
  [ValidateRange(1, 4)][int]$PbiParallel,
  [ValidateRange(1, 4)][int]$Parallel = 0,
  [switch]$AllowAll,
  [ValidatePattern('\A[A-Za-z0-9][A-Za-z0-9._/-]{0,199}\z')][string]$Base,
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
$adv = @{}
if ($FixAdvisories) { $adv.FixAdvisories = $FixAdvisories }
if ($PSBoundParameters.ContainsKey('PbiParallel')) { $adv.PbiParallel = $PbiParallel }
if ($Parallel) { $adv.Parallel = $Parallel }
# The queue launcher cd's to the git toplevel and passes the caller's directory here, so a relative -IssueFile still
# resolves against where the user typed it. Not inherited by the children.
$callerCwd = $env:QUEUE_CALLER_CWD
[Environment]::SetEnvironmentVariable('QUEUE_CALLER_CWD', $null)
if ($IssueFile -and $callerCwd -and -not [IO.Path]::IsPathRooted($IssueFile)) { $IssueFile = Join-Path $callerCwd $IssueFile }

# BEGIN Resolve-StateDir (identical in every script that defines it; test/repo/state-dir-resolver.test.ts)
function Resolve-StateDir {
  if ($env:DROMOS_STATE_DIR) { return [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($env:DROMOS_STATE_DIR, (Get-Location).Path)) }
  $common = $null
  try { $common = "$(& git -C (Get-Location).Path rev-parse --path-format=absolute --git-common-dir 2>$null)".Trim() } catch { $common = $null }
  if ($LASTEXITCODE -ne 0 -or -not $common) { throw 'No state directory: not inside a git repository (set DROMOS_STATE_DIR)' }
  [IO.Path]::GetFullPath((Join-Path $common 'agents'))
}
# END Resolve-StateDir
# Resolved on first use (after argument validation) and cached: DROMOS_STATE_DIR, else <git common dir>/agents.
function Get-StateDir { if (-not $script:StateDirCache) { $script:StateDirCache = Resolve-StateDir }; $script:StateDirCache }
function ConvertTo-IssueNumber([string]$Text, [string]$Where) {
  $t = $Text.Trim() -replace '\A#', ''
  if ($t -notmatch '\A[1-9][0-9]{0,9}\z') { throw "Invalid issue number '$Text' ($Where)." }
  $t
}
function Format-Arg([string]$a) { if ($a -match '[\s"''()]' -or $a -eq '') { '"' + ($a -replace '"', '\"') + '"' } else { $a } }
function Get-LedgerLines([string]$n) {
  $f = Join-Path (Join-Path (Get-StateDir) $n) 'progress.md'
  # the optional ISO-8601 UTC prefix of a ledger line ('2026-10-21T15:19:46Z <text>') is dropped: older ledgers have none
  if (Test-Path -LiteralPath $f) { @(Get-Content -LiteralPath $f | Where-Object { $_.Trim() } | ForEach-Object { $_ -replace '\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z ', '' }) } else { @() }
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
# Project Needs sync at PBI boundaries: Sync-ProjectNeeds.ps1 of the github-project skill (installed beside this skill, or the repository
# layout; NEEDS_SYNC_SCRIPT overrides). Best effort: output and failures go to the log file, never to $exit or $stop. PROJECT_SYNC_OFF=1 disables.
function Invoke-NeedsSync([string]$Pbi, [string]$LogFile) {
  if ($env:PROJECT_SYNC_OFF -eq '1') { return }
  try {
    $f = $env:NEEDS_SYNC_SCRIPT
    if (-not $f) {
      foreach ($d in @((Join-Path $PSScriptRoot '../../github-project/scripts'), (Join-Path $PSScriptRoot '../../../../../github/.apm/skills/github-project/scripts'))) {
        $c = Join-Path $d 'Sync-ProjectNeeds.ps1'
        if (Test-Path -LiteralPath $c -PathType Leaf) { $f = (Resolve-Path -LiteralPath $c).Path; break }
      }
    }
    if (-not $f -or -not (Test-Path -LiteralPath $f -PathType Leaf)) { Add-Content -LiteralPath $LogFile -Value "Needs sync skipped: Sync-ProjectNeeds.ps1 not found" -Encoding utf8; return }
    $o = @(& pwsh -NoProfile -File $f -Issue $Pbi -IncludeParents 2>&1 | ForEach-Object { "$_" })
    $c = $LASTEXITCODE
    $o = @($o | Where-Object { $_.Trim() } | Select-Object -Last 1)
    $line = if ($c -ne 0) { "Needs sync failed for #${Pbi} (exit code $c)$(if ($o) { ': ' + $o[0] })" } elseif ($o) { $o[0] } else { "Needs sync #${Pbi}: no output" }
    Add-Content -LiteralPath $LogFile -Value $line -Encoding utf8
  } catch {
    try { Add-Content -LiteralPath $LogFile -Value "Needs sync failed for #${Pbi}: $($_.Exception.Message)" -Encoding utf8 } catch { }
  }
}
# Parks a gated PBI of the Feature/Epic queue: Set-ParkedGate.ps1 of the github-issue skill (installed beside this skill, or the
# repository layout; PARK_SCRIPT overrides). Output goes to the PBI run.log. Returns $null on success, else a note; never throws.
function Invoke-ParkGate([string]$Pbi, [string]$Question, [string]$LogFile) {
  try {
    $f = $env:PARK_SCRIPT
    if (-not $f) {
      foreach ($d in @((Join-Path $PSScriptRoot '../../github-issue/scripts'), (Join-Path $PSScriptRoot '../../../../../github/.apm/skills/github-issue/scripts'))) {
        $c = Join-Path $d 'Set-ParkedGate.ps1'
        if (Test-Path -LiteralPath $c -PathType Leaf) { $f = (Resolve-Path -LiteralPath $c).Path; break }
      }
    }
    if (-not $f -or -not (Test-Path -LiteralPath $f -PathType Leaf)) { return 'park script failed: Set-ParkedGate.ps1 not found' }
    $q = if ($Question) { $Question } else { '(no question text)' }
    $o = @(& pwsh -NoProfile -File $f -Issue $Pbi -Question $q 2>&1 | ForEach-Object { "$_" })
    $c = $LASTEXITCODE
    Add-Content -LiteralPath $LogFile -Value (@("Park #${Pbi} (exit code $c):") + $o) -Encoding utf8
    if ($c -ne 0) { return "park script failed (exit code $c)" }
    $res = $null
    try { $res = @($o | Where-Object { $_.Trim() })[-1] | ConvertFrom-Json } catch { return 'park script failed: no JSON result' }
    $bad = @(foreach ($k in 'label', 'comment', 'ledger', 'checkout') { if ($res.PSObject.Properties[$k] -and "$($res.$k)" -eq 'failed') { $k } })
    if ($bad) { return "park script failed: $($bad -join ', ')" }
    $null
  } catch {
    "park script failed: $($_.Exception.Message)"
  }
}

# Merges the approved PR of a done PBI: Merge-ApprovedPr.ps1 of the github-pull-request skill (installed beside this skill, or the
# repository layout; MERGE_SCRIPT overrides). Output goes to the PBI run.log. Never throws; returns @{ Merged; Failed; Note }.
# The script prints 'merged <sha>' or 'skipped: <reason>' (its exit 1 is a failed 'gh pr merge').
function Invoke-MergeApproved([string]$Pbi, [string]$LedgerFile, [string]$LogFile) {
  try {
    $f = $env:MERGE_SCRIPT
    if (-not $f) {
      foreach ($d in @((Join-Path $PSScriptRoot '../../github-pull-request/scripts'), (Join-Path $PSScriptRoot '../../../../../github/.apm/skills/github-pull-request/scripts'))) {
        $c = Join-Path $d 'Merge-ApprovedPr.ps1'
        if (Test-Path -LiteralPath $c -PathType Leaf) { $f = (Resolve-Path -LiteralPath $c).Path; break }
      }
    }
    if (-not $f -or -not (Test-Path -LiteralPath $f -PathType Leaf)) { return @{ Merged = $false; Failed = $true; Note = 'not merged: Merge-ApprovedPr.ps1 not found' } }
    $a = @('-NoProfile', '-File', $f, '-Issue', $Pbi, '-Ledger', $LedgerFile)
    if ($NoMerge) { $a += '-NoMerge' }
    $o = @(& pwsh @a 2>&1 | ForEach-Object { "$_" })
    $c = $LASTEXITCODE
    Add-Content -LiteralPath $LogFile -Value (@("Merge #${Pbi} (exit code $c):") + $o) -Encoding utf8
    $o | Out-Host
    if ($c -ne 0) { return @{ Merged = $false; Failed = $true; Note = "merge of PBI #$Pbi failed (exit code $c)" } }
    $res = @($o | Where-Object { $_ -cmatch '\A(merged [0-9a-f]{7,64}|skipped: .+)\z' }) | Select-Object -Last 1
    if (-not $res) { return @{ Merged = $false; Failed = $false; Note = 'not merged: no result line from Merge-ApprovedPr.ps1' } }
    if ($res.StartsWith('merged ')) { return @{ Merged = $true; Failed = $false; Note = $null } }
    @{ Merged = $false; Failed = $false; Note = 'not merged: ' + $res.Substring(9) }
  } catch {
    @{ Merged = $false; Failed = $true; Note = "merge script failed: $($_.Exception.Message)" }
  }
}

if ($MergeApproved -and $NoMerge) { throw '-MergeApproved cannot be combined with -NoMerge.' }
if ($Status) {
  $bad = [ordered]@{ 'issue numbers' = ($Issue.Count -gt 0); '-IssueFile' = [bool]$IssueFile; '-Label' = [bool]$Label; '-Feature/-Epic' = [bool]($Feature -or $Epic)
    '-Mode' = $PSBoundParameters.ContainsKey('Mode'); '-MergeApproved' = [bool]$MergeApproved; '-NoMerge' = [bool]$NoMerge; '-ContinueOnError' = [bool]$ContinueOnError; '-FixAdvisories' = [bool]$FixAdvisories; '-PbiParallel' = $PSBoundParameters.ContainsKey('PbiParallel'); '-Parallel' = [bool]$Parallel; '-TrustedOnly' = [bool]$TrustedOnly }
  $bad = @($bad.Keys | Where-Object { $bad[$_] })
  if ($bad) { throw "-Status cannot be combined with $($bad -join ', ')." }
  $nr = ConvertTo-IssueNumber $Status 'status'
  $inv = Get-HarnessInvocation $nr 'status' @{}
  $cmd = $inv.Cmd; $envVars = $inv.EnvVars; $envText = $inv.EnvText
  if ($DryRun) { Write-Host "[dry-run] Status #${nr}: $envText"; exit 0 }
  $bin = Get-Command $cmd.Executable -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $bin) { throw "'$($cmd.Executable)' not found on PATH (harness '$Harness'). Install it or pick another -Harness." }
  Test-NotSymlink (Get-StateDir)
  New-Item -ItemType Directory -Path (Get-StateDir) -Force | Out-Null
  $statusFile = Join-Path (Get-StateDir) "status-$nr.md"
  $log = Join-Path (Get-StateDir) "status-$nr.log"
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
  # the announced path must name this run's status file: absolute, relative to the cwd, a trailing part of it, or the bare file name
  $markerRx = $MarkerStart + 'Status' + $MarkerEnd + '[\s*`_]*' + "(?<p>(?:[^*`\r\n]*[/\\])?status-$nr\.md)(?![\w./-])"
  $wantFull = $statusFile -replace '\\', '/'
  $marker = @($trimmed | Where-Object {
      if ($_ -cnotmatch $markerRx) { return $false }
      $mp = $Matches['p'] -replace '\\', '/'
      $mp -ceq "status-$nr.md" -or ($mp.StartsWith('/') ? $mp -ceq $wantFull : ($wantFull -ceq ([IO.Path]::GetFullPath($mp, (Get-Location).Path) -replace '\\', '/') -or $wantFull.EndsWith('/' + $mp.TrimStart('.', '/'), [StringComparison]::Ordinal)))
    }).Count -gt 0
  $why = if ($code -ne 0) { "child exit code $code" }
    elseif (-not $fi) { "no status file $statusFile" }
    elseif ($fi.LastWriteTime -lt $start) { "status file $statusFile is stale (not written by this run)" }
    elseif (-not $marker) { "no 'Status: <path>/status-$nr.md' line in the output" }
  if ($why) { Write-Host "Status #${nr} failed: $why"; exit 1 }
  Get-Content -LiteralPath $statusFile | ForEach-Object { Remove-ControlChar $_ } | Out-Host
  exit 0
}

# Shared Needs rule: cross-skill import of the github package's github-issue/scripts/NeedsRules.psm1 (documented in SKILL.md), installed beside this skill or in the repository layout).
# The PBI walk is an approximation of the orchestrator's `next` selection (which stays in the orchestrator), not a copy of it.
function Get-NeedsModule {
  foreach ($d in @((Join-Path $PSScriptRoot '../../github-issue/scripts'), (Join-Path $PSScriptRoot '../../../../../github/.apm/skills/github-issue/scripts'))) {
    $f = Join-Path $d 'NeedsRules.psm1'
    if (Test-Path -LiteralPath $f -PathType Leaf) { return (Resolve-Path -LiteralPath $f).Path }
  }
  throw 'NeedsRules.psm1 not found (install the github package beside the delivery package).'
}
# Dry run of -Feature/-Epic: one line per open PBI "#<nr> <Needs> <title>", "(skip)" for what the queue skips. gh GET calls only; any failure is one line.
function Write-DryRunNeeds([string]$Root) {
  try {
    if (-not (Get-Command gh -CommandType Application -ErrorAction SilentlyContinue)) { throw "'gh' not found on PATH" }
    Import-Module (Get-NeedsModule) -Force
    $pbis = [System.Collections.Generic.List[object]]::new()
    $queue = [System.Collections.Generic.Queue[object]]::new()
    $queue.Enqueue(@{ n = [int]$Root; d = 0 })
    $seen = @{}
    while ($queue.Count -gt 0) {
      $cur = $queue.Dequeue()
      if ($seen[$cur.n] -or $cur.d -gt 2) { continue }
      $seen[$cur.n] = $true
      $json = & gh api --method GET "repos/{owner}/{repo}/issues/$($cur.n)/sub_issues?per_page=100" 2>&1 | Out-String
      if ($LASTEXITCODE -ne 0) { throw "gh api sub_issues of #$($cur.n) failed" }
      foreach ($c in @($json | ConvertFrom-Json -Depth 20)) {
        if ("$($c.state)" -ne 'open') { continue }
        $lvl = Get-Prop (Get-Prop $c 'type') 'name'
        if (-not $lvl -and "$($c.title)" -match '^\[(Epic|Feature|PBI|Task|Bug)\]') { $lvl = $Matches[1] }
        if ($lvl -in 'Epic', 'Feature') { $queue.Enqueue(@{ n = [int]$c.number; d = $cur.d + 1 }) }
        elseif ($lvl -ne 'Task') { $pbis.Add($c) }
      }
    }
    if ($pbis.Count -eq 0) { Write-Host '[dry-run] No open PBIs found.'; return }
    $items = @(Get-IssueNeedsItem -Number @($pbis | ForEach-Object { [int]$_.number } | Sort-Object -Unique))
    $unplanned = [System.Collections.Generic.List[string]]::new()
    foreach ($p in @($pbis | Sort-Object { [int]$_.number })) {
      $it = $items | Where-Object { $_.number -eq [int]$p.number } | Select-Object -First 1
      $needs = Get-NeedsValue $it
      $label = $needs ? $needs : '-'
      $skip = $needs -in 'Planning', 'Decision', 'Blocked'
      if ($needs -eq 'Planning') { $unplanned.Add("#$($p.number)") }
      Write-Host "#$($p.number) $label $(Remove-ControlChar "$($p.title)")$(if ($skip) { ' (skip)' })"
    }
    Write-Host "[dry-run] Unplanned: $(if ($unplanned.Count) { $unplanned -join ', ' } else { 'none' })"
  }
  catch { Write-Host "[dry-run] Needs unavailable: $(Remove-ControlChar "$($_.Exception.Message)")" }
}

if ($PbiParallel -and -not ($Feature -or $Epic)) { throw '-PbiParallel needs -Feature or -Epic.' }
if ($Feature -or $Epic) {
  if ($Feature -and $Epic) { throw 'Pass either -Feature or -Epic, not both.' }
  if ($Issue -or $IssueFile -or $Label) { throw '-Feature/-Epic cannot be combined with issue numbers, -IssueFile or -Label.' }
  if ($PSBoundParameters.ContainsKey('Mode')) { throw '-Mode cannot be combined with -Feature/-Epic (the mode is always next).' }
  $nr = ConvertTo-IssueNumber ($Feature ? $Feature : $Epic) 'queue'
  $kind = $Feature ? 'Feature' : 'Epic'
  $inv = Get-HarnessInvocation $nr 'next' $adv
  $cmd = $inv.Cmd; $envVars = $inv.EnvVars; $envText = $inv.EnvText
  if ($DryRun) {
    Write-Host "[dry-run] ${kind} #${nr}: $envText"
    Write-DryRunNeeds $nr
    exit 0
  }
  $bin = Get-Command $cmd.Executable -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $bin) { throw "'$($cmd.Executable)' not found on PATH (harness '$Harness'). Install it or pick another -Harness." }
  if (-not $NoMerge -and -not (Get-Command gh -CommandType Application -ErrorAction SilentlyContinue)) { throw "'gh' not found on PATH (needed to merge approved PBIs; use -NoMerge to skip)." }

  Test-NotSymlink (Get-StateDir)
  New-Item -ItemType Directory -Path (Get-StateDir) -Force | Out-Null
  $queueFile = Join-Path (Get-StateDir) "queue-$nr.json"
  Test-NotSymlink $queueFile
  $log = Join-Path (Get-StateDir) "queue-$nr.log"
  Test-NotSymlink $log
  $started = Get-Date -Format o
  $pbis = [System.Collections.Generic.List[object]]::new()
  $parked = [System.Collections.Generic.List[object]]::new()
  function Save-Queue([string]$State, [int]$Code) {
    $o = [ordered]@{ queue = [long]$nr; kind = $kind; harness = $Harness; state = $State; exitCode = $Code; started = $started
      ended = (Get-Date -Format o); merge = $(if ($NoMerge) { 'off' } else { 'auto' }); mergeApproved = (-not $NoMerge); pbis = @($pbis); parked = @($parked) }
    Set-Content -LiteralPath $queueFile -Value ($o | ConvertTo-Json -Depth 6) -Encoding utf8
  }
  function Get-LastMatch([string[]]$Lines, [string]$Pattern) {
    $m = @($Lines | Select-String -CaseSensitive -Pattern $Pattern)
    if ($m.Count) { $m[-1].Matches[0] } else { $null }
  }
  $callerLedger = $env:AGENTS_LEDGER
  $exit = 0; $state = 'running'; $prev = $null
  Save-Queue $state 0
  try {
  while ($true) {
    $iterStart = Get-Date -Format o
    $gatesBefore = @{}
    $completeBefore = [System.Collections.Generic.List[string]]::new()
    foreach ($d in @(Get-ChildItem -LiteralPath (Get-StateDir) -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '\A[0-9]+\z' })) {
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
      $pbiDir = Join-Path (Get-StateDir) $pbi
      Test-NotSymlink $pbiDir
      New-Item -ItemType Directory -Path $pbiDir -Force | Out-Null
      Test-NotSymlink (Join-Path $pbiDir 'run.log')
      Add-Content -LiteralPath (Join-Path $pbiDir 'run.log') -Value (@("=== $iterStart $envText") + $out + $trailer) -Encoding utf8
      $env:AGENTS_LEDGER = Join-Path $pbiDir "progress.md"
      Invoke-NeedsSync $pbi (Join-Path $pbiDir 'run.log')
      $after = Get-LedgerLines $pbi
      $newGate = @(Get-Gates $after).Count -gt [int]$gatesBefore[$pbi]
      $gate = if ($gm) { $gm } elseif ($newGate) { @(Get-Gates $after)[-1] } else { $null }
      $lp = Get-LastMatch $after '\APhase pull-request: complete\b.*?/pull/(\d+)'
      $pr = if ($lp) { [long]$lp.Groups[1].Value } else { $null }
      $entry = [ordered]@{ number = [long]$pbi; outcome = 'failed'; pr = $pr; ledger = (Join-Path (Join-Path (Get-StateDir) $pbi) 'progress.md'); gate = $gate; started = $iterStart; ended = $null; note = $null }
      if (@($parked | Where-Object { "$($_.number)" -eq $pbi }).Count) { $entry.note = 'parked PBI selected again (needs-decision label missing?)'; $stop = $true; $exit = 1 }
      elseif ($prev -eq $pbi) { $entry.note = 'selected twice in a row without progress; stopped'; $stop = $true; $exit = 1 }
      elseif (Test-Complete $after) { $entry.outcome = if ($completeBefore -contains $pbi) { 'skipped' } else { 'done' }; $entry.gate = $null }
      elseif ($gate) {
        # park instead of stopping: label, comment, lease release (-Keep), attention; the exit 2 is deferred to the end of the queue
        $entry.outcome = 'parked'
        $question = ($gate -creplace ($GatePattern + '[\s*`_]*'), '').Trim()
        $entry.note = Invoke-ParkGate $pbi $question (Join-Path $pbiDir 'run.log')
        $parked.Add([pscustomobject][ordered]@{ number = [long]$pbi; question = $question })
      }
      else { $entry.note = "run ended without 'Ledger complete.' (exit code $code)" }
      if ($entry.outcome -eq 'done') {
        if ($code -ne 0) { $entry.note = "not merged: child exit code $code" }
        else {
          $mr = Invoke-MergeApproved $pbi $entry.ledger (Join-Path $pbiDir 'run.log')
          if ($mr.Merged) { $entry.outcome = 'merged' }
          elseif ($mr.Failed -and -not $NoMerge) { $entry.outcome = 'failed'; $entry.note = $mr.Note; $stop = $true; $exit = 1 }
          else { $entry.note = $mr.Note }
        }
      }
      Invoke-NeedsSync $pbi (Join-Path $pbiDir 'run.log')
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
    # deferred exit: an earlier failed PBI (-ContinueOnError) wins with 1, else parked PBIs give 2; from the lists, never from the last entry
    if ($stop -and ($exit -in @(0, 3))) {
      if (@($pbis | Where-Object { $_.outcome -eq 'failed' }).Count) { $exit = 1 }
      elseif ($parked.Count -gt 0) { $exit = 2 }
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
  foreach ($e in $pbis) {
    if ($e.outcome -eq 'parked') { $pq = @($parked | Where-Object { "$($_.number)" -eq "$($e.number)" })[0].question; Write-Host "#$($e.number) parked - $(Remove-ControlChar $pq)$(if ($e.note) { " ($($e.note))" })"; continue }
    Write-Host "$(if ($e.number) { "#$($e.number)" } else { '-' }) $($e.outcome)$(if ($e.pr) { " (PR #$($e.pr))" })$(if ($e.note) { " - $($e.note)" })"
  }
  if ($exit -eq 2 -and $pbis.Count -and $pbis[-1].outcome -eq 'gate') { Write-Host "Gate on ${kind} #${nr}, queue stopped (answer it, then run the queue again): $($pbis[-1].gate)" }
  if ($parked.Count -gt 0) { Write-Host "Parked in ${kind} #${nr}: answer with /ruling <option> on each PBI, then run the queue again" }
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
  Test-NotSymlink (Get-StateDir)
}
# Run directory per issue: Enter-Checkout.ps1 / Exit-Checkout.ps1 of the github package (installed beside this skill, or the repository layout).
function Get-CheckoutScript([string]$Name) {
  foreach ($d in @((Join-Path $PSScriptRoot '../../github-issue/scripts'), (Join-Path $PSScriptRoot '../../../../../github/.apm/skills/github-issue/scripts'))) {
    $f = Join-Path $d $Name
    if (Test-Path -LiteralPath $f -PathType Leaf) { return (Resolve-Path -LiteralPath $f).Path }
  }
  throw "$Name not found (install the github package beside the delivery package)."
}
$useCheckout = $false
$checkoutBase = $Base
if (-not $DryRun) {
  & git rev-parse --git-common-dir *> $null
  $useCheckout = $LASTEXITCODE -eq 0
}
if ($useCheckout -and -not $checkoutBase) {
  & git rev-parse --verify --quiet refs/remotes/origin/release/next *> $null
  if ($LASTEXITCODE -eq 0) { $checkoutBase = 'release/next' }
  else {
    $head = "$(& git symbolic-ref --short refs/remotes/origin/HEAD 2>$null)".Trim() -replace '\Aorigin/', ''
    $checkoutBase = if ($LASTEXITCODE -eq 0 -and $head) { $head } else { 'main' }
  }
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
  $dir = Join-Path (Get-StateDir) $n
  Test-NotSymlink $dir
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  $log = Join-Path $dir 'run.log'
  Test-NotSymlink $log
  $workDir = (Get-Location).Path
  if ($useCheckout) {
    try {
      $co = & (Get-CheckoutScript 'Enter-Checkout.ps1') -Issue $n -Branch "feat/$n" -Base $checkoutBase | Select-Object -Last 1 | ConvertFrom-Json
      $workDir = "$($co.path)"
      Write-Host "[checkout] #${n}: $workDir$(if ($co.worktree) { ' (worktree)' })"
    } catch {
      Write-Host "Checkout for #${n} failed: $($_.Exception.Message)"
      $results[$n] = 'failed'
      if ($exit -eq 0) { $exit = 1 }
      if (-not $ContinueOnError) { $stopped = $true }
      continue
    }
  }
  Write-Host "[run] #${n}: $envText"
  Add-Content -LiteralPath $log -Value "=== $(Get-Date -Format o) $envText" -Encoding utf8
  $saved = @{}
  foreach ($k in $envVars.Keys) { $saved[$k] = [Environment]::GetEnvironmentVariable($k); [Environment]::SetEnvironmentVariable($k, [string]$envVars[$k]) }
  # a relative DROMOS_STATE_DIR would resolve against the worktree: hand the child the resolved directory
  $savedState = $env:DROMOS_STATE_DIR
  if ($savedState) { $env:DROMOS_STATE_DIR = Get-StateDir }
  Push-Location -LiteralPath $workDir
  try { & $bin.Source @($cmd.Arguments) 2>&1 | Tee-Object -FilePath $log -Append | Out-Host; $code = $LASTEXITCODE }
  finally { Pop-Location; $env:DROMOS_STATE_DIR = $savedState; foreach ($k in $saved.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k]) } }
  Add-Content -LiteralPath $log -Value "=== exit code $code" -Encoding utf8
  $after = Get-LedgerLines $n
  $gates = @(Get-Gates $after)
  if (Test-Complete $after) { $results[$n] = 'done' }
  elseif ($gates.Count -gt $gatesBefore) {
    $results[$n] = 'gate'
    Write-Host "Gate on #${n}, queue stopped (answer it, then run the queue again): $($gates[-1])"
    if ($useCheckout) { Write-Host "Checkout of #${n} kept for the answer: $workDir" }
    $exit = 2; $stopped = $true
  } else {
    $results[$n] = 'failed'
    if ($exit -eq 0) { $exit = 1 }
    if (-not $ContinueOnError) { $stopped = $true }
  }
  if ($useCheckout -and $results[$n] -ne 'gate') {
    try {
      $rel = & (Get-CheckoutScript 'Exit-Checkout.ps1') -Issue $n | Select-Object -Last 1 | ConvertFrom-Json
      if ($rel.kept) { Write-Host "Worktree of #${n} has local changes and was kept: $($rel.kept)" }
    } catch { Write-Host "Releasing the checkout of #${n} failed: $($_.Exception.Message)" }
  }
}
foreach ($k in $results.Keys) { Write-Host "#$k $($results[$k])" }
exit $exit
