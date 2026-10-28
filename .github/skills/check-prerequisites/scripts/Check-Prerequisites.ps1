#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Checks and validates all global prerequisites for apm-hub skills.

.DESCRIPTION
    Verifies that required tools are installed: PowerShell, Git, Node.js, npm. Reports dromos (`dromos --version`, optional).
    Optionally checks for optional tools (gh, curl, jq, yq, ast-grep, python, apmw). apmw counts as required
    when an installed agent file is still in the apm-hub source format (never sanitized).
    Can auto-install missing tools using platform-specific package managers.

.PARAMETER Full
    Check optional tools in addition to core and runtime prerequisites.

.PARAMETER AutoInstall
    Attempt to automatically install missing tools using platform package managers.

.EXAMPLE
    pwsh scripts/Check-Prerequisites.ps1
    # Checks core and runtime prerequisites

    pwsh scripts/Check-Prerequisites.ps1 -Full
    # Includes optional tools

    pwsh scripts/Check-Prerequisites.ps1 -AutoInstall
    # Auto-installs missing tools

.LINK
    https://github.com/GravionLabs/apm-hub/docs/prerequisites.md
#>
param(
    [switch]$Full,
    [switch]$AutoInstall,
    [switch]$Help
)

if ($Help) {
    Get-Help $PSCommandPath -Full
    exit 0
}

$results = @{
    core    = @{}
    runtime = @{}
    optional = @{}
    missing = @()
}

# Detect OS
$OS_Windows = $PSVersionTable.Platform -eq 'Win32NT' -or -not $PSVersionTable.Platform
$OS_MacOS = $PSVersionTable.Platform -eq 'Unix' -and (uname -s) -eq 'Darwin'
$OS_Linux = $PSVersionTable.Platform -eq 'Unix' -and (uname -s) -eq 'Linux'

function Get-ToolVersion {
    param([string]$Tool, [string[]]$VersionArgs = @('--version'))
    
    try {
        $cmd = Get-Command $Tool -ErrorAction Stop
        $output = & $cmd @VersionArgs 2>&1 | Select-Object -First 1
        return $output.Trim()
    } catch {
        return $null
    }
}

