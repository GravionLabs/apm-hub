#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Brings a GitHub Project (v2) to the GravionLabs standard: Status 'In release', field Level, five views, optional label sync.
.DESCRIPTION
  1. Reads the state (fields with options, views, issue items) via 'gh api graphql', or from -StateFile (no gh call at all).
  2. A pure function (Get-ProjectPlan) computes the action list.
  3. Executes it unless -DryRun, then prints the manual UI steps that no API covers.
  Idempotent: a second run reports no changes. Needs 'gh' with scope 'project' (gh auth refresh -s project).
  The owner may be a user or an organization.
.PARAMETER Owner               User or organization login that owns the project.
.PARAMETER Number              Project number.
.PARAMETER Sync                Also sync items: Level from labels/title, label 'merged' <-> status 'In release' (open issues only).
.PARAMETER RemoveDefaultViews  Delete views named 'View <n>' or 'Probe', only when all five standard views exist afterwards.
.PARAMETER DryRun              Print the actions, change nothing.
.PARAMETER StateFile           JSON state (projectId, ownerType, fields, views, items) instead of reading from GitHub.
.PARAMETER Json                Emit {actions, manualSteps} as JSON instead of text.
#>
[CmdletBinding()]
param(
  [string]$Owner,
  [int]$Number,
  [switch]$Sync,
  [switch]$RemoveDefaultViews,
  [switch]$DryRun,
  [string]$StateFile,
  [switch]$Json
)
# No Mandatory: a headless run must exit non-zero with a message instead of prompting.
$ErrorActionPreference = 'Stop'

$script:LevelOptions = @(
  @{ name = 'Epic'; color = 'PURPLE' }, @{ name = 'Feature'; color = 'GREEN' }, @{ name = 'PBI'; color = 'BLUE' },
  @{ name = 'Task'; color = 'GRAY' }, @{ name = 'Bug'; color = 'RED' })
$script:InReleaseDescription = 'Merged into a release branch, ships with the next release (label merged)'
$script:StandardViews = @(
  @{ name = 'Hierarchy'; layout = 'table'; filter = 'is:open'; groupBy = $null; verticalGroupBy = $null
     fields = @('Title', 'Level', 'Status', 'Sub-issues progress', 'Linked pull requests', 'Labels') },
  @{ name = 'Board'; layout = 'board'; filter = '-label:epic,feature -status:Done'; groupBy = $null; verticalGroupBy = 'Status'
     fields = @('Title', 'Level', 'Linked pull requests', 'Sub-issues progress', 'Parent issue') },
  @{ name = 'Release next'; layout = 'table'; filter = 'status:"In release"'; groupBy = 'Level'; verticalGroupBy = $null
     fields = @('Title', 'Parent issue', 'Linked pull requests', 'Sub-issues progress') },
  @{ name = 'Backlog'; layout = 'table'; filter = 'is:open -status:"In release" -label:epic,feature'; groupBy = 'Parent issue'; verticalGroupBy = $null
     fields = @('Title', 'Level', 'Status', 'Labels', 'Sub-issues progress') },
  @{ name = 'Recently closed'; layout = 'table'; filter = 'is:closed'; groupBy = $null; verticalGroupBy = $null
     fields = @('Title', 'Level', 'Parent issue', 'Linked pull requests') })
$script:ManualSteps = @(
  'Hierarchy view: enable "Show hierarchy" (no API).',
  'Recently closed view: sort by Closed, descending (the REST API rejects sort_by with HTTP 400).',
  'Project Workflows: enable "Item closed" -> Status Done.')

