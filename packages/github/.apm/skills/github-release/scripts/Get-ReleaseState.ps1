<#
.SYNOPSIS
  Read-only state check of a release branch for the github-release skill; prints one JSON object.
.DESCRIPTION
  Runs `git fetch origin --tags` and the git/gh checks of `cut` and `finish`, never pushes or deletes.
  Fields: default, branch, state, openPrs[], localAhead, staleLines[], deleteAllowed, action, plus
  hasSemverCommit, hasMajorCommit, releaseWorkflow and releasePr (the CI release PR, or null).
  state: absent (not on origin), fresh (equals default), unreleased (own work, not behind), behind (default
  has commits the branch lacks), merged (tip is the second parent of a merge on default), released (ancestor
  of default, not a merge tip), released-continued (continued after its release merge).
.PARAMETER Mode
  cut or finish.
.PARAMETER Branch
  release/next or release/<x.y>. Default: cut -> release/next; finish -> the current branch if release/*,
  else release/next on origin, else the highest release/<x.y> whose v<x.y>.0 tag is not on origin.
#>
param(
  [Parameter(Mandatory)][ValidateSet('cut', 'finish')][string]$Mode,
  [string]$Branch
)
$ErrorActionPreference = 'Stop'

function Fail([string]$m) { Write-Error $m -ErrorAction Continue; exit 1 }
function Invoke-Git { $o = & git @args 2>$null; $global:gitOk = ($LASTEXITCODE -eq 0); $o }

$null = Invoke-Git fetch origin --tags --quiet
if (-not $gitOk) { Fail 'git fetch origin failed' }

$default = (Invoke-Git symbolic-ref refs/remotes/origin/HEAD --short)
$default = if ($gitOk -and $default) { $default -replace '^origin/', '' } else { 'main' }

$heads = @(Invoke-Git ls-remote --heads origin 'release/*' | ForEach-Object { $_ -replace '.*refs/heads/', '' })
$tags = @(Invoke-Git ls-remote --tags origin 'v*' | ForEach-Object { ($_ -replace '.*refs/tags/', '') -replace '\^\{\}$', '' })
$xy = '^release/[0-9]+\.[0-9]+$'
$staleLines = @($heads | Where-Object { $_ -match $xy } | Sort-Object { [version]($_ -replace '^release/', '') } |
    Where-Object { $tags -contains ('v' + ($_ -replace '^release/', '') + '.0') })

if (-not $Branch) {
  if ($Mode -eq 'cut') { $Branch = 'release/next' }
  else {
    $cur = Invoke-Git branch --show-current
    if ($cur -match '^release/') { $Branch = $cur }
    elseif ($heads -contains 'release/next') { $Branch = 'release/next' }
    else {
      $open = @($heads | Where-Object { $_ -match $xy -and $staleLines -notcontains $_ } | Sort-Object { [version]($_ -replace '^release/', '') })
      if ($open.Count -eq 0) { Fail 'no release branch found; run cut' }
      $Branch = $open[-1]
    }
  }
}
if ($Branch -notmatch '^release/(next|[0-9]+\.[0-9]+)$') { Fail "invalid branch name '$Branch': expected release/next or release/<x.y>" }

$remote = "origin/$Branch"
$def = "origin/$default"
$onOrigin = $heads -contains $Branch
$state = 'absent'; $openPrs = @(); $localAhead = 0; $semver = $false; $major = $false

if ($onOrigin) {
  $null = Invoke-Git merge-base --is-ancestor $remote $def; $inDefault = $gitOk
  $null = Invoke-Git merge-base --is-ancestor $def $remote; $hasDefault = $gitOk
  $tip = Invoke-Git rev-parse $remote
  if ($inDefault) {
    $merges = @(Invoke-Git log --merges --first-parent $def --format=%P)
    if ((Invoke-Git rev-parse $remote) -eq (Invoke-Git rev-parse $def)) { $state = 'fresh' }
    elseif ($merges | Where-Object { $_ -match " $tip$" }) { $state = 'merged' }
    else { $state = 'released' }
  }
  else {
    $continued = $false
    if ($Branch -match $xy) { $continued = $tags -contains ('v' + ($Branch -replace '^release/', '') + '.0') }
    else {
      foreach ($t in (Invoke-Git tag -l 'v*')) {
        $p = Invoke-Git rev-parse -q --verify "$t^2"
        if (-not $gitOk) { continue }
        $null = Invoke-Git merge-base --is-ancestor $p $remote; $pIn = $gitOk
        $null = Invoke-Git merge-base --is-ancestor $t $remote; $tIn = $gitOk
        if ($pIn -and -not $tIn) { $continued = $true; break }
      }
    }
    $state = if ($continued) { 'released-continued' } elseif (-not $hasDefault) { 'behind' } else { 'unreleased' }
  }
  $raw = & gh pr list --base $Branch --state open --json number,title,url 2>$null
  if ($LASTEXITCODE -ne 0) { Fail 'gh pr list failed' }
  $openPrs = @($raw | ConvertFrom-Json)
  $null = Invoke-Git rev-parse -q --verify "refs/heads/$Branch"
  if ($gitOk) { $localAhead = [int](Invoke-Git rev-list --count "$remote..refs/heads/$Branch") }
  $semver = [bool](Invoke-Git log "$def..$remote" -F --grep '+semver:')
  $major = [bool](Invoke-Git log "$def..$remote" -F --grep '+semver: major')
}

$deleteAllowed = ($Branch -eq 'release/next') -and ($state -in 'released', 'merged') -and $openPrs.Count -eq 0 -and $localAhead -eq 0

$stopReleased = 'stop: already released; cut a new release branch'
$action = if ($Mode -eq 'cut') {
  switch ($state) {
    'absent' { 'create' }
    { $_ -in 'released', 'merged' } { if ($deleteAllowed) { 'recreate' } else { 'stop: open PRs or local commits block the reset' } }
    default { 'noop' }
  }
}
else {
  switch ($state) {
    'absent' { 'stop: branch not on origin' }
    'fresh' { 'stop: nothing to release' }
    'merged' { if ($deleteAllowed) { 'delete-branch' } else { $stopReleased } }
    { $_ -in 'released', 'released-continued' } { $stopReleased }
    'behind' { "stop: behind $default; merge it in first" }
    default { if ($openPrs.Count -gt 0) { 'stop: open PRs target the branch; merge them first' } else { 'release-pr' } }
  }
}

$workflow = $false
if (Test-Path .github/workflows) {
  $workflow = [bool](Select-String -Path .github/workflows/*.yml -SimpleMatch 'ci/.github/workflows/release-branch.yml' -List -ErrorAction SilentlyContinue)
}
$releasePr = $null
if ($Mode -eq 'finish' -and $onOrigin) {
  $raw = & gh pr list --base $default --head $Branch --state open --json number,url 2>$null
  if ($LASTEXITCODE -eq 0) { $releasePr = @($raw | ConvertFrom-Json) | Select-Object -First 1 }
}

[ordered]@{
  default = $default; branch = $Branch; state = $state; openPrs = @($openPrs); localAhead = $localAhead
  staleLines = @($staleLines); deleteAllowed = $deleteAllowed; action = $action
  hasSemverCommit = $semver; hasMajorCommit = $major; releaseWorkflow = $workflow; releasePr = $releasePr
} | ConvertTo-Json -Depth 4
