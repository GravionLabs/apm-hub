<#
.SYNOPSIS
    Sync local Copilot configuration files with the latest versions from GravionLabs/apm-hub.

.DESCRIPTION
    Discovers all installed Copilot files (.github/instructions, .github/prompts, .github/agents)
    and their counterparts in the optional global base directory (~/.github by default).
    Fetches remote versions, compares, and applies updates. Also reports new templates
    available in apm-hub that are not yet installed anywhere.

    Requires: pwsh (PowerShell Core), gh CLI (authenticated)

.PARAMETER Autopilot
    Skip all confirmation prompts and apply updates immediately.

.PARAMETER Force
    Overwrite all files unconditionally, even if they appear unchanged.

.PARAMETER GlobalBase
    Global base directory containing instructions/, prompts/, agents/ subdirectories.
    Defaults to $HOME/.github or $env:COPILOT_GLOBAL_BASE if set.

.PARAMETER DryRun
    Show what would change without writing any files.

.PARAMETER SkipNew
    Skip the check for new templates not yet installed.

.PARAMETER InstallNew
    Automatically install all newly discovered templates (implies -Autopilot for new files).

.EXAMPLE
    pwsh .github/scripts/copilot-sync.ps1

.EXAMPLE
    pwsh .github/scripts/copilot-sync.ps1 -Autopilot

.EXAMPLE
    pwsh .github/scripts/copilot-sync.ps1 -DryRun

.EXAMPLE
    pwsh .github/scripts/copilot-sync.ps1 -Autopilot -InstallNew -GlobalBase ~/.github
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [switch]$Autopilot,
    [switch]$Force,
    [string]$GlobalBase,
    [switch]$DryRun,
    [switch]$SkipNew,
    [switch]$InstallNew,
    [switch]$SetupMode  # New: If set, script runs in setup mode (skip stack detection)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ─── Configuration ────────────────────────────────────────────────────────────

$Repo       = 'GravionLabs/apm-hub'
$RemoteBase = 'templates'

$Categories = @(
    @{
        Name     = 'instructions'
        Filter   = '*.instructions.md'
        LocalDir = '.github/instructions'
    },
    @{
        Name     = 'prompts'
        Filter   = '*.prompt.md'
        LocalDir = '.github/prompts'
    },
    @{
        Name     = 'agents'
        Filter   = '*.agent.md'
        LocalDir = '.github/agents'
    }
)

if (-not $GlobalBase) {
    $GlobalBase = if ($env:COPILOT_GLOBAL_BASE) { $env:COPILOT_GLOBAL_BASE } else { "$HOME/.github" }
}

# ─── Stack Detection ─────────────────────────────────────────────────────────
function Detect-ProjectStack {
    $languages = @()
    $frameworks = @()
    $ci = @()
    $tests = @()

    # Language detection by file extension
    $exts = Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { $_.Extension.ToLower() } | Sort-Object -Unique
    if ('.cs' -in $exts) { $languages += 'C#' }
    if ('.py' -in $exts) { $languages += 'Python' }
    if ('.ts' -in $exts) { $languages += 'TypeScript' }
    if ('.js' -in $exts) { $languages += 'JavaScript' }
    if ('.tf' -in $exts) { $languages += 'Terraform' }

    # Framework detection by config files
    if (Test-Path '*.csproj') { $frameworks += 'dotnet' }
    if (Test-Path 'package.json') { $frameworks += 'Node.js' }
    if (Test-Path 'requirements.txt') { $frameworks += 'Python (requirements.txt)' }
    if (Test-Path 'pyproject.toml') { $frameworks += 'Python (pyproject.toml)' }
    if (Test-Path '*.sln') { $frameworks += 'dotnet solution' }
    if (Test-Path 'angular.json') { $frameworks += 'Angular' }
    if (Test-Path 'Dockerfile') { $frameworks += 'Docker' }

    # CI/CD detection
    if (Test-Path '.github/workflows') { $ci += 'GitHub Actions' }
    if (Get-ChildItem -Path . -Filter 'azure-pipelines*.yml' -File -ErrorAction SilentlyContinue) { $ci += 'Azure Pipelines' }

    # Test frameworks
    if (Get-ChildItem -Recurse -File -Include '*NUnit*' -ErrorAction SilentlyContinue) { $tests += 'NUnit' }
    if (Get-ChildItem -Recurse -File -Include '*xUnit*' -ErrorAction SilentlyContinue) { $tests += 'xUnit' }
    if (Get-ChildItem -Recurse -File -Include '*pytest*' -ErrorAction SilentlyContinue) { $tests += 'pytest' }
    if (Get-ChildItem -Recurse -File -Include '*Jest*' -ErrorAction SilentlyContinue) { $tests += 'Jest' }
    if (Get-ChildItem -Recurse -File -Include '*Playwright*' -ErrorAction SilentlyContinue) { $tests += 'Playwright' }

    Write-Host "\nDetected project stack:"
    Write-Host "  Languages:   $($languages -join ', ')"
    Write-Host "  Frameworks:  $($frameworks -join ', ')"
    Write-Host "  CI/CD:       $($ci -join ', ')"
    Write-Host "  Test:        $($tests -join ', ')"
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

function Test-Prerequisites {
    $missing = @()
    if (-not (Get-Command pwsh -ErrorAction SilentlyContinue)) { $missing += 'pwsh' }
    if (-not (Get-Command gh   -ErrorAction SilentlyContinue)) { $missing += 'gh' }
    if ($missing) {
        Write-Error "Missing required tools: $($missing -join ', '). Install them and retry."
        exit 1
    }
    $authStatus = gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "gh CLI is not authenticated. Run 'gh auth login' first."
        exit 1
    }
}

