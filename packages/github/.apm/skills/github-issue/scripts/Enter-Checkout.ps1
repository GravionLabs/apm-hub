#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Decides where a run works (main checkout when free, <root>/.worktrees/<nr> when busy), writes the checkout lease and prints {path, worktree, branch, base, lease} as JSON.
.DESCRIPTION
  The lease <state>/leases/<key>.json ({path, issue, branch, host, started, heartbeat}, UTC ISO 8601; <key> = first 16 hex of the SHA-256 of the
  absolute checkout path) coordinates apm-hub runs only: a human or a foreign agent without these scripts is detected only through the dirty tree.
  <state> is resolved like Add-LedgerLine.ps1 (DROMOS_STATE_DIR, else <git common dir>/agents, shared by all worktrees). Add-LedgerLine.ps1 renews
  'heartbeat' of the lease held by its -Issue, Exit-Checkout.ps1 releases it. Symlinked leases directories or lease files are refused.
  Decision, in this order:
    1. a lease of the same issue (any checkout) whose directory exists: reuse it ('resume'), heartbeat renewed
    2. the main checkout (parent of the git common dir) has no live lease of another issue and 'git status --porcelain --untracked-files=no' is empty:
       'git fetch origin <base>', check out <branch> (created from origin/<base> when missing), lease, worktree=false
    3. otherwise New-Worktree.ps1 -> .worktrees/<nr> (an existing registered worktree of that name is reused), lease, worktree=true
  After the lease is written on the main-checkout and worktree paths, the project Status of the issue is set to 'In Progress' through
  github-project/scripts/Sync-ProjectNeeds.ps1 -SetStatus (silent without .agents/project.json or a .github/workflows/*.y(a)ml file with a 'project-url:' of a GitHub project; PROJECT_SYNC_OFF=1 disables;
  a failure is one 'Project status:' line on stderr, exit code unchanged).
  A lease older than -LeaseTtlMinutes is stale: it counts as free and is taken over (stderr: 'stale lease of #<n> taken over').
  Race safety: the lease of the main checkout is claimed BEFORE the dirty check and the checkout, by exclusive create (O_EXCL: it fails when
  <key>.json exists; a file younger than 10 s that was not in the attempt's snapshot counts as a lease being written and is never moved).
  A stale lease is taken over only under the takeover lock <state>/leases.lock and only while it is byte-equal to what the attempt saw; it is
  moved away before it is deleted, a lease renewed in that window is put back (or, when a newer claim took the path, kept as
  <key>.json.displaced-<pid>: a live lease is never deleted). The loser re-evaluates, sees the winner's live lease and gets a worktree: two
  runs starting at the same instant cannot both take the free main checkout. ENTER_CHECKOUT_TEST_PAUSE is a test-only hook (Wait-TestPause).
.PARAMETER Issue           Issue number.
.PARAMETER Branch          Branch of the run.
.PARAMETER Base            Integration branch on origin the branch starts from.
.PARAMETER From            Local ref (branch or SHA) a Task worktree starts from, the current PBI HEAD (task-waves.md). With -From the main checkout is never used: a worktree .worktrees/<pbi>-t<task> on -Branch is created or resumed (-Issue is then '<pbi>-t<task>', also the lease issue).
.PARAMETER LeaseTtlMinutes Heartbeat age after which a lease is stale (default 120).
#>
[CmdletBinding()]
param(
  [string]$Issue,
  [string]$Branch,
  [string]$Base,
  [string]$From,
  [ValidateRange(1, 525600)][int]$LeaseTtlMinutes = 120
)
# No Mandatory: a headless run must exit non-zero with a message instead of prompting.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
function Test-Link([string]$Path) { [bool]([IO.FileInfo]::new($Path).LinkTarget) } # also true for a dangling link
# BEGIN Resolve-StateDir (identical in every script that defines it; test/repo/state-dir-resolver.test.ts)
function Resolve-StateDir {
  if ($env:DROMOS_STATE_DIR) { return [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($env:DROMOS_STATE_DIR, (Get-Location).Path)) }
  $common = $null
  try { $common = "$(& git -C (Get-Location).Path rev-parse --path-format=absolute --git-common-dir 2>$null)".Trim() } catch { $common = $null }
  if ($LASTEXITCODE -ne 0 -or -not $common) { throw 'No state directory: not inside a git repository (set DROMOS_STATE_DIR)' }
  [IO.Path]::GetFullPath((Join-Path $common 'agents'))
}
# END Resolve-StateDir
function Get-Stamp { [DateTime]::UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [cultureinfo]::InvariantCulture) }
function ConvertTo-Utc($Value) {
  # ConvertFrom-Json turns ISO strings into DateTime; keep both forms working
  if ($Value -is [DateTime]) { return $Value.ToUniversalTime() }
  [DateTime]::Parse("$Value", [cultureinfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal)
}
function Get-LeaseKey([string]$CheckoutPath) {
  $hash = [Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($CheckoutPath))
  ([BitConverter]::ToString($hash) -replace '-', '').Substring(0, 16).ToLowerInvariant()
}
function Write-Lease([string]$File, $Lease, [switch]$Exclusive) {
  # -Exclusive: true when this call created the file (O_EXCL), false when it already exists
  if (Test-Link $File) { throw "Refusing symlinked path: $File" }
  $text = ($Lease | ConvertTo-Json -Compress) + "`n"
  if ($Exclusive) {
    # File.Move(overwrite: false) is not atomic on Unix (measured: several winners), CreateNew is; readers ignore the short empty window
    try { $fs = [IO.File]::Open($File, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read) } catch [IO.IOException] { return $false }
    try { $bytes = [Text.UTF8Encoding]::new($false).GetBytes($text); $fs.Write($bytes, 0, $bytes.Length) } finally { $fs.Dispose() }
    return $true
  }
  $tmp = "$File.$PID.tmp"
  if (Test-Link $tmp) { throw "Refusing symlinked path: $tmp" }
  [IO.File]::WriteAllText($tmp, $text)
  Move-Item -LiteralPath $tmp -Destination $File -Force
  return $true
}
# Test-only (deterministic race tests): with ENTER_CHECKOUT_TEST_PAUSE=<dir> the run writes <dir>/<point>.reached at a named point of the claim
# loop and waits until <dir>/<point>.go exists (at most 60 s). Unset in normal runs: no effect.
function Wait-TestPause([string]$Point) {
  $dir = $env:ENTER_CHECKOUT_TEST_PAUSE
  if (-not $dir) { return }
  [IO.File]::WriteAllText((Join-Path $dir "$Point.reached"), "$PID")
  $until = [DateTime]::UtcNow.AddSeconds(60)
  while (-not (Test-Path -LiteralPath (Join-Path $dir "$Point.go")) -and [DateTime]::UtcNow -lt $until) { Start-Sleep -Milliseconds 25 }
}
function Test-Same([string]$A, [string]$B) {
  $cmp = if ($IsWindows) { [StringComparison]::OrdinalIgnoreCase } else { [StringComparison]::Ordinal }
  [string]::Equals([IO.Path]::TrimEndingDirectorySeparator($A), [IO.Path]::TrimEndingDirectorySeparator($B), $cmp)
}

if ($Issue -notmatch '\A[0-9]{1,10}(-t[0-9]{1,10})?\z') { throw "Invalid -Issue '$Issue': expected the issue number or '<pbi>-t<task>'." }
if (-not $Base) { throw 'Missing -Base: pass the integration branch (no default is guessed).' }
if ($Base -notmatch '\A[A-Za-z0-9][A-Za-z0-9._/-]{0,199}\z' -or $Base -match '\.\.|//|\.lock\z|/\z') { throw "Invalid -Base '$Base': expected a branch name on origin." }
if (-not $Branch) { throw 'Missing -Branch.' }
if ($Branch -notmatch '\A[A-Za-z0-9][A-Za-z0-9._/-]{0,199}\z' -or $Branch -match '\.\.|//|\.lock\z|/\z') { throw "Invalid -Branch '$Branch'." }
& git check-ref-format --branch $Branch *> $null
if ($LASTEXITCODE -ne 0) { throw "Invalid -Branch '$Branch'." }

$common = ''
try { $common = "$(& git -C (Get-Location).Path rev-parse --path-format=absolute --git-common-dir 2>$null)".Trim() } catch { $common = '' }
if ($LASTEXITCODE -ne 0 -or -not $common) { throw 'Not inside a git repository.' }
$common = [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($common))
if ((Split-Path -Leaf $common) -ne '.git') { throw "Unsupported repository layout (git common dir $common is not <root>/.git)." }
$root = Split-Path -Parent $common

$state = Resolve-StateDir
$leaseDir = [IO.Path]::GetFullPath((Join-Path $state 'leases'))
if (-not $leaseDir.StartsWith($state + [IO.Path]::DirectorySeparatorChar)) { throw "Path escapes the state directory: $leaseDir" }
foreach ($p in @($state, $leaseDir)) { if (Test-Link $p) { throw "Refusing symlinked path: $p" } }
New-Item -ItemType Directory -Path $leaseDir -Force | Out-Null

# all leases; a symlinked lease file is refused, an unreadable one is ignored
function Get-Leases {
  $now = [DateTime]::UtcNow
  @(Get-ChildItem -LiteralPath $leaseDir -Filter '*.json' -File -Force | ForEach-Object {
      if (Test-Link $_.FullName) { throw "Refusing symlinked path: $($_.FullName)" }
      try {
        $raw = Get-Content -LiteralPath $_.FullName -Raw
        $o = $raw | ConvertFrom-Json
        $age = ($now - (ConvertTo-Utc $o.heartbeat)).TotalMinutes
        [pscustomobject]@{ File = $_.FullName; Raw = $raw; Data = $o; Issue = "$($o.issue)"; Path = "$($o.path)"; Live = ($age -lt $LeaseTtlMinutes) }
      } catch { $null }
    } | Where-Object { $_ })
}
$leases = Get-Leases
# true for an unreadable lease text or one that is not live for another issue (the busy rule of the claim loop)
function Test-Takeable([string]$Raw) {
  try {
    $o = $Raw | ConvertFrom-Json
    $live = ([DateTime]::UtcNow - (ConvertTo-Utc $o.heartbeat)).TotalMinutes -lt $LeaseTtlMinutes
    -not ($live -and "$($o.issue)" -ne $Issue)
  } catch { $true }
}

function Save-Lease([string]$CheckoutPath, [string]$LeaseBranch, $Existing, [switch]$Exclusive) {
  $file = Join-Path $leaseDir ((Get-LeaseKey $CheckoutPath) + '.json')
  $stamp = Get-Stamp
  $started = if ($Existing -and $Existing.PSObject.Properties['started'] -and $Existing.started) { (ConvertTo-Utc $Existing.started).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [cultureinfo]::InvariantCulture) } else { $stamp }
  $created = Write-Lease $file ([ordered]@{ path = $CheckoutPath; issue = $(if ($Issue -match '\A[0-9]+\z') { [long]$Issue } else { $Issue }); branch = $LeaseBranch; host = [Environment]::MachineName; started = $started; heartbeat = $stamp }) -Exclusive:$Exclusive
  if (-not $created) { return $null }
  $file
}
# Sets the project Status of the issue to 'In Progress' once the lease exists. Silent without project config or with PROJECT_SYNC_OFF=1;
# any failure is one 'Project status:' line on stderr (stdout stays the JSON result), never an exception.
function Set-ProjectStatus([string]$CheckoutPath) {
  if ($env:PROJECT_SYNC_OFF -eq '1' -or $Issue -notmatch '\A[0-9]+\z') { return }
  $configured = Test-Path -LiteralPath (Join-Path $CheckoutPath '.agents/project.json') -PathType Leaf
  if (-not $configured) {
    $wfDir = Join-Path $CheckoutPath '.github/workflows'
    $configured = [bool](Get-ChildItem -LiteralPath $wfDir -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in '.yml', '.yaml' } |
      Where-Object { (Get-Content -LiteralPath $_.FullName -Raw) -match 'project-url:\s*["'']?https://github\.com/(?:users|orgs)/[^/\s"'']+/projects/\d+' } | Select-Object -First 1)
  }
  if (-not $configured) { return }
  try {
    $script = Join-Path $PSScriptRoot '../../github-project/scripts/Sync-ProjectNeeds.ps1'
    if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw 'Sync-ProjectNeeds.ps1 not found (install the github-project skill)' }
    $url = "$(& git -C $CheckoutPath config --get remote.origin.url 2>$null)".Trim()
    if ($url -notmatch 'github\.com[:/]([^/\s]+/[^/\s]+?)(\.git)?/?\z') { throw "cannot derive owner/repo from origin '$url'" }
    Push-Location -LiteralPath $CheckoutPath
    try { $out = @(& pwsh -NoProfile -File $script -Issue "$($Matches[1])#$Issue" -SetStatus 'In Progress' 2>&1 | ForEach-Object { "$_" }) } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw ($out -join ' ') }
  } catch {
    [Console]::Error.WriteLine("Project status: not set for #${Issue}: $($_ -replace '\s+', ' ')")
  }
}
function Write-Result([string]$CheckoutPath, [bool]$IsWorktree, [string]$ResultBranch, [string]$LeaseFile) {
  [ordered]@{ path = $CheckoutPath; worktree = $IsWorktree; branch = $ResultBranch; base = $Base; lease = $LeaseFile } | ConvertTo-Json -Compress
}

# 1. resume: a lease of the same issue whose checkout still exists
foreach ($l in @($leases | Where-Object { $_.Issue -eq $Issue })) {
  if (-not (Test-Path -LiteralPath $l.Path -PathType Container)) { continue }
  if (-not $l.Live) { [Console]::Error.WriteLine("stale lease of #$Issue taken over") }
  $leaseBranch = if ($l.Data.PSObject.Properties['branch'] -and $l.Data.branch) { "$($l.Data.branch)" } else { $Branch }
  $file = Save-Lease $l.Path $leaseBranch $l.Data
  if ($file -ne $l.File) { Remove-Item -LiteralPath $l.File -Force }
  Write-Result $l.Path (-not (Test-Same $l.Path $root)) $leaseBranch $file
  return
}

# 2. the main checkout, when no live lease of another issue holds it and no tracked file is modified.
# The lease is claimed first (exclusive create), then the tree is checked and the branch checked out: a concurrent run sees the live lease.
$rootFile = Join-Path $leaseDir ((Get-LeaseKey $root) + '.json')
$claimed = $null
for ($attempt = 0; $attempt -lt 5 -and -not $claimed -and -not $From; $attempt++) {
  if ($attempt -gt 0) { $leases = Get-Leases }
  $onRoot = @($leases | Where-Object { Test-Same $_.Path $root })
  if (@($onRoot | Where-Object { $_.Live -and $_.Issue -ne $Issue }).Count -gt 0) { break } # busy
  $previous = @($onRoot | Where-Object { $_.File -eq $rootFile } | Select-Object -First 1)
  # One look per attempt: only what this look saw may be taken over (a second existence check could see a lease created after the snapshot).
  $seen = [IO.FileInfo]::new($rootFile) # Exists and LastWriteTimeUtc are read once, on first access
  if (-not $seen.Exists) { $seen = $null }
  Wait-TestPause 'after-snapshot'
  $existing = if ($previous.Count) { $previous[0].Data } else { $null }
  if (-not $seen) {
    $claimed = Save-Lease $root $Branch $existing -Exclusive # free: exclusive create, a concurrent creator wins and is seen next attempt
    continue
  }
  if (Test-Link $rootFile) { throw "Refusing symlinked path: $rootFile" }
  if (-not $previous.Count -and ([DateTime]::UtcNow - $seen.LastWriteTimeUtc).TotalSeconds -lt 10) {
    Start-Sleep -Milliseconds 150 # not in the snapshot and young: a lease being written or created after the look; never moved, read again
    continue
  }
  # A stale lease (or an unreadable file older than 10 s): taken over under the takeover lock only. Rules:
  # - the lock (FileShare.None on <state>/leases.lock: flock on Unix, released at process exit) serialises takers, so no taker moves a lease
  #   another taker has just claimed: under the lock the file must still be byte-equal to this look and still not live for another issue;
  # - the file is moved aside before it is deleted; when it changed in that window (its owner renewed the heartbeat) it is put back;
  # - a live lease is never deleted: when putting it back fails (a run created a new lease in the window), the newer claim stays and the
  #   moved lease is kept as <key>.json.displaced-<pid> with a stderr line naming its issue, so its owner stays detectable.
  $before = if ($previous.Count) { $previous[0].Raw } else { try { Get-Content -LiteralPath $rootFile -Raw } catch { $null } }
  $lockPath = Join-Path $state 'leases.lock'
  if (Test-Link $lockPath) { throw "Refusing symlinked path: $lockPath" }
  $lock = $null
  $deadline = [DateTime]::UtcNow.AddSeconds(10)
  while (-not $lock -and [DateTime]::UtcNow -lt $deadline) {
    try { $lock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch [IO.IOException] { Start-Sleep -Milliseconds (Get-Random -Minimum 5 -Maximum 40) }
  }
  if (-not $lock) { continue }
  try {
    $recheck = try { Get-Content -LiteralPath $rootFile -Raw } catch { $null }
    if (-not (Test-Path -LiteralPath $rootFile) -or $recheck -ne $before -or -not (Test-Takeable $recheck)) { continue } # changed since the look: read again
    Wait-TestPause 'before-move'
    $gone = "$rootFile.$PID.stale"
    try { [IO.File]::Move($rootFile, $gone) } catch [IO.IOException] { continue }
    $after = try { Get-Content -LiteralPath $gone -Raw } catch { $null }
    if ($after -ne $before) {
      Wait-TestPause 'before-restore'
      try { [IO.File]::Move($gone, $rootFile, $false) } catch [IO.IOException] {
        $kept = "$rootFile.displaced-$PID"
        [IO.File]::Move($gone, $kept, $false)
        $who = try { "#$(($after | ConvertFrom-Json).issue)" } catch { 'an unknown issue' }
        [Console]::Error.WriteLine("lease of $who renewed during a takeover and displaced by a newer claim: kept as $kept")
      }
      continue
    }
    Remove-Item -LiteralPath $gone -Force -ErrorAction SilentlyContinue
    foreach ($l in @($onRoot | Where-Object { -not $_.Live -and $_.Issue -ne $Issue })) { [Console]::Error.WriteLine("stale lease of #$($l.Issue) taken over") }
    $claimed = Save-Lease $root $Branch $existing -Exclusive
  } finally { $lock.Dispose() }
}
if ($claimed) {
  $dirty = @(& git -C $root status --porcelain --untracked-files=no)
  if ($LASTEXITCODE -ne 0) { Remove-Item -LiteralPath $claimed -Force -ErrorAction SilentlyContinue; throw 'git status failed.' }
  if ($dirty.Count -gt 0) { Remove-Item -LiteralPath $claimed -Force -ErrorAction SilentlyContinue; $claimed = $null }
}
if ($claimed) {
  try {
    $out = & git -C $root fetch origin $Base 2>&1
    if ($LASTEXITCODE -ne 0) { throw "git fetch origin $Base failed: $(($out | ForEach-Object { "$_" }) -join ' ')" }
    $current = "$(& git -C $root rev-parse --abbrev-ref HEAD 2>$null)".Trim()
    if ($current -ne $Branch) {
      & git -C $root show-ref --verify --quiet "refs/heads/$Branch"
      $gitArgs = if ($LASTEXITCODE -eq 0) { @('checkout', $Branch) } else { @('checkout', '--no-track', '-b', $Branch, "origin/$Base") }
      $out = & git -C $root @gitArgs 2>&1
      if ($LASTEXITCODE -ne 0) { throw "git $($gitArgs -join ' ') failed: $(($out | ForEach-Object { "$_" }) -join ' ')" }
    }
  } catch {
    Remove-Item -LiteralPath $claimed -Force -ErrorAction SilentlyContinue # a failed checkout does not keep the main checkout busy
    throw
  }
  Set-ProjectStatus $root
  Write-Result $root $false $Branch $claimed
  return
}

# 3. busy: .worktrees/<nr> (an already registered worktree of that name is reused)
$target = [IO.Path]::GetFullPath((Join-Path (Join-Path $root '.worktrees') $Issue))
$registered = @(& git -C $root worktree list --porcelain | Where-Object { $_ -like 'worktree *' } | ForEach-Object { [IO.Path]::GetFullPath($_.Substring(9)) })
if ($registered -contains $target) {
  if (Test-Link $target) { throw "Refusing symlinked path: $target" }
  $wtBranch = "$(& git -C $target rev-parse --abbrev-ref HEAD 2>$null)".Trim()
  if (-not $wtBranch) { $wtBranch = $Branch }
} else {
  $created = & (Join-Path $PSScriptRoot 'New-Worktree.ps1') -Issue $Issue -Branch $Branch -Base $Base -From $From | Select-Object -Last 1 | ConvertFrom-Json
  $target = "$($created.path)"
  $wtBranch = "$($created.branch)"
}
$file = Save-Lease $target $wtBranch $null
Set-ProjectStatus $target
Write-Result $target $true $wtBranch $file
