#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Squash-merges the approved PR of a PBI into its release/* integration branch, or says why not; prints one line: 'merged <sha>' or 'skipped: <reason>'.
.DESCRIPTION
  Fail closed: merges only when every precondition holds, in this order: review.json next to the ledger has verdict exactly 'APPROVE' and
  incomplete exactly false; the ledger names the reviewed commit (last 'Phase review: complete - <sha>') and the PR (last
  'Phase pull-request: complete - <url>'); that PR is open and its head contains '/<pbi>-'; state OPEN; head not release/*; base release/*;
  not cross-repository; head commit known and equal to the reviewed commit;
  mergeable MERGEABLE and mergeStateStatus CLEAN (UNKNOWN is polled up to 3 times, QUEUE_POLL_SECONDS between polls, default 5);
  checks present and all green; head commit equal to the local branch tip, else to the tip on origin. Then
  'gh pr merge <n> --squash --match-head-commit <oid>' and 'merged <merge commit>' (the head commit when GitHub reports none yet).
  Not merged ('skipped: <reason>', also -NoMerge): label 'needs-review' on the PBI issue and one comment 'Merge skipped: <reason> — <pr url>'
  (not repeated when the newest comment is the same). Merged: the label is removed when set. Label and comment failures go to stderr only.
  Exit 0 for merged and skipped; 1 when 'gh pr merge' fails or gh/git is missing.
.PARAMETER Issue   PBI number.
.PARAMETER Ledger  The PBI ledger <state>/<pbi>/progress.md; review.json is read from its directory.
.PARAMETER WhatIf  Print the line it would print ('merged <head commit>' when it would merge); no merge, no label, no comment.
.PARAMETER NoMerge Never merge: prints 'skipped: merge disabled (--no-merge)' and labels.
#>
[CmdletBinding()]
param(
  [string]$Issue,
  [string]$Ledger,
  [switch]$WhatIf,
  [switch]$NoMerge
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($Issue -notmatch '\A[0-9]{1,10}\z') { throw "Invalid -Issue '$Issue': expected the PBI number." }
if (-not $Ledger) { throw 'Missing -Ledger: expected <state>/<pbi>/progress.md.' }
foreach ($t in 'gh', 'git') {
  if (-not (Get-Command $t -CommandType Application -ErrorAction SilentlyContinue)) {
    Write-Error -Message "'$t' not found on PATH (needed by Merge-ApprovedPr.ps1)." -ErrorAction Continue
    exit 1
  }
}

# text from GitHub or the ledger is data: no control characters, no '@' mention in the comment
function Get-PlainText([string]$t) { (($t -replace '[\p{Cc}\p{Cf}]+', ' ') -replace '\s+', ' ').Trim() }
function Write-Warn([string]$m) { Write-Error -Message $m -ErrorAction Continue }
function Get-LastMatch([string[]]$Lines, [string]$Pattern) {
  $m = @($Lines | Select-String -CaseSensitive -Pattern $Pattern)
  if ($m.Count) { $m[-1].Matches[0] } else { $null }
}
# right after PR creation GitHub may still compute mergeability (UNKNOWN): poll a bounded number of times.
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
# The PBI's open PR: from the ledger line 'Phase pull-request: complete - <url>' and 'gh pr list', never from free text.
# The ledger must name the PR: a PR found by its branch name alone is never merged.
function Resolve-PbiPr([string]$Pbi, [string[]]$LedgerLines) {
  $lm = Get-LastMatch $LedgerLines '\APhase pull-request: complete\b.*?/pull/(\d+)'
  if (-not $lm) { return @{ Pr = $null; Note = 'no PR in the ledger (Phase pull-request: complete)' } }
  $ledgerPr = [long]$lm.Groups[1].Value
  $json = & gh pr list --state open --limit 100 --json number,url,state,headRefName,baseRefName,headRefOid,isCrossRepository,mergeable,mergeStateStatus,statusCheckRollup 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { return @{ Pr = $null; Note = 'gh pr list failed' } }
  try { $all = @($json | ConvertFrom-Json) } catch { return @{ Pr = $null; Note = 'gh pr list returned no JSON' } }
  $mine = @($all | Where-Object { $_ -and $_.PSObject.Properties['headRefName'] -and $_.headRefName -match "(\A|/)$Pbi-" })
  $pick = @($mine | Where-Object { $_.number -eq $ledgerPr })
  if ($pick.Count -ne 1) { return @{ Pr = $null; Note = "no single open PR of PBI #$Pbi found (ledger PR: #$ledgerPr)" } }
  @{ Pr = $pick[0]; Note = $null }
}
function Get-Field($O, [string]$Name) { if ($O -and $O.PSObject.Properties[$Name]) { $O.$Name } else { $null } }

$lines = @()
# the optional ISO-8601 UTC prefix of a ledger line ('2026-10-21T15:19:46Z <text>') is dropped: older ledgers have none
if (Test-Path -LiteralPath $Ledger -PathType Leaf) { $lines = @(Get-Content -LiteralPath $Ledger | ForEach-Object { $_ -replace '\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z ', '' }) }
# the approval in review.json belongs to the commit of the last review line; a later push is not reviewed
$rm = Get-LastMatch $lines '\APhase review: complete\W+([0-9a-f]{7,64})\b'
$reviewed = if ($rm) { $rm.Groups[1].Value } else { $null }
$um = Get-LastMatch $lines '\APhase pull-request: complete\b.*?(https://\S+/pull/\d+)'
$prUrl = if ($um) { $um.Groups[1].Value } else { $null }

$why = $null; $p = $null
if ($NoMerge) { $why = 'merge disabled (--no-merge)' }
else {
  $reviewFile = Join-Path (Split-Path -Parent $Ledger) 'review.json'
  $review = $null
  try { $review = Get-Content -LiteralPath $reviewFile -Raw -ErrorAction Stop | ConvertFrom-Json } catch { $review = $null }
  $verdict = Get-Field $review 'verdict'
  $incomplete = Get-Field $review 'incomplete'
  if (-not $review) { $why = 'no review.json' }
  elseif (-not ($verdict -is [string] -and $verdict -ceq 'APPROVE')) { $why = "verdict is not a plain APPROVE ($verdict)" }
  elseif (-not ($incomplete -is [bool] -and $incomplete -eq $false)) { $why = 'review is incomplete' }
  elseif (-not $reviewed) { $why = 'no reviewed commit in the ledger (Phase review: complete)' }
}
if (-not $why) {
  $res = Resolve-PbiPr $Issue $lines
  $p = $res.Pr
  if ($p) {
    foreach ($f in 'number', 'url', 'state', 'headRefName', 'baseRefName', 'headRefOid', 'isCrossRepository', 'mergeable', 'mergeStateStatus', 'statusCheckRollup') {
      if (-not $p.PSObject.Properties[$f]) { $p | Add-Member -NotePropertyName $f -NotePropertyValue $null }
    }
    if ($p.url) { $prUrl = "$($p.url)" }
    if ($p.mergeable -eq 'UNKNOWN' -or $p.mergeStateStatus -eq 'UNKNOWN') { $p = Wait-PrState $p }
  }
  $n = if ($p) { "PR #$($p.number)" } else { $null }
  if (-not $p) { $why = $res.Note }
  elseif ($p.state -ne 'OPEN') { $why = "${n}: state $($p.state)" }
  elseif ($p.headRefName -match '\Arelease/') { $why = "${n}: release PR" }
  elseif ($p.baseRefName -notmatch '\Arelease/') { $why = "${n}: base $($p.baseRefName) is not the integration branch (release/*)" }
  elseif ($p.isCrossRepository -ne $false -or $p.headRefName -match ':') { $why = "${n}: fork or cross-repository PR" }
  elseif (-not $p.headRefOid) { $why = "${n}: head commit unknown" }
  elseif (-not "$($p.headRefOid)".StartsWith($reviewed, [StringComparison]::Ordinal)) { $why = "${n}: head $($p.headRefOid) is not the reviewed commit $reviewed" }
  elseif ($p.mergeable -eq 'UNKNOWN' -or $p.mergeStateStatus -eq 'UNKNOWN') { $why = "${n}: mergeability still UNKNOWN after 3 polls" }
  elseif ($p.mergeable -ne 'MERGEABLE' -or $p.mergeStateStatus -ne 'CLEAN') { $why = "${n}: not mergeable/clean ($($p.mergeable)/$($p.mergeStateStatus))" }
  elseif (-not $p.statusCheckRollup -or @($p.statusCheckRollup).Count -eq 0) { $why = "${n}: no checks reported" }
  elseif (@($p.statusCheckRollup | Where-Object { $_ -and -not (((Get-Field $_ 'conclusion') -in 'SUCCESS', 'NEUTRAL', 'SKIPPED') -or ((Get-Field $_ 'state') -eq 'SUCCESS')) }).Count) { $why = "${n}: checks are not green" }
  else {
    # The reviewed commit is not recorded by the orchestrator: compare with the local branch tip when it exists,
    # otherwise with the tip of the branch on origin. Not verifiable -> no merge.
    $tip = (& git rev-parse --verify --quiet "refs/heads/$($p.headRefName)" 2>$null)
    if ($LASTEXITCODE -eq 0 -and $tip) { $where = 'local branch'; $tip = "$tip".Trim() }
    else {
      $where = 'origin branch'
      $rl = @(& git ls-remote origin "refs/heads/$($p.headRefName)" 2>$null)
      $tip = if ($LASTEXITCODE -eq 0 -and $rl.Count -eq 1 -and "$($rl[0])" -match '\A([0-9a-f]{40,64})\s') { $Matches[1] } else { $null }
    }
    if (-not $tip) { $why = "${n}: head $($p.headRefOid) cannot be verified (no local branch, not found on origin)" }
    elseif ($tip -ne $p.headRefOid) { $why = "${n}: head $($p.headRefOid) differs from $where tip $tip" }
  }
}

if ($why) {
  $why = Get-PlainText $why
  "skipped: $why"
  if ($WhatIf) { exit 0 }
  try { & gh issue edit $Issue --add-label needs-review *> $null; if ($LASTEXITCODE -ne 0) { throw 'gh' } } catch { Write-Warn "Merge-ApprovedPr: could not add label needs-review to #$Issue" }
  $body = "Merge skipped: $why — $(if ($prUrl) { Get-PlainText $prUrl } else { 'no PR' })" -replace '@(?=[A-Za-z0-9])', "@$([char]0x200B)"
  try {
    $last = "$(& gh issue view $Issue --json comments 2>$null | Out-String)"
    $newest = $null
    if ($LASTEXITCODE -eq 0) { try { $c = @(($last | ConvertFrom-Json).comments); if ($c.Count) { $newest = "$($c[-1].body)".Trim() } } catch { $newest = $null } }
    if ($newest -cne $body) {
      $tmp = Join-Path ([IO.Path]::GetTempPath()) ("merge-skipped-$([guid]::NewGuid().ToString('N')).md")
      try {
        [IO.File]::WriteAllText($tmp, $body, [Text.UTF8Encoding]::new($false))
        & gh issue comment $Issue --body-file $tmp *> $null
        if ($LASTEXITCODE -ne 0) { throw 'gh' }
      } finally { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
    }
  } catch { Write-Warn "Merge-ApprovedPr: could not comment on #$Issue" }
  exit 0
}

if ($WhatIf) { "merged $($p.headRefOid)"; exit 0 }
& gh pr merge "$($p.number)" --squash --match-head-commit $p.headRefOid *> $null
if ($LASTEXITCODE -ne 0) { Write-Warn "Merge-ApprovedPr: gh pr merge #$($p.number) failed"; exit 1 }
$sha = $null
$mj = & gh pr view "$($p.number)" --json mergeCommit 2>$null | Out-String
if ($LASTEXITCODE -eq 0) { try { $sha = Get-Field (Get-Field ($mj | ConvertFrom-Json) 'mergeCommit') 'oid' } catch { $sha = $null } }
if (-not ("$sha" -match '\A[0-9a-f]{40,64}\z')) { $sha = $p.headRefOid }
"merged $sha"
try {
  $lj = & gh issue view $Issue --json labels 2>$null | Out-String
  if ($LASTEXITCODE -ne 0) { throw 'gh' }
  if (@(($lj | ConvertFrom-Json).labels | Where-Object { $_.name -eq 'needs-review' }).Count) {
    & gh issue edit $Issue --remove-label needs-review *> $null
    if ($LASTEXITCODE -ne 0) { throw 'gh' }
  }
} catch { Write-Warn "Merge-ApprovedPr: could not remove label needs-review from #$Issue" }
exit 0