function Get-RemoteFileList {
    param([string]$Category)
    $json = gh api "/repos/$Repo/contents/$RemoteBase/$Category" --jq '[.[] | select(.type=="file") | .name]' 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $json) { return @() }
    return $json | ConvertFrom-Json
}

function Get-DownloadUrl {
    param([string]$Category, [string]$Filename)
    $url = gh api "/repos/$Repo/contents/$RemoteBase/$Category/$Filename" --jq '.download_url' 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return $url.Trim()
}

function Fetch-ToTemp {
    param([string]$Category, [string]$Filename)
    $url = Get-DownloadUrl $Category $Filename
    if (-not $url) { return $null }
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing
        return $tmp
    } catch {
        Remove-Item $tmp -ErrorAction SilentlyContinue
        return $null
    }
}

function Compare-WithRemote {
    param([string]$LocalPath, [string]$TmpPath)
    if (-not (Test-Path $LocalPath)) { return 'MISSING' }
    $local  = Get-Content $LocalPath -Raw -ErrorAction SilentlyContinue
    $remote = Get-Content $TmpPath  -Raw -ErrorAction SilentlyContinue
    if ($local -eq $remote) { return 'UNCHANGED' }
    return 'UPDATED'
}

function Confirm-Action {
    param([string]$Question)
    if ($Autopilot) { return $true }
    $answer = Read-Host "$Question [Y/n]"
    return ($answer -eq '' -or $answer -match '^[Yy]')
}

function Write-Header {
    param([string]$Text)
    $line = '─' * 50
    Write-Host "`n$line"
    Write-Host "  $Text"
    Write-Host $line
}

# ─── Step 1: Build sync list ──────────────────────────────────────────────────

function Build-SyncList {
    $list = [System.Collections.Generic.List[PSCustomObject]]::new()

    foreach ($cat in $Categories) {
        $catObj = [PSCustomObject]$cat
        $globalDir = Join-Path $GlobalBase $catObj.Name

        # Collect filenames from local and global directories
        $localFiles  = @()
        $globalFiles = @()

        if (Test-Path $catObj.LocalDir -PathType Container) {
            $localFiles = (Get-ChildItem $catObj.LocalDir -Filter $catObj.Filter -ErrorAction SilentlyContinue).Name
        }
        if (Test-Path $globalDir -PathType Container) {
            $globalFiles = (Get-ChildItem $globalDir -Filter $catObj.Filter -ErrorAction SilentlyContinue).Name
        }

        $allFiles = ($localFiles + $globalFiles) | Sort-Object -Unique

        foreach ($file in $allFiles) {
            $inLocal  = $file -in $localFiles
            $inGlobal = $file -in $globalFiles

            $scope = switch ($true) {
                ($inLocal -and $inGlobal) { 'both'   }
                $inLocal                  { 'local'  }
                default                   { 'global' }
            }

            $localPath = if ($inLocal) {
                Join-Path $catObj.LocalDir $file
            } else {
                Join-Path $globalDir $file
            }

            $list.Add([PSCustomObject]@{
                Filename  = $file
                Category  = $catObj.Name
                Scope     = $scope
                LocalPath = $localPath
                LocalDir  = $catObj.LocalDir
                GlobalDir = $globalDir
            })
        }
    }

    return $list
}

