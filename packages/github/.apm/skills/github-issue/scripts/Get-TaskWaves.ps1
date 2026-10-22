#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Computes the Task waves of a PBI from plan.json (the cache of the Task issues) and the set of finished Tasks.
.DESCRIPTION
  Rule of references/task-waves.md. Items are taken in plan order. A wave holds the open items whose blockers are
  all done (in -Done or in an earlier wave), whose `files` do not overlap and which are not `size: L`, at most -Parallel of them.
  An item with `size: L` or without `files` runs alone. Two paths overlap when they are equal or one is a directory prefix of the other.
  Blockers that are integers but belong to no plan item are existing issues outside the plan: they are not evaluated here
  (the orchestrator checks the native blocked-by links before it dispatches). The Task key is `issue` when set, else the plan `id`.
  Prints JSON `[[task,...],...]` (issue numbers as numbers, plan ids as strings); `[]` when nothing is open. Exit 1 on a
  cycle or an unreadable plan. The default width lives in task-waves.md, not here.
.PARAMETER Plan     Path of plan.json.
.PARAMETER Done     Finished Tasks: issue numbers (a leading # is accepted) or plan ids.
.PARAMETER Parallel Maximum Tasks per wave, 1-4.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Plan,
  [string[]]$Done = @(),
  [Parameter(Mandatory)][ValidateRange(1, 4)][int]$Parallel
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Plan -PathType Leaf)) { throw "No plan file: $Plan" }
$items = @((Get-Content -LiteralPath $Plan -Raw | ConvertFrom-Json).items)
function Get-Key($it) { if ($null -ne $it.issue) { [string]$it.issue } else { [string]$it.id } }
$doneSet = [Collections.Generic.HashSet[string]]::new()
foreach ($d in $Done) { foreach ($p in ($d -split '[,\s]+')) { if ($p) { [void]$doneSet.Add($p.TrimStart('#')) } } }
# every spelling of an item (plan id and issue number) maps to its key
$alias = @{}
foreach ($it in $items) { $alias[[string]$it.id] = Get-Key $it; if ($null -ne $it.issue) { $alias[[string]$it.issue] = Get-Key $it } }
foreach ($it in $items) { if ($doneSet.Contains([string]$it.id) -or ($null -ne $it.issue -and $doneSet.Contains([string]$it.issue))) { [void]$doneSet.Add((Get-Key $it)) } }
function Test-Overlap([string[]]$A, [string[]]$B) {
  foreach ($x in $A) { foreach ($y in $B) {
    $px = $x.TrimEnd('/'); $py = $y.TrimEnd('/')
    if ($px -eq $py -or $py.StartsWith("$px/") -or $px.StartsWith("$py/")) { return $true }
  } }
  $false
}
$pending = [Collections.Generic.List[object]]::new()
foreach ($it in $items) { if (-not $doneSet.Contains((Get-Key $it))) { $pending.Add($it) } }
$waves = [Collections.Generic.List[string]]::new()
$finished = [Collections.Generic.HashSet[string]]::new($doneSet)
function Format-Key([string]$k) { if ($k -match '\A[0-9]+\z') { $k } else { '"' + $k + '"' } }
while ($pending.Count -gt 0) {
  $ready = @($pending | Where-Object {
      $ok = $true
      foreach ($b in @($_.blocked_by)) {
        $bs = [string]$b
        if ($alias.ContainsKey($bs)) { if (-not $finished.Contains($alias[$bs])) { $ok = $false } }
      }
      $ok
    })
  if ($ready.Count -eq 0) { throw "No unblocked Task left among: $(@($pending | ForEach-Object { Get-Key $_ }) -join ', ') (cycle in blocked_by?)" }
  $wave = [Collections.Generic.List[object]]::new()
  $first = $ready[0]
  $files = @($first.files)
  if ($first.size -eq 'L' -or $files.Count -eq 0) { $wave.Add($first) }
  else {
    $taken = [Collections.Generic.List[string]]::new()
    foreach ($it in $ready) {
      if ($wave.Count -ge $Parallel) { break }
      $f = @($it.files)
      if ($it.size -eq 'L' -or $f.Count -eq 0) { continue }
      if ($wave.Count -gt 0 -and (Test-Overlap $taken.ToArray() $f)) { continue }
      $wave.Add($it); foreach ($p in $f) { $taken.Add([string]$p) }
    }
  }
  $waves.Add('[' + ((@($wave | ForEach-Object { Format-Key (Get-Key $_) })) -join ',') + ']')
  foreach ($it in $wave) { [void]$finished.Add((Get-Key $it)); [void]$pending.Remove($it) }
}
'[' + ($waves -join ',') + ']'