function Get-ProjectPlan {
  param($State, [bool]$Sync, [bool]$RemoveDefaultViews)
  $actions = [System.Collections.Generic.List[object]]::new()
  $status = @($State.fields) | Where-Object { $_.name -eq 'Status' } | Select-Object -First 1
  if (-not $status) { throw "Project has no 'Status' field." }

  # 1. Status: 'In release' directly before 'Done'; all existing options are sent back with their ids.
  $statusNames = @($status.options | ForEach-Object { $_.name })
  if ($statusNames -notcontains 'In release') {
    $new = [ordered]@{ name = 'In release'; color = 'BLUE'; description = $script:InReleaseDescription }
    $opts = [System.Collections.Generic.List[object]]::new()
    foreach ($o in @($status.options)) {
      if ($o.name -eq 'Done' -and $new) { $opts.Add($new); $new = $null }
      $opts.Add([ordered]@{ id = $o.id; name = $o.name; color = $o.color; description = [string]$o.description })
    }
    if ($new) { $opts.Add($new) }
    $actions.Add([ordered]@{ type = 'UpdateStatusOptions'; field = 'Status'; options = @($opts) })
    $statusNames = @($opts | ForEach-Object { $_.name })
  }

  # 2. Level: created when missing, an existing field stays untouched.
  $hasLevel = [bool](@($State.fields) | Where-Object { $_.name -eq 'Level' })
  if (-not $hasLevel) {
    $actions.Add([ordered]@{ type = 'CreateField'; name = 'Level'
        options = @($script:LevelOptions | ForEach-Object { [ordered]@{ name = $_.name; color = $_.color; description = '' } }) })
  }

  # 3. Sync: Level for every issue (Recently closed shows it), Status for open issues only
  if ($Sync) {
    $todo = if ($statusNames -contains 'Todo') { 'Todo' } else { $statusNames[0] }
    $levelNames = @{ epic = 'Epic'; feature = 'Feature'; pbi = 'PBI'; task = 'Task'; bug = 'Bug' }
    foreach ($item in @($State.items)) {
      $labels = @($item.labels | ForEach-Object { "$_".ToLowerInvariant() })
      if (-not $item.level) {
        $lvl = $null
        foreach ($k in 'epic', 'feature', 'pbi', 'task', 'bug') { if ($labels -contains $k) { $lvl = $levelNames[$k]; break } }
        if (-not $lvl -and "$($item.title)" -match '^\s*\[(Epic|Feature|PBI|Task)\]') { $lvl = $Matches[1] }
        if ($lvl) { $actions.Add([ordered]@{ type = 'SetItem'; item = $item.id; number = $item.number; field = 'Level'; option = $lvl }) }
      }
      if ($item.state -ne 'OPEN') { continue }
      if ($labels -contains 'merged') {
        if ($item.status -ne 'In release') { $actions.Add([ordered]@{ type = 'SetItem'; item = $item.id; number = $item.number; field = 'Status'; option = 'In release' }) }
      } elseif ($item.status -eq 'In release') {
        $actions.Add([ordered]@{ type = 'SetItem'; item = $item.id; number = $item.number; field = 'Status'; option = $todo })
      }
    }
  }

  # 4. Views, matched by name; other views are never touched.
  $existing = @($State.views | ForEach-Object { $_.name })
  foreach ($v in $script:StandardViews) {
    if ($existing -notcontains $v.name) {
      $actions.Add([ordered]@{ type = 'CreateView'; name = $v.name; layout = $v.layout; filter = $v.filter
          visibleFields = $v.fields; groupBy = $v.groupBy; verticalGroupBy = $v.verticalGroupBy })
    }
  }

  # 5. Default views go only when all five standard views exist afterwards.
  if ($RemoveDefaultViews) {
    $after = @($existing) + @($actions | Where-Object { $_.type -eq 'CreateView' } | ForEach-Object { $_.name })
    $allStandard = -not ($script:StandardViews | Where-Object { $after -notcontains $_.name })
    if ($allStandard) {
      foreach ($v in @($State.views)) {
        if ($v.name -match '^View \d+$' -or $v.name -eq 'Probe') { $actions.Add([ordered]@{ type = 'DeleteView'; name = $v.name; id = $v.id }) }
      }
    }
  }
  , @($actions)
}

function Format-Action($a) {
  switch ($a.type) {
    'UpdateStatusOptions' { "Status: options -> $(($a.options | ForEach-Object { $_.name }) -join ', ')" }
    'CreateField' { "Create field $($a.name): $(($a.options | ForEach-Object { $_.name }) -join ', ')" }
    'SetItem' { "#$($a.number) $($a.field) -> $($a.option)" }
    'CreateView' { "Create view $($a.name) ($($a.layout), filter: $($a.filter))" }
    'DeleteView' { "Delete view $($a.name)" }
  }
}

function Invoke-Gh {
  param([string[]]$GhArgs, $Body)
  $out = if ($null -ne $Body) { $Body | ConvertTo-Json -Depth 20 -Compress | & gh @GhArgs --input - 2>&1 } else { & gh @GhArgs 2>&1 }
  if ($LASTEXITCODE -ne 0) { throw "gh $($GhArgs -join ' ') failed: $out" }
  ($out | Out-String) | ConvertFrom-Json -Depth 20
}
function Invoke-Graphql($Query, $Variables) { (Invoke-Gh -GhArgs @('api', 'graphql') -Body @{ query = $Query; variables = $Variables }).data }

$FieldsQuery = @'
query($login: String!, $n: Int!) { repositoryOwner(login: $login) { __typename ... on ProjectV2Owner { projectV2(number: $n) {
  id
  fields(first: 50) { nodes { __typename
    ... on ProjectV2Field { id name databaseId dataType }
    ... on ProjectV2SingleSelectField { id name databaseId dataType options { id name color description } }
    ... on ProjectV2IterationField { id name databaseId dataType } } }
  views(first: 50) { nodes { id name layout filter } } } } } }
'@
$ItemsQuery = @'
query($id: ID!, $cursor: String) { node(id: $id) { ... on ProjectV2 { items(first: 100, after: $cursor) {
  pageInfo { hasNextPage endCursor }
  nodes { id content { __typename ... on Issue { number title state labels(first: 50) { nodes { name } } } }
    status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
    level: fieldValueByName(name: "Level") { ... on ProjectV2ItemFieldSingleSelectValue { name } } } } } } }
'@

