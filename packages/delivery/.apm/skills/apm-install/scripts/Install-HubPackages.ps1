<#
.SYNOPSIS
  Resolve and install the apm-hub packages a project needs with `apm`.

.DESCRIPTION
  Without -Packages (project install), runs the installed detect-techstack script and maps the
  stack to packages (ts/js -> ts, py -> py, dotnet -> dotnet, angular -> ng). That script is
  looked up in the user's own skill directories first; a copy that only exists in the project is
  code from the repository and runs only with -TrustProject. Without detection the base packages
  shared, github, delivery are proposed (only when not installed globally). With -Global and no
  -Packages only the base packages are proposed, no stack detection.
  Packages already in the manifest or in apm_modules (core/all cover their members) are skipped.
  A missing apm.yml is created by `apm install` itself. Install form:
  apm install GravionLabs/apm-hub/packages/<pkg> [-g]

.PARAMETER Packages
  Packages to install (comma-separated); skips detection. One of shared, github, delivery,
  agents, hooks, statusline, core, all, ts, py, ng, dotnet.

.PARAMETER Global
  Install user-wide (apm -g) instead of into the project.

.PARAMETER Ref
  Optional tag or commit sha appended as `#<ref>` to every package spec. Without it apm tracks the default branch.

.PARAMETER TrustProject
  Allow running a project-local Detect-TechStack.ps1 (repository code). Off by default.

.PARAMETER DryRun
  Print the commands in the JSON result, run nothing. The result lists `wouldInstall`, not `installed`.

.OUTPUTS
  JSON {dryRun, installed|wouldInstall, skipped, failed, notAttempted, commands, sanitized, provides, dependencies, notes}.
  After installing agents, core or all the script runs `apmw sanitize -p <client>` (-g under -Global) for every client with an agents directory and lists them as `sanitized`; a missing or failing apmw is a note, not a failure.
  Exit 1 when apm or pwsh 7 is missing, a package name is invalid or an install command fails.
#>
param(
  [string[]]$Packages,
  [switch]$Global,
  [string]$Ref,
  [switch]$TrustProject,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSVersion.Major -lt 7) {
  [Console]::Error.WriteLine('PowerShell 7+ is required (https://aka.ms/powershell).')
  exit 1
}
if (-not (Get-Command apm -ErrorAction SilentlyContinue)) {
  [Console]::Error.WriteLine('apm not found on PATH. Install it: curl -sSL https://aka.ms/apm-unix | sh (macOS/Linux) or winget install Microsoft.APM')
  exit 1
}