# ─── Step 2: Fetch and compare ────────────────────────────────────────────────

function Compare-AllFiles {
    param($SyncList)

    $results = [System.Collections.Generic.List[PSCustomObject]]::new()

    foreach ($entry in $SyncList) {
        Write-Host "  Checking $($entry.Category)/$($entry.Filename)..." -NoNewline

        $tmp = Fetch-ToTemp $entry.Category $entry.Filename
        if (-not $tmp) {
            Write-Host " ⚠️  NOT FOUND in remote"
            $result = $entry.PSObject.Copy()
            $result | Add-Member -NotePropertyName Status -NotePropertyValue 'NOT_FOUND' -Force
            $result | Add-Member -NotePropertyName TmpPath -NotePropertyValue $null -Force
            $results.Add($result)
            continue
        }

        $status = if ($Force) { 'UPDATED' } else { Compare-WithRemote $entry.LocalPath $tmp }
        Write-Host " $(if ($status -eq 'UPDATED') { '🔄 UPDATED' } elseif ($status -eq 'UNCHANGED') { '✅ unchanged' } else { '🆕 new' })"

        $result = $entry.PSObject.Copy()
        $result | Add-Member -NotePropertyName Status -NotePropertyValue $status -Force
        $result | Add-Member -NotePropertyName TmpPath -NotePropertyValue $tmp -Force
        $results.Add($result)
    }

    return $results
}

# ─── Step 3: Apply updates ────────────────────────────────────────────────────

function Apply-Updates {
    param($ComparedList)

    $updated = $ComparedList | Where-Object Status -eq 'UPDATED'
    if (-not $updated) {
        Write-Host "`n✅ All files are already up to date."
        return
    }

    if (-not (Confirm-Action "`nApply $(@($updated).Count) update(s)?")) {
        Write-Host "Skipped."
        return
    }

    foreach ($entry in $updated) {
        if ($DryRun) {
            Write-Host "  [DryRun] Would update $($entry.LocalPath)"
            if ($entry.Scope -eq 'both') {
                Write-Host "  [DryRun] Would update $(Join-Path $entry.GlobalDir $entry.Filename)"
            }
            continue
        }

        switch ($entry.Scope) {
            'local' {
                New-Item -ItemType Directory -Force -Path $entry.LocalDir | Out-Null
                Move-Item -Path $entry.TmpPath -Destination $entry.LocalPath -Force
                Write-Host "  ✅ $($entry.LocalPath)"
            }
            'global' {
                New-Item -ItemType Directory -Force -Path $entry.GlobalDir | Out-Null
                Move-Item -Path $entry.TmpPath -Destination (Join-Path $entry.GlobalDir $entry.Filename) -Force
                Write-Host "  ✅ $(Join-Path $entry.GlobalDir $entry.Filename)"
            }
            'both' {
                New-Item -ItemType Directory -Force -Path $entry.LocalDir   | Out-Null
                New-Item -ItemType Directory -Force -Path $entry.GlobalDir  | Out-Null
                Move-Item -Path $entry.TmpPath -Destination $entry.LocalPath -Force
                Copy-Item -Path $entry.LocalPath -Destination (Join-Path $entry.GlobalDir $entry.Filename) -Force
                Write-Host "  ✅ $($entry.LocalPath)"
                Write-Host "  ✅ $(Join-Path $entry.GlobalDir $entry.Filename) (global)"
            }
        }
    }
}

# ─── Step 4: Check for new templates ─────────────────────────────────────────

function Find-NewTemplates {
    param($SyncList)

    $installedByCategory = @{}
    foreach ($cat in $Categories) { $installedByCategory[$cat.Name] = @() }
    foreach ($entry in $SyncList) {
        $installedByCategory[$entry.Category] += $entry.Filename
    }

    $newByCategory = @{}
    $hasNew = $false

    foreach ($cat in $Categories) {
        $remoteFiles = Get-RemoteFileList $cat.Name
        $newFiles = $remoteFiles | Where-Object { $_ -notin $installedByCategory[$cat.Name] }
        if ($newFiles) {
            $newByCategory[$cat.Name] = $newFiles
            $hasNew = $true
        }
    }

    if (-not $hasNew) {
        Write-Host "`n✅ No new templates available."
        return @{}
    }

    Write-Host "`n🆕 New templates available in apm-hub (not yet installed):"
    foreach ($cat in $Categories) {
        if ($newByCategory.ContainsKey($cat.Name) -and $newByCategory[$cat.Name]) {
            $names = $newByCategory[$cat.Name] -join ', '
            Write-Host "   $($cat.Name): $names"
        }
    }

    return $newByCategory
}

