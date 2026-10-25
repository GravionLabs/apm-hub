#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Computes the project field Needs of open issues from GitHub state (labels, sub-issues, blocked-by links, pull requests, Status).
.DESCRIPTION
  1. Resolves the project: -Owner/-Number, else .agents/project.json {owner, number} at the repository root, else
     'project-url: https://github.com/(users|orgs)/<owner>/projects/<n>' in .github/workflows/add-to-project.yml (or .yaml).
     None found: prints 'Needs sync skipped: no project configured' and exits 0.
  2. A pure function (Get-NeedsValue) computes the value per item, first match wins:
       closed -> clear; label needs-decision -> Decision; label needs-review -> Review; open blocked-by -> Blocked;
       label merged or Status 'In release' -> Release review; open PR whose head ref matches (^|/)<nr>- or Status 'In Progress' -> In progress;
       Epic without Feature, Feature without PBI, PBI without Task sub-issues and without label planned -> Planning;
       else Ready for PBI-level items (PBI, Bug, Task, unknown level) and clear for Epics and Features.
  3. Get-NeedsPlan returns one action {issue, item, from, to} per item whose current Needs differs; unchanged items yield none.
  Only the offline path exists so far: -StateFile never calls gh; without it the script stops after the project lookup.
  State file: {owner, number, projectId, needsField:{id, options:{name:id}},
               items:[{itemId, repo, number, state, level, labels[], status, needs, blockedByOpen, subIssueLevels[], prHeads[], parent}]}
  parent is a number (same repository), 'owner/repo#n' or {repo, number}.
.PARAMETER Owner            User or organization login of the project (wins over the lookup).
.PARAMETER Number           Project number (wins over the lookup).
.PARAMETER Repo             Only items of this repository (owner/repo).
.PARAMETER Issue            Only these issues: 12,13 or owner/repo#12 (list or comma separated).
.PARAMETER IncludeParents   Also sync the parent of every selected -Issue item.
.PARAMETER DryRun           Print the actions, change nothing.
.PARAMETER StateFile        JSON state instead of reading from GitHub (no gh call).
.PARAMETER Json             Emit {project, actions, skipped} as JSON instead of text.
#>
[CmdletBinding()]
param(
  [string]$Owner,
  [int]$Number,
  [string]$Repo,
  [string[]]$Issue,
  [switch]$IncludeParents,
  [switch]$DryRun,
  [string]$StateFile,
  [switch]$Json
)
# No Mandatory: a headless run must exit non-zero with a message instead of prompting.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:Usage = 'Usage: Sync-ProjectNeeds.ps1 [-Owner <login> -Number <n>] [-Repo owner/repo] [-Issue 12,13|owner/repo#12] [-IncludeParents] [-DryRun] [-StateFile <json>] [-Json]'

# Property of an object or hashtable-like value, $null when absent (StrictMode safe).
function Get-Prop($Obj, [string]$Name) {
  if ($null -eq $Obj) { return $null }
  $p = $Obj.PSObject.Properties[$Name]
  if ($p) { $p.Value } else { $null }
}

function Resolve-ProjectRef {
  param([string]$Owner, [int]$Number, [string]$Root)
  if ($Owner -and $Number -gt 0) { return @{ owner = $Owner; number = $Number } }
  $cfg = Join-Path $Root '.agents/project.json'
  if (Test-Path -LiteralPath $cfg -PathType Leaf) {
    try { $j = Get-Content -LiteralPath $cfg -Raw | ConvertFrom-Json } catch { $j = $null }
    $o = Get-Prop $j 'owner'; $n = Get-Prop $j 'number'
    if ($o -and $n) { return @{ owner = "$o"; number = [int]$n } }
  }
  foreach ($name in 'add-to-project.yml', 'add-to-project.yaml') {
    $wf = Join-Path $Root ".github/workflows/$name"
    if (-not (Test-Path -LiteralPath $wf -PathType Leaf)) { continue }
    $m = [regex]::Match((Get-Content -LiteralPath $wf -Raw), 'project-url:\s*["'']?https://github\.com/(?:users|orgs)/([^/\s"'']+)/projects/(\d+)')
    if ($m.Success) { return @{ owner = $m.Groups[1].Value; number = [int]$m.Groups[2].Value } }
  }
  $null
}

# Pure rule function: Needs option name, or $null to clear the field.
function Get-NeedsValue($Item) {
  if ("$(Get-Prop $Item 'state')".ToUpperInvariant() -eq 'CLOSED') { return $null }
  $labels = @(Get-Prop $Item 'labels' | ForEach-Object { "$_".ToLowerInvariant() })
  $status = "$(Get-Prop $Item 'status')"
  if ($labels -contains 'needs-decision') { return 'Decision' }
  if ($labels -contains 'needs-review') { return 'Review' }
  $blocked = Get-Prop $Item 'blockedByOpen'
  if ($blocked -is [bool] ? $blocked : ([int]("0$blocked") -gt 0)) { return 'Blocked' }
  if ($labels -contains 'merged' -or $status -eq 'In release') { return 'Release review' }
  $nr = [int](Get-Prop $Item 'number')
  $heads = @(Get-Prop $Item 'prHeads' | Where-Object { $_ })
  if ($status -eq 'In Progress' -or @($heads | Where-Object { "$_" -match "(^|/)$nr-" }).Count -gt 0) { return 'In progress' }
  $level = "$(Get-Prop $Item 'level')"
  $subs = @(Get-Prop $Item 'subIssueLevels' | ForEach-Object { "$_" })
  switch ($level) {
    'Epic' { if ($subs -notcontains 'Feature') { return 'Planning' }; return $null }
    'Feature' { if ($subs -notcontains 'PBI') { return 'Planning' }; return $null }
    default { if ($subs -notcontains 'Task' -and $labels -notcontains 'planned') { return 'Planning' }; return 'Ready' }
  }
}

