#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Parks a PBI at a headless gate: label, comment, loop ledger line, lease release (-Keep), attention event; prints {parked, label, comment, ledger, checkout} as JSON.
.DESCRIPTION
  In this order: (1) 'gh issue edit <pbi> --add-label needs-decision'; (2) 'gh issue comment' rendered from templates/parked-gate.md through a body file
  (question and options are data: control characters are stripped, '@' mentions neutralized, the question is quoted), skipped when the newest comment already carries the marker and the same question;
  (3) with -Loop the ledger line 'Loop: PBI #<pbi> parked - <question>' in loop-<nr>; (4) Exit-Checkout.ps1 -Issue <pbi> -Keep; (5) with DROMOS_URL set an
  'attention' event to $DROMOS_URL/ingest (https, http only to loopback, no credentials, 500 ms timeout, failures ignored).
  A failing step is reported in the JSON ('failed:<step>') and the remaining steps still run, so the lease is always freed. Never writes the 'Gate:' line (the caller did).
.PARAMETER Issue     PBI number.
.PARAMETER Question  The gate question.
.PARAMETER Option    Answer options: an array in-process, or one string with options separated by '|' (works with pwsh -File).
.PARAMETER Loop      Loop number for the loop ledger.
.PARAMETER Checkout  Kept checkout path shown in the comment; default: the path of the lease of -Issue, else the current directory.
#>
[CmdletBinding()]
param(
  [string]$Issue,
  [string]$Question,
  [string[]]$Option = @(),
  [string]$Loop,
  [string]$Checkout
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
if ($Loop -and $Loop -notmatch '\A[0-9]{1,10}\z') { throw "Invalid -Loop '$Loop': expected the loop number." }
function Get-PlainText([string]$t) { (($t -replace '[\p{Cc}\p{Cf}]+', ' ') -replace '\s+', ' ').Trim() }
$q = Get-PlainText $Question
$opts = @($Option | ForEach-Object { $_ -split '\|' } | ForEach-Object { Get-PlainText $_ } | Where-Object { $_ })
$res = [ordered]@{ parked = $true; label = 'ok'; comment = 'ok'; ledger = 'skipped'; checkout = $null }
$state = Resolve-StateDir
if (-not $Checkout) {
  $leases = Join-Path $state 'leases'
  if (Test-Path -LiteralPath $leases -PathType Container) {
    foreach ($f in Get-ChildItem -LiteralPath $leases -Filter '*.json' -File) {
      try { $o = Get-Content -LiteralPath $f.FullName -Raw | ConvertFrom-Json; if ("$($o.issue)" -eq $Issue) { $Checkout = "$($o.path)" } } catch { $null }
    }
  }
}
if (-not $Checkout) { $Checkout = (Get-Location).Path }
$Checkout = Get-PlainText $Checkout

# (1) label
try { & gh issue edit $Issue --add-label needs-decision *> $null; if ($LASTEXITCODE -ne 0) { throw 'gh' } } catch { $res.label = 'failed' }

# (2) comment, once per question
$marker = '<!-- apm-hub:parked-gate -->'
# comment text is data, never a command or a ping: '@name' gets a zero-width space after the '@' (no mention); the template quotes the
# question and every option is a list item, so no line of the comment starts with '/ruling' from the gate text
function Get-CommentText([string]$t) { $t -replace '@(?=[A-Za-z0-9])', "@$([char]0x200B)" }
$qc = Get-CommentText $q
try {
  $last = "$(& gh issue view $Issue --json comments --jq '.comments[-1].body // empty' 2>$null)"
  if ($LASTEXITCODE -ne 0) { $last = '' }
  if ($last.Contains($marker) -and $last.Contains($qc)) { $res.comment = 'exists' }
  else {
    $tpl = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../templates/parked-gate.md') -Raw
    $list = if ($opts.Count) { ($opts | ForEach-Object { "- $(Get-CommentText $_)" }) -join "`n" } else { '- (free text)' }
    $body = $tpl.Replace('{{question}}', '{{Q}}').Replace('{{options}}', '{{O}}').Replace('{{checkout}}', '{{C}}').Replace('{{pbi}}', $Issue)
    $body = $body.Replace('{{Q}}', $qc).Replace('{{O}}', $list).Replace('{{C}}', $Checkout)
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("parked-gate-$([guid]::NewGuid().ToString('N')).md")
    try {
      [IO.File]::WriteAllText($tmp, $body, [Text.UTF8Encoding]::new($false))
      & gh issue comment $Issue --body-file $tmp *> $null
      if ($LASTEXITCODE -ne 0) { throw 'gh' }
    } finally { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
  }
} catch { $res.comment = 'failed' }

# (3) loop ledger
if ($Loop) {
  try { & (Join-Path $PSScriptRoot 'Add-LedgerLine.ps1') -Issue "loop-$Loop" -Line "Loop: PBI #$Issue parked — $q" | Out-Null; $res.ledger = 'ok' } catch { $res.ledger = 'failed' }
}

# (4) free the lease, keep the worktree
try {
  $ex = & (Join-Path $PSScriptRoot 'Exit-Checkout.ps1') -Issue $Issue -Keep | Select-Object -Last 1 | ConvertFrom-Json
  $res.checkout = if ($ex.kept) { $ex.kept } else { $ex.path }
} catch { $res.checkout = 'failed' }

# (5) attention event, never affects the result
try {
  $u = "$env:DROMOS_URL"
  $ok = $false
  if ($u -match '\Ahttps?://[^\s]+\z') {
    $auth = ($u -replace '\A[^:]+://', '') -split '[/?#]' | Select-Object -First 1
    if ($auth -and $auth -notmatch '@') {
      if ($u.StartsWith('https://')) { $ok = $true }
      else { $h = if ($auth.StartsWith('[')) { ($auth -split '\]')[0] + ']' } else { $auth -replace ':[0-9]*\z', '' }; $ok = $h -in 'localhost', '127.0.0.1', '[::1]' }
    }
  }
  if ($ok) {
    $payload = [ordered]@{ type = 'attention'; source = 'apm-hub/parked-gate'; issue = [int]$Issue
      data = [ordered]@{ kind = 'GATE'; question = $q; options = $opts; checkout = $Checkout } } | ConvertTo-Json -Depth 5 -Compress
    $http = [Net.Http.HttpClient]::new()
    try {
      $http.Timeout = [TimeSpan]::FromMilliseconds(500)
      $content = [Net.Http.StringContent]::new($payload, [Text.UTF8Encoding]::new($false), 'application/json')
      $http.PostAsync(($u.TrimEnd('/') + '/ingest'), $content).GetAwaiter().GetResult() | Out-Null
    } finally { $http.Dispose() }
  }
} catch { $null }

$res | ConvertTo-Json -Compress
