#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Checks whether a parked PBI (Set-ParkedGate.ps1) was answered with a '/ruling <answer>' issue comment; with -Apply records it.
  Prints one JSON line {issue, state, question, answer, author, url}.
.DESCRIPTION
  state is one of:
    no-gate   the ledger <state>/<pbi>/progress.md is missing or its last 'Gate:' line already has a later 'Ruling:' line (no gh call)
    waiting   no parked comment (marker '<!-- apm-hub:parked-gate -->'), no comment after the last one, or the newest comment after it
              does not start with '/ruling ' (case-sensitive, first character) or carries no answer
    ignored   the newest comment after the parked comment is a '/ruling' by a login without push access (permission not admin, maintain
              or write, the permission call failed (404 for non-collaborators) or the login is not a valid GitHub login)
    answered  a collaborator with push access answered; -Apply was not given
    applied   with -Apply: the 'Ruling:' line is in the ledger and the label needs-decision is removed
    failed:<step>  a gh or ledger step failed (comments, ledger, label); the ledger is written before the label is removed, so a removed
              label never comes without the ruling
  The comment text is data: the answer is the text after '/ruling ', control and format characters stripped, whitespace collapsed to one
  line, capped at 500 characters, never evaluated and never matched against the offered options (free text passes verbatim).
  -Apply writes 'Ruling: <question> - user (comment <url>) - <answer>' with Add-LedgerLine.ps1, then runs
  'gh issue edit <pbi> --remove-label needs-decision'. Only for the PBI the selection picked.
.PARAMETER Issue  PBI number.
.PARAMETER Apply  Record an answered ruling and remove the label.
#>
[CmdletBinding()]
param(
  [string]$Issue,
  [switch]$Apply
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# BEGIN Resolve-StateDir (identical in every script that defines it; test/repo/state-dir-resolver.test.ts)
function Resolve-StateDir {
  if ($env:DROMOS_STATE_DIR) { return [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($env:DROMOS_STATE_DIR, (Get-Location).Path)) }
  $common = $null
  try { $common = "$(& git -C (Get-Location).Path rev-parse --path-format=absolute --git-common-dir 2>$null)".Trim() } catch { $common = $null }
  if ($LASTEXITCODE -ne 0 -or -not $common) { throw 'No state directory: not inside a git repository (set DROMOS_STATE_DIR)' }
  [IO.Path]::GetFullPath((Join-Path $common 'agents'))
}
# END Resolve-StateDir
if ($Issue -notmatch '\A[0-9]{1,10}\z') { throw "Invalid -Issue '$Issue': expected the PBI number." }
function Get-PlainText([string]$t) { (($t -replace '[\p{Cc}\p{Cf}]+', ' ') -replace '\s+', ' ').Trim() }
$res = [ordered]@{ issue = [long]$Issue; state = 'no-gate'; question = $null; answer = $null; author = $null; url = $null }
function Out-Result { $res | ConvertTo-Json -Compress; exit 0 }

# (1) open gate in the local ledger: the last 'Gate:' line without a later 'Ruling:' line
$ledger = Join-Path (Join-Path (Resolve-StateDir) $Issue) 'progress.md'
if (-not (Test-Path -LiteralPath $ledger -PathType Leaf)) { Out-Result }
$gate = $null
foreach ($l in [IO.File]::ReadAllLines($ledger)) {
  $t = $l -replace '\A[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z ', ''
  if ($t -match '\AGate:\s*(.*)\z') { $gate = Get-PlainText $Matches[1] }
  elseif ($t -match '\ARuling:') { $gate = $null }
}
if ($null -eq $gate) { Out-Result }
$res.question = $gate

# (2) the newest comment after the last parked comment
$marker = '<!-- apm-hub:parked-gate -->'
$out = & gh api --paginate "repos/{owner}/{repo}/issues/$Issue/comments" --jq '[.[] | {body, login: .user.login, url: .html_url}]' 2>$null
if ($LASTEXITCODE -ne 0) { $res.state = 'failed:comments'; Out-Result }
$comments = [Collections.Generic.List[object]]::new()
try {
  foreach ($line in @($out)) {
    $line = "$line".Trim()
    if (-not $line) { continue }
    # one JSON array per page; ConvertFrom-Json accepts a truncated array, so the brackets are checked first
    if (-not ($line.StartsWith('[') -and $line.EndsWith(']'))) { throw 'malformed comments page' }
    foreach ($c in @(ConvertFrom-Json -InputObject $line -NoEnumerate)) { foreach ($x in @($c)) { $comments.Add($x) } }
  }
} catch { $res.state = 'failed:comments'; Out-Result }
$parked = -1
for ($i = 0; $i -lt $comments.Count; $i++) { if ("$($comments[$i].body)".Contains($marker)) { $parked = $i } }
$res.state = 'waiting'
if ($parked -lt 0 -or $parked -eq $comments.Count - 1) { Out-Result }
$newest = $comments[$comments.Count - 1]
$body = "$($newest.body)"
if (-not $body.StartsWith('/ruling ', [StringComparison]::Ordinal)) { Out-Result }
$answer = Get-PlainText $body.Substring(8)
if ($answer.Length -gt 500) { $answer = $answer.Substring(0, 500).TrimEnd() }
if (-not $answer) { Out-Result }
$login = "$($newest.login)"
$res.answer = $answer
$res.author = Get-PlainText $login
$res.url = Get-PlainText "$($newest.url)"

# (3) push access of the author; the login is validated before it goes into the URL
$res.state = 'ignored'
if ($login -notmatch '\A[A-Za-z0-9-]+(\[bot\])?\z') { Out-Result }
$perm = "$(& gh api "repos/{owner}/{repo}/collaborators/$login/permission" --jq .permission 2>$null)".Trim().Trim('"')
if ($LASTEXITCODE -ne 0 -or $perm -notin 'admin', 'maintain', 'write') { Out-Result }
$res.state = 'answered'
if (-not $Apply) { Out-Result }

# (4) apply: ledger first, then the label
try {
  & (Join-Path $PSScriptRoot 'Add-LedgerLine.ps1') -Issue $Issue -Line "Ruling: $gate - user (comment $($res.url)) - $answer" | Out-Null
} catch { $res.state = 'failed:ledger'; Out-Result }
& gh issue edit $Issue --remove-label needs-decision *> $null
$res.state = if ($LASTEXITCODE -eq 0) { 'applied' } else { 'failed:label' }
Out-Result