function Get-ProjectState {
  param([bool]$WithItems)
  $d = Invoke-Graphql $FieldsQuery @{ login = $Owner; n = $Number }
  $p = $d.repositoryOwner.projectV2
  if (-not $p) { throw "Project $Owner/$Number not found (or scope 'project' missing: gh auth refresh -s project)." }
  $state = [ordered]@{ owner = $Owner; number = $Number; projectId = $p.id; ownerType = $d.repositoryOwner.__typename
    fields = @($p.fields.nodes); views = @($p.views.nodes); items = @() }
  if ($WithItems) {
    $items = [System.Collections.Generic.List[object]]::new(); $cursor = $null
    do {
      $page = (Invoke-Graphql $ItemsQuery @{ id = $p.id; cursor = $cursor }).node.items
      foreach ($n in $page.nodes) {
        if ($n.content.__typename -ne 'Issue') { continue }
        $items.Add([ordered]@{ id = $n.id; number = $n.content.number; title = $n.content.title; state = $n.content.state
            labels = @($n.content.labels.nodes | ForEach-Object { $_.name }); status = $n.status.name; level = $n.level.name })
      }
      $cursor = $page.pageInfo.endCursor
    } while ($page.pageInfo.hasNextPage)
    $state.items = @($items)
  }
  $state
}

function Invoke-Plan($Actions, $State) {
  $field = { param($name) (@($State.fields) | Where-Object { $_.name -eq $name } | Select-Object -First 1) }
  foreach ($a in $Actions) {
    switch ($a.type) {
      'UpdateStatusOptions' {
        $f = & $field 'Status'
        Invoke-Graphql 'mutation($i: UpdateProjectV2FieldInput!) { updateProjectV2Field(input: $i) { clientMutationId } }' @{ i = @{ fieldId = $f.id; singleSelectOptions = $a.options } } | Out-Null
        $State.fields = @((Get-ProjectState $false).fields)
      }
      'CreateField' {
        Invoke-Graphql 'mutation($i: CreateProjectV2FieldInput!) { createProjectV2Field(input: $i) { clientMutationId } }' @{ i = @{ projectId = $State.projectId; dataType = 'SINGLE_SELECT'; name = $a.name; singleSelectOptions = $a.options } } | Out-Null
        $State.fields = @((Get-ProjectState $false).fields)
      }
      'SetItem' {
        $f = & $field $a.field
        $o = $f.options | Where-Object { $_.name -eq $a.option } | Select-Object -First 1
        if (-not $o) { throw "Option '$($a.option)' not found in field $($a.field)." }
        & gh project item-edit --project-id $State.projectId --id $a.item --field-id $f.id --single-select-option-id $o.id | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "gh project item-edit failed for #$($a.number)." }
      }
      'CreateView' {
        $ids = { param($names) @($names | ForEach-Object { [int64](& $field $_).databaseId }) }
        $body = [ordered]@{ name = $a.name; layout = $a.layout; filter = $a.filter; visible_fields = @(& $ids $a.visibleFields) }
        if ($a.groupBy) { $body.group_by = @(& $ids @($a.groupBy)) }
        if ($a.verticalGroupBy) { $body.vertical_group_by = @(& $ids @($a.verticalGroupBy)) }
        $base = if ($State.ownerType -eq 'Organization') { "/orgs/$Owner" } else { "/users/$Owner" }
        Invoke-Gh -GhArgs @('api', '-X', 'POST', "$base/projectsV2/$Number/views") -Body $body | Out-Null
      }
      'DeleteView' {
        Invoke-Graphql 'mutation($i: DeleteProjectV2ViewInput!) { deleteProjectV2View(input: $i) { clientMutationId } }' @{ i = @{ viewId = $a.id } } | Out-Null
      }
    }
  }
}

if ($StateFile) {
  $state = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json -Depth 20
  $DryRun = $true  # a state file never reaches GitHub
} else {
  if (-not $Owner -or $Number -lt 1) { throw 'Usage: Set-ProjectStandard.ps1 -Owner <login> -Number <n> [-Sync] [-RemoveDefaultViews] [-DryRun] [-StateFile <json>] [-Json]' }
  $state = Get-ProjectState $Sync.IsPresent
}
$actions = Get-ProjectPlan -State $state -Sync $Sync.IsPresent -RemoveDefaultViews $RemoveDefaultViews.IsPresent
if (-not $DryRun -and $actions.Count -gt 0) { Invoke-Plan $actions $state }

if ($Json) {
  [ordered]@{ dryRun = $DryRun.IsPresent; actions = @($actions); manualSteps = $script:ManualSteps } | ConvertTo-Json -Depth 20
} else {
  $verb = if ($DryRun) { 'Planned' } else { 'Applied' }
  if ($actions.Count -eq 0) { 'No changes.' } else { "$verb $($actions.Count) action(s):"; $actions | ForEach-Object { "  - $(Format-Action $_)" } }
  ''; 'Manual steps (UI only):'; $script:ManualSteps | ForEach-Object { "  - $_" }
}