function Install-NewTemplates {
    param($NewByCategory, $SyncList)

    foreach ($cat in $Categories) {
        if (-not $NewByCategory.ContainsKey($cat.Name) -or -not $NewByCategory[$cat.Name]) { continue }

        $candidates = $NewByCategory[$cat.Name]

        if (-not $InstallNew) {
            $answer = Read-Host "`nInstall new $($cat.Name)? Enter filenames comma-separated, '*' for all, or leave blank to skip"
            if (-not $answer) { continue }
            if ($answer -ne '*') {
                $candidates = $answer -split '\s*,\s*' | Where-Object { $_ -in $NewByCategory[$cat.Name] }
            }
        }

        foreach ($file in $candidates) {
            Write-Host "  Installing $($cat.Name)/$file..." -NoNewline
            $tmp = Fetch-ToTemp $cat.Name $file
            if (-not $tmp) { Write-Host " ⚠️  download failed"; continue }

            if (-not $DryRun) {
                New-Item -ItemType Directory -Force -Path $cat.LocalDir | Out-Null
                Move-Item -Path $tmp -Destination (Join-Path $cat.LocalDir $file) -Force
            }
            Write-Host " ✅ $(Join-Path $cat.LocalDir $file)$(if ($DryRun) { ' [DryRun]' })"
        }
    }
}

# ─── Step 5: Final report ─────────────────────────────────────────────────────

function Write-FinalReport {
    param($ComparedList)

    $updated   = @($ComparedList | Where-Object Status -eq 'UPDATED')
    $unchanged = @($ComparedList | Where-Object Status -eq 'UNCHANGED')
    $missing   = @($ComparedList | Where-Object Status -eq 'NOT_FOUND')

    Write-Header "GH Copilot Sync Complete$(if ($DryRun) { ' [DRY RUN]' })"
    Write-Host ""

    if ($updated) {
        Write-Host "Updated ($($updated.Count)):"
        foreach ($e in $updated) { Write-Host "  $($e.LocalPath)" }
        Write-Host ""
    }

    if ($unchanged) {
        Write-Host "Unchanged ($($unchanged.Count)):"
        foreach ($e in $unchanged) { Write-Host "  $($e.LocalPath)" }
        Write-Host ""
    }

    if ($missing) {
        Write-Host "⚠️  Not found in apm-hub (custom files, skipped) ($($missing.Count)):"
        foreach ($e in $missing) { Write-Host "  $($e.LocalPath)" }
        Write-Host ""
    }

    if ($updated -and -not $DryRun) {
        Write-Host "Tip: commit changes with:"
        Write-Host "  git add .github/"
        Write-Host "  git commit -m `"chore: sync Copilot templates from apm-hub`""
    }
}

# ─── Main ─────────────────────────────────────────────────────────────────────

Write-Header "GH Copilot Sync$(if ($DryRun) { ' [DRY RUN]' })"

Test-Prerequisites

if ($SetupMode) {
    Detect-ProjectStack
}

Write-Host "`nDiscovering installed files..."
$syncList = Build-SyncList

if ($syncList.Count -eq 0) {
    Write-Host "No Copilot files found in .github/ or $GlobalBase. Run /gh-copilot-setup first."
    exit 0
}

Write-Host "`nFetching and comparing with remote..."
$compared = Compare-AllFiles $syncList

Apply-Updates $compared

# Clean up any remaining temp files
foreach ($entry in $compared) {
    if ($entry.TmpPath -and (Test-Path $entry.TmpPath -ErrorAction SilentlyContinue)) {
        Remove-Item $entry.TmpPath -ErrorAction SilentlyContinue
    }
}

if (-not $SkipNew) {
    Write-Header "Checking for new templates"
    $newTemplates = Find-NewTemplates $syncList
    if ($newTemplates.Count -gt 0) {
        Install-NewTemplates $newTemplates $syncList
    }
}

Write-FinalReport $compared
