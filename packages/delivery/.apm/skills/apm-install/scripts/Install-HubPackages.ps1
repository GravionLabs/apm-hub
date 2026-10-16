<#
.SYNOPSIS
  Resolve and install the apm-hub packages a project needs with `apm`.

.DESCRIPTION
  Without -Packages, runs the installed detect-techstack script and maps the stack to
  packages (typescript/javascript -> ts, python -> py, csharp -> dotnet, angular -> ng).
  The base packages shared, github, delivery are added only when not installed globally.
  Packages already listed in apm.yml are skipped. Install form:
  apm install GravionLabs/apm-hub/packages/<pkg> [-g]

.PARAMETER Packages
  Packages to install (comma-separated); skips detection. One of shared, github, delivery,
  agents, hooks, core, all, ts, py, ng, dotnet.

.PARAMETER Global
  Install user-wide (apm -g) instead of into the project.

.PARAMETER DryRun
  Print the commands in the JSON result, run nothing.

.OUTPUTS
  JSON {installed, skipped, commands, notes}. Exit 1 when apm or pwsh 7 is missing or a command fails.
#>
param(
  [string[]]$Packages,
  [switch]$Global,
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
$valid = 'shared', 'github', 'delivery', 'agents', 'hooks', 'core', 'all', 'ts', 'py', 'ng', 'dotnet'
if ($Packages) {
  $Packages = @($Packages | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
  $bad = @($Packages | Where-Object { $valid -notcontains $_ })
  if ($bad) {
    [Console]::Error.WriteLine("Invalid package(s): $($bad -join ', '). Valid: $($valid -join ', ')")
    exit 1
  }
}

$userHome = if ($env:HOME) { $env:HOME } else { $env:USERPROFILE }
$skillDirs = '.claude/skills', '.opencode/skills', '.agents/skills', '.github/skills'
$globalDirs = '.claude/skills', '.config/opencode/skills', '.copilot/skills', '.agents/skills'
$notes = [System.Collections.Generic.List[string]]::new()

function Test-GlobalBase {
  foreach ($d in $globalDirs) {
    if (Test-Path (Join-Path $userHome "$d/github-issue")) { return $true }
  }
  return $false
}

function Find-Detect {
  $roots = @($skillDirs | ForEach-Object { Join-Path (Get-Location) $_ }) + @($skillDirs | ForEach-Object { Join-Path $userHome $_ })
  foreach ($r in $roots) {
    $p = Join-Path $r 'detect-techstack/scripts/Detect-TechStack.ps1'
    if (Test-Path $p) { return $p }
  }
  return $null
}

$wanted = [System.Collections.Generic.List[string]]::new()
if ($Packages) {
  $Packages | ForEach-Object { if (-not $wanted.Contains($_)) { $wanted.Add($_) } }
} else {
  $detect = Find-Detect
  if ($detect) {
    $report = (& pwsh -NoProfile -File $detect -ProjectRoot . | Out-String) | ConvertFrom-Json
    $map = @{ typescript = 'ts'; javascript = 'ts'; python = 'py'; csharp = 'dotnet' }
    foreach ($l in @($report.languages)) {
      if ($map.ContainsKey($l) -and -not $wanted.Contains($map[$l])) { $wanted.Add($map[$l]) }
    }
    if (@($report.frameworks) -contains 'angular' -and -not $wanted.Contains('ng')) { $wanted.Add('ng') }
  } else {
    $notes.Add('detect-techstack not installed: only base packages resolved. Pass -Packages for stack packages.')
  }
  if (-not (Test-GlobalBase)) {
    foreach ($b in 'shared', 'github', 'delivery') { if (-not $wanted.Contains($b)) { $wanted.Add($b) } }
  }
}

$manifest = if ($Global) { Join-Path $userHome '.apm/apm.yml' } else { Join-Path (Get-Location) 'apm.yml' }
$manifestText = if (Test-Path $manifest) { Get-Content $manifest -Raw } else { '' }

$installed = [System.Collections.Generic.List[string]]::new()
$skipped = [System.Collections.Generic.List[string]]::new()
$commands = [System.Collections.Generic.List[string]]::new()
$failed = $false

foreach ($pkg in $wanted) {
  if ($manifestText -match "(?m)packages/$([regex]::Escape($pkg))\s*$|packages/$([regex]::Escape($pkg))['""\s#]") {
    $skipped.Add($pkg)
    continue
  }
  $spec = "GravionLabs/apm-hub/packages/$pkg"
  $apmArgs = @('install', $spec) + $(if ($Global) { '-g' } else { @() })
  $commands.Add('apm ' + ($apmArgs -join ' '))
  if (-not $DryRun) {
    & apm @apmArgs | Out-Host
    if ($LASTEXITCODE -ne 0) { $failed = $true; $notes.Add("apm install failed for $pkg (exit $LASTEXITCODE)"); break }
  }
  $installed.Add($pkg)
}

$g = if ($Global) { ' -g' } else { '' }
if ($installed -contains 'agents' -or $installed -contains 'core' -or $installed -contains 'all') {
  $notes.Add("Run apmw sanitize$g -p claude|opencode|copilot to rewrite the agent frontmatter per client (required for OpenCode).")
}
if ($installed -contains 'hooks' -or $installed -contains 'all') {
  $dest = if ($Global) { '~/.config/opencode/plugins/' } else { '.opencode/plugins/' }
  $notes.Add("OpenCode: copy packages/hooks/.apm/opencode/plugins/apm-hub-hooks.ts to $dest by hand.")
}

[ordered]@{
  installed = @($installed)
  skipped   = @($skipped)
  commands  = @($commands)
  notes     = @($notes)
} | ConvertTo-Json -Depth 3

if ($failed) { exit 1 }