# pwsh -File passes "ts,ng" as one string: split on commas, then validate
$valid = 'shared', 'github', 'delivery', 'agents', 'hooks', 'statusline', 'core', 'all', 'ts', 'py', 'ng', 'dotnet', 'rust'
if ($PSBoundParameters.ContainsKey('Packages')) {
  $Packages = @($Packages | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  if ($Packages.Count -eq 0) {
    [Console]::Error.WriteLine("-Packages is empty. Valid: $($valid -join ', ')")
    exit 1
  }
  $bad = @($Packages | Where-Object { $valid -notcontains $_ })
  if ($bad) {
    [Console]::Error.WriteLine("Invalid package(s): $($bad -join ', '). Valid: $($valid -join ', ')")
    exit 1
  }
}

if ($Ref -and $Ref -notmatch '^[\w][\w./-]*$') {
  [Console]::Error.WriteLine("Invalid -Ref '$Ref': use a tag, branch or commit sha.")
  exit 1
}

$userHome = if ($env:HOME) { $env:HOME } else { $env:USERPROFILE }
$projectDirs = '.claude/skills', '.opencode/skills', '.agents/skills', '.github/skills'
$homeDirs = '.claude/skills', '.config/opencode/skills', '.copilot/skills', '.agents/skills', '.opencode/skills', '.github/skills'
$notes = [System.Collections.Generic.List[string]]::new()
$hubPath = 'GravionLabs/apm-hub/packages'
$coreMembers = 'shared', 'github', 'delivery', 'agents', 'hooks', 'statusline'
$allMembers = $coreMembers + @('core', 'all', 'ts', 'py', 'ng', 'dotnet', 'rust')
$provides = @{
  shared   = 'skills: implementation, detect-techstack, diagnose, code-review'
  github   = 'skills: github-issue, github-pull-request, github-release'
  delivery = 'skills: issue-planning, retro, apm-install'
  agents   = 'orchestrator skill and agents: orchestrator, issue-reader, explorer, planner, reviewer, review-lead, implementer, pr-writer, pbi-runner'
  hooks    = 'hooks: git guardrails'
  statusline = 'skills: context-statusline'
  core     = 'github, delivery, shared, agents, hooks, statusline'
  all      = 'every package except apm-tooling'
  ts       = 'skills: ts-implementation, ts-test, ts-create-project, ts-mcp-server-generator, ts-pnpm-workflow, setup-prettier-eslint-husky'
  py       = 'skills: py-implementation, py-test, py-create-project'
  rust     = 'skills: rust-implementation, rust-test'
  ng       = 'skills: ng-implementation, ng-test, ng-create-project, ng-ag-grid-developer'
  dotnet   = 'skills: dotnet-implementation, dotnet-test, dotnet-create-solution, dotnet-mcp-server-generator'
}
$externalDeps = @{ ng = 'angular/skills (angular-developer)'; dotnet = 'dotnet/skills (dotnet plugin)' }

# Base packages already present in the user's client skill directories (one marker skill each)
function Get-MissingBase {
  $marker = [ordered]@{ shared = 'detect-techstack'; github = 'github-issue'; delivery = 'issue-planning' }
  $missing = [System.Collections.Generic.List[string]]::new()
  foreach ($k in $marker.Keys) {
    $found = $false
    foreach ($d in $homeDirs) { if (Test-Path (Join-Path $userHome "$d/$($marker[$k])")) { $found = $true; break } }
    if (-not $found) { $missing.Add($k) }
  }
  return $missing
}

# User-trusted locations first; project-local copy is repository code
function Find-Detect {
  foreach ($d in $homeDirs) {
    $p = Join-Path $userHome "$d/detect-techstack/scripts/Detect-TechStack.ps1"
    if (Test-Path $p) { return $p }
  }
  foreach ($d in $projectDirs) {
    $p = Join-Path (Get-Location) "$d/detect-techstack/scripts/Detect-TechStack.ps1"
    if (Test-Path $p) {
      if ($TrustProject) { return $p }
      $notes.Add("detect-techstack found only in the project ($d): not run because it is repository code. Pass -TrustProject to run it, or -Packages.")
      return $null
    }
  }
  return $null
}

$langMap = @{ ts = 'ts'; js = 'ts'; typescript = 'ts'; javascript = 'ts'; py = 'py'; python = 'py'; dotnet = 'dotnet'; csharp = 'dotnet'; rust = 'rust' }
$wanted = [System.Collections.Generic.List[string]]::new()
$missingBase = Get-MissingBase
if ($Packages) {
  $Packages | ForEach-Object { if (-not $wanted.Contains($_)) { $wanted.Add($_) } }
} else {
  if ($Global) {
    $notes.Add('Global install without -Packages proposes only the base packages (no stack detection). Pass -Packages (e.g. core, ts) for more.')
  } else {
    $detect = Find-Detect
    if ($detect) {
      try {
        $out = & pwsh -NoProfile -File $detect -ProjectRoot . 2>$null | Out-String
        if ($LASTEXITCODE -ne 0) { throw "exit $LASTEXITCODE" }
        $report = $out | ConvertFrom-Json -ErrorAction Stop
        foreach ($l in @($report.languages)) {
          $k = "$l".ToLowerInvariant()
          if ($langMap.ContainsKey($k) -and -not $wanted.Contains($langMap[$k])) { $wanted.Add($langMap[$k]) }
        }
        if (@($report.frameworks) -contains 'angular' -and -not $wanted.Contains('ng')) { $wanted.Add('ng') }
      } catch {
        $wanted.Clear()
        $notes.Add("detect-techstack failed ($($_.Exception.Message)): only base packages resolved. Pass -Packages for stack packages.")
      }
    } elseif (-not ($notes | Where-Object { $_ -like 'detect-techstack found only*' })) {
      $notes.Add('detect-techstack not installed: only base packages resolved. Pass -Packages for stack packages.')
    }
  }
  foreach ($b in $missingBase) { if (-not $wanted.Contains($b)) { $wanted.Add($b) } }
  if ($Global -and $wanted.Count -eq 0) { $notes.Add('The base packages are already installed globally: nothing to propose.') }
}

# A requested core/all covers its members: no redundant install
foreach ($cover in @(@('all', $allMembers), @('core', $coreMembers))) {
  if ($wanted.Contains($cover[0])) {
    foreach ($m in $cover[1]) {
      if ($m -ne $cover[0] -and $wanted.Contains($m)) {
        [void]$wanted.Remove($m)
        $notes.Add("$m is covered by $($cover[0]): not installed separately.")
      }
    }
  }
}

# Installed state: manifest lines (comments ignored) and apm_modules directories
$base = if ($Global) { Join-Path $userHome '.apm' } else { (Get-Location).Path }
$manifest = Join-Path $base 'apm.yml'
$have = [System.Collections.Generic.HashSet[string]]::new()
if (Test-Path $manifest) {
  foreach ($line in Get-Content $manifest) {
    $l = ($line -replace '(^|\s)#.*$', '').Trim()
    foreach ($pkg in $allMembers) {
      $e = [regex]::Escape($pkg)
      $src = '(?:(?:https?://)?github\.com/|git@github\.com:)?'
      if ($l -match "(?<![\w./-])$src$([regex]::Escape($hubPath))/$e(?:\.git)?/?(?=[#'""\s@]|$)" -or $l -match "(?<![\w./-])$e@apm-hub(?![\w-])") { [void]$have.Add($pkg) }
    }
  }
} else {
  $notes.Add("No apm.yml at ${manifest}: apm install creates it.")
}
foreach ($pkg in $allMembers) {
  if (Test-Path (Join-Path $base "apm_modules/$hubPath/$pkg")) { [void]$have.Add($pkg) }
}
if ($have.Contains('core')) { $coreMembers | ForEach-Object { [void]$have.Add($_) } }
if ($have.Contains('all')) { $allMembers | ForEach-Object { [void]$have.Add($_) } }

$done = [System.Collections.Generic.List[string]]::new()
$skipped = [System.Collections.Generic.List[string]]::new()
$commands = [System.Collections.Generic.List[string]]::new()
$failed = $null
$notAttempted = [System.Collections.Generic.List[string]]::new()

foreach ($pkg in $wanted) {
  if ($have.Contains($pkg)) { $skipped.Add($pkg); continue }
  if ($failed) { $notAttempted.Add($pkg); continue }
  $spec = "$hubPath/$pkg" + $(if ($Ref) { "#$Ref" } else { '' })
  $apmArgs = @('install', $spec) + $(if ($Global) { '-g' } else { @() })
  $commands.Add('apm ' + ($apmArgs -join ' '))
  if (-not $DryRun) {
    # apm output goes to stderr: stdout stays pure JSON
    & apm @apmArgs 2>&1 | ForEach-Object { [Console]::Error.WriteLine("$_") }
    if ($LASTEXITCODE -ne 0) { $failed = $pkg; $notes.Add("apm install failed for $pkg (exit $LASTEXITCODE)"); continue }
  }
  $done.Add($pkg)
}

$when = if ($DryRun) { 'After install: ' } else { '' }
$g = if ($Global) { ' -g' } else { '' }
# Agents: apm copies them in the source format; `apmw sanitize` rewrites the frontmatter per client. The script runs it itself
# (a note alone gets forgotten and the orchestrator then starts without tools) for every client whose agents directory exists.
$sanitized = [System.Collections.Generic.List[string]]::new()
if ($done | Where-Object { $_ -in 'agents', 'core', 'all' }) {
  $agentDirs = if ($Global) {
    [ordered]@{ claude = "$userHome/.claude/agents"; copilot = "$userHome/.copilot/agents"; opencode = "$userHome/.config/opencode/agents" }
  } else {
    [ordered]@{ claude = '.claude/agents'; copilot = '.github/agents'; opencode = '.opencode/agents' }
  }
  $apmw = Get-Command apmw -ErrorAction SilentlyContinue
  foreach ($client in $agentDirs.Keys) {
    if (-not $DryRun -and -not (Test-Path -LiteralPath $agentDirs[$client])) { continue }
    $sanArgs = @('sanitize') + $(if ($Global) { '-g' } else { @() }) + @('-p', $client)
    $commands.Add('apmw ' + ($sanArgs -join ' '))
    if ($DryRun -or -not $apmw) { continue }
    # apmw output goes to stderr like apm output: stdout stays pure JSON
    & apmw @sanArgs 2>&1 | ForEach-Object { [Console]::Error.WriteLine("$_") }
    if ($LASTEXITCODE -ne 0) { $notes.Add("apmw sanitize$g -p $client failed (exit $LASTEXITCODE): run it by hand, the $client agents are still in the source format.") }
    else { $sanitized.Add($client) }
  }
  if ($DryRun) {
    $notes.Add("After install: apmw sanitize$g -p <client> runs for every client with an agents directory (claude, copilot, opencode); without it the agents stay in the source format and the orchestrator starts without tools.")
    if (-not $apmw) { $notes.Add('apmw not found: install it first (uv tool install apmw, or pipx install apmw).') }
  } elseif (-not $apmw) {
    $notes.Add("apmw not found: the agents are still in the source format. Install it (uv tool install apmw, or pipx install apmw) and run apmw sanitize$g -p claude|opencode|copilot.")
  } elseif ($sanitized.Count -gt 0) {
    $notes.Add("apmw sanitize$g ran for: $($sanitized -join ', ').")
  } else {
    $notes.Add("apmw sanitize: no client agents directory found; run apmw sanitize$g -p <client> once the client has one.")
  }
}

$prov = [ordered]@{}
foreach ($p in $done) { $prov[$p] = $provides[$p] }
$deps = @($done | Where-Object { $externalDeps.ContainsKey($_) } | ForEach-Object { $externalDeps[$_] })
if ($done -contains 'all') { $deps = @($externalDeps.Values) }

$result = [ordered]@{ dryRun = [bool]$DryRun }
$result[$(if ($DryRun) { 'wouldInstall' } else { 'installed' })] = @($done)
$result.skipped = @($skipped)
$result.failed = $failed
$result.notAttempted = @($notAttempted)
$result.commands = @($commands)
$result.sanitized = @($sanitized)
$result.provides = $prov
$result.dependencies = $deps
$result.notes = @($notes)
$result | ConvertTo-Json -Depth 4

if ($failed) { exit 1 }