# 'owner/repo#n' / number / {repo, number} -> @{ repo; number } ($repo may be $null for a bare number).
function ConvertTo-IssueRef($Value, [string]$DefaultRepo) {
  if ($null -eq $Value -or "$Value" -eq '') { return $null }
  $repo = Get-Prop $Value 'repo'; $num = Get-Prop $Value 'number'
  if ($null -ne $num) { return @{ repo = $(if ($repo) { "$repo" } else { $DefaultRepo }); number = [int]$num } }
  $s = "$Value".Trim()
  if ($s -match '^([^#\s]+)#(\d+)$') { return @{ repo = $Matches[1]; number = [int]$Matches[2] } }
  if ($s -match '^#?(\d+)$') { return @{ repo = $DefaultRepo; number = [int]$Matches[1] } }
  throw "Invalid issue reference '$s'. $script:Usage"
}

function Test-RefMatch($Ref, $Item) {
  if (-not $Ref -or [int]$Item.number -ne $Ref.number) { return $false }
  (-not $Ref.repo) -or ("$($Item.repo)" -eq $Ref.repo)
}

# Items in scope (-Repo, -Issue, parents of -Issue items) and the actions for those whose Needs differs.
function Get-NeedsPlan {
  param($State, [string]$Repo, [string[]]$Issue, [bool]$IncludeParents = $false)
  $items = @(Get-Prop $State 'items' | Where-Object { $_ })
  $refs = @(@($Issue | ForEach-Object { "$_" -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ }) |
      ForEach-Object { ConvertTo-IssueRef $_ $null })
  $selected = [System.Collections.Generic.HashSet[object]]::new()
  foreach ($it in $items) {
    if ($Repo -and "$($it.repo)" -ne $Repo) { continue }
    if ($refs.Count -gt 0 -and -not (@($refs | Where-Object { Test-RefMatch $_ $it }).Count -gt 0)) { continue }
    [void]$selected.Add($it)
  }
  if ($IncludeParents -and $refs.Count -gt 0) {
    foreach ($it in @($selected)) {
      $p = ConvertTo-IssueRef (Get-Prop $it 'parent') "$($it.repo)"
      foreach ($cand in $items) { if (Test-RefMatch $p $cand) { [void]$selected.Add($cand) } }
    }
  }
  $actions = [System.Collections.Generic.List[object]]::new()
  $skipped = [System.Collections.Generic.List[object]]::new()
  foreach ($it in $items) {
    $id = "$($it.repo)#$($it.number)"
    if (-not $selected.Contains($it)) { $skipped.Add($id); continue }
    $from = Get-Prop $it 'needs'
    if ($from -eq '') { $from = $null }
    $to = Get-NeedsValue $it
    if ("$from" -eq "$to") { continue }
    $actions.Add([ordered]@{ issue = $id; item = Get-Prop $it 'itemId'; from = $from; to = $to })
  }
  [ordered]@{ actions = @($actions); skipped = @($skipped) }
}

if ($MyInvocation.InvocationName -eq '.') { return }

if ($Repo -and $Repo -notmatch '^[^/\s]+/[^/\s]+$') { throw "Invalid -Repo '$Repo'. $script:Usage" }
if (($Owner -and -not $Number) -or ($Number -and -not $Owner)) { throw "-Owner and -Number go together. $script:Usage" }

$root = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $root) { $root = (Get-Location).Path }
$state = $null
if ($StateFile) {
  if (-not (Test-Path -LiteralPath $StateFile -PathType Leaf)) { throw "State file not found: $StateFile" }
  $state = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json
}
$ref = Resolve-ProjectRef -Owner $Owner -Number $Number -Root "$root"
if (-not $ref -and $state -and (Get-Prop $state 'owner') -and (Get-Prop $state 'number')) {
  $ref = @{ owner = "$($state.owner)"; number = [int]$state.number }
}
if (-not $ref) { Write-Output 'Needs sync skipped: no project configured'; exit 0 }
if (-not $state) { throw 'Reading the project from GitHub is not implemented yet; pass -StateFile.' }

$plan = Get-NeedsPlan -State $state -Repo $Repo -Issue $Issue -IncludeParents ([bool]$IncludeParents)
if ($Json) {
  [ordered]@{ project = [ordered]@{ owner = $ref.owner; number = $ref.number }; actions = $plan.actions; skipped = $plan.skipped } |
    ConvertTo-Json -Depth 6
  exit 0
}
if ($plan.actions.Count -eq 0) { Write-Output "Needs in sync ($($ref.owner)/$($ref.number)): no changes."; exit 0 }
foreach ($a in $plan.actions) { Write-Output ("{0}: Needs {1} -> {2}" -f $a.issue, $(if ($a.from) { $a.from } else { '(none)' }), $(if ($a.to) { $a.to } else { '(clear)' })) }