function Test-Tool {
    param([string]$Tool)
    try {
        $null = Get-Command $Tool -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Install-Tool {
    param([string]$Tool, [hashtable]$Installers)
    
    if (-not $AutoInstall) { return $false }
    
    $installer = $Installers[$Tool]
    if (-not $installer) { return $false }
    
    Write-Host "  → Attempting to install $Tool..." -ForegroundColor Yellow
    
    try {
        if ($OS_Windows) {
            if (Test-Tool 'winget') {
                & winget install -e --id $installer.winget --silent
            } else {
                Write-Host "    ✗ winget not found. Install manually: $($installer.windows)" -ForegroundColor Red
                return $false
            }
        } elseif ($OS_MacOS) {
            & brew install $installer.brew
        } elseif ($OS_Linux) {
            & sudo apt-get install -y $installer.apt 2>/dev/null || & sudo dnf install -y $installer.dnf 2>/dev/null
        }
        
        # Verify installation
        return Test-Tool $Tool
    } catch {
        Write-Host "    ✗ Installation failed: $_" -ForegroundColor Red
        return $false
    }
}

# ===== CORE Prerequisites =====
Write-Host "`n=== CORE Prerequisites ===" -ForegroundColor Cyan

# PowerShell
$psVersion = $PSVersionTable.PSVersion
if ($psVersion.Major -ge 7) {
    $results.core['PowerShell'] = "✓ $($psVersion.Major).$($psVersion.Minor).$($psVersion.Patch)"
    Write-Host "  ✓ PowerShell: $($psVersion.Major).$($psVersion.Minor).$($psVersion.Patch)" -ForegroundColor Green
} else {
    $results.core['PowerShell'] = "✗ $($psVersion.Major).$($psVersion.Minor) (need 7+)"
    Write-Host "  ✗ PowerShell: $($psVersion.Major).$($psVersion.Minor) (need 7+)" -ForegroundColor Red
    $results.missing += 'PowerShell'
}

# Git
if (Test-Tool 'git') {
    $gitVersion = git --version | Select-Object -First 1
    $results.core['Git'] = "✓ $gitVersion"
    Write-Host "  ✓ Git: $gitVersion" -ForegroundColor Green
} else {
    $results.core['Git'] = "✗ NOT FOUND"
    Write-Host "  ✗ Git: NOT FOUND" -ForegroundColor Red
    $results.missing += 'Git'
}

# ===== RUNTIME Prerequisites =====
Write-Host "`n=== RUNTIME Prerequisites ===" -ForegroundColor Cyan

# Node.js
if (Test-Tool 'node') {
    $nodeVersion = node --version
    $results.runtime['Node.js'] = "✓ $nodeVersion"
    Write-Host "  ✓ Node.js: $nodeVersion" -ForegroundColor Green
} else {
    $results.runtime['Node.js'] = "✗ NOT FOUND"
    Write-Host "  ✗ Node.js: NOT FOUND" -ForegroundColor Red
    $results.missing += 'Node.js'
}

# npm
if (Test-Tool 'npm') {
    $npmVersion = npm --version
    $results.runtime['npm'] = "✓ v$npmVersion"
    Write-Host "  ✓ npm: v$npmVersion" -ForegroundColor Green
} else {
    $results.runtime['npm'] = "✗ NOT FOUND"
    Write-Host "  ✗ npm: NOT FOUND" -ForegroundColor Red
    $results.missing += 'npm'
}

# ===== dromos (optional runner; reported, never fails the check) =====
if (Test-Tool 'dromos') {
    $dromosVersion = Get-ToolVersion 'dromos'
    $results.runtime['dromos'] = "✓ $dromosVersion"
    Write-Host "  ✓ dromos: $dromosVersion" -ForegroundColor Green
} else {
    $results.runtime['dromos'] = "✗ NOT FOUND (optional)"
    Write-Host "  - dromos: NOT FOUND (optional, the runner: npm i -g dromos)" -ForegroundColor Gray
}

# ===== apmw (required once agent files in the apm-hub source format are installed) =====
# apm copies the agents of the agents package verbatim; a file whose frontmatter still has a top-level `metadata:` key was
# never rewritten by `apmw sanitize` and Claude Code starts it without tools, OpenCode rejects it.
function Test-SourceFormatAgents {
    $dirs = @('.claude/agents', '.opencode/agents', '.github/agents')
    $userHome = if ($env:HOME) { $env:HOME } else { $env:USERPROFILE }
    if ($userHome) { $dirs += @("$userHome/.claude/agents", "$userHome/.config/opencode/agents", "$userHome/.copilot/agents") }
    foreach ($d in $dirs) {
        if (-not (Test-Path -LiteralPath $d)) { continue }
        foreach ($f in Get-ChildItem -LiteralPath $d -Filter *.md -File -ErrorAction SilentlyContinue) {
            $lines = Get-Content -LiteralPath $f.FullName -TotalCount 200 -ErrorAction SilentlyContinue
            if (-not $lines -or $lines[0].TrimEnd() -ne '---') { continue }
            $end = [Array]::IndexOf($lines, '---', 1)
            $front = if ($end -gt 0) { $lines[1..($end - 1)] } else { $lines[1..($lines.Count - 1)] }
            if ($front -match '^metadata:\s*$') { return $f.FullName }
        }
    }
    return $null
}
$sourceAgent = Test-SourceFormatAgents
if ($sourceAgent -and -not (Test-Tool 'apmw')) {
    Write-Host "`n  ✗ apmw: NOT FOUND, but $sourceAgent is in the apm-hub source format (never sanitized)" -ForegroundColor Red
    $results.missing += 'apmw'
}

# ===== OPTIONAL Prerequisites =====
if ($Full) {
    Write-Host "`n=== OPTIONAL Prerequisites ===" -ForegroundColor Cyan
    
    $optionalTools = @(
        'gh',
        'curl',
        'jq',
        'yq',
        'ast-grep',
        'python',
        'apmw'
    )
    
    foreach ($tool in $optionalTools) {
        if (Test-Tool $tool) {
            $version = Get-ToolVersion $tool
            $results.optional[$tool] = "✓ $version"
            Write-Host "  ✓ $tool : $version" -ForegroundColor Green
        } else {
            $results.optional[$tool] = "✗ NOT FOUND"
            Write-Host "  ✗ $tool : NOT FOUND" -ForegroundColor Gray
            if ($tool -eq 'apmw') {
                Write-Host "    only for the agents package (agents, core, all); required for OpenCode, recommended for Claude Code and Copilot: pipx install apmw  or  uv tool install apmw" -ForegroundColor Gray
            }
        }
    }
}

# ===== Summary =====
Write-Host "`n=== Summary ===" -ForegroundColor Cyan

if ($results.missing.Count -eq 0) {
    Write-Host "✓ All required prerequisites are installed!" -ForegroundColor Green
    exit 0
} else {
    $installHints = @{
        'PowerShell' = @{ windows = 'winget install Microsoft.PowerShell'; macos = 'brew install powershell'; linux = 'sudo apt-get install powershell' }
        'Git'        = @{ windows = 'winget install Git.Git';              macos = 'brew install git';        linux = 'sudo apt-get install git' }
        'Node.js'    = @{ windows = 'winget install OpenJS.NodeJS';        macos = 'brew install node';       linux = 'sudo apt-get install nodejs' }
        'npm'        = @{ windows = 'included with Node.js';               macos = 'brew install node';       linux = 'sudo apt-get install npm' }
        'apmw'       = @{ windows = 'uv tool install apmw (or pipx install apmw), then apmw sanitize -g -p claude'; macos = 'uv tool install apmw (or pipx install apmw), then apmw sanitize -g -p claude'; linux = 'uv tool install apmw (or pipx install apmw), then apmw sanitize -g -p claude' }
    }

    $installers = @{
        'PowerShell' = @{ winget = 'Microsoft.PowerShell'; brew = 'powershell'; apt = 'powershell'; dnf = 'powershell' }
        'Git'        = @{ winget = 'Git.Git';              brew = 'git';        apt = 'git';        dnf = 'git' }
        'Node.js'    = @{ winget = 'OpenJS.NodeJS';        brew = 'node';       apt = 'nodejs';     dnf = 'nodejs' }
        'npm'        = @{ winget = 'OpenJS.NodeJS';        brew = 'node';       apt = 'npm';        dnf = 'npm' }
    }

    Write-Host "✗ Missing Prerequisites" -ForegroundColor Red
    Write-Host ""
    foreach ($tool in $results.missing) {
        $hints = $installHints[$tool]
        Write-Host "  • $tool : NOT FOUND" -ForegroundColor Red
        if ($hints) {
            Write-Host "    → Windows: $($hints.windows)" -ForegroundColor Yellow
            Write-Host "    → macOS:   $($hints.macos)" -ForegroundColor Yellow
            Write-Host "    → Linux:   $($hints.linux)" -ForegroundColor Yellow
        }
        Write-Host ""
    }

    Write-Host "Run with -AutoInstall flag to attempt automatic installation." -ForegroundColor Yellow
    Write-Host "See docs/prerequisites.md for detailed instructions." -ForegroundColor Yellow

    if ($AutoInstall) {
        Write-Host "`n  Attempting auto-install..." -ForegroundColor Yellow
        foreach ($tool in $results.missing) {
            Install-Tool $tool $installers
        }
    }

    exit 1
}
